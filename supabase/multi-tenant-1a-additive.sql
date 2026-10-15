-- MULTI-TENANT PHASE 1, PART A: additive and safe (nothing existing changes behavior).
-- See MULTI-TENANT-PLAN.md. Apply to STAGING first.
--
-- Adds the organization tables and helper functions, adds a nullable org_id to every
-- table that owns data directly, creates The Agency as organization #1, and backfills
-- every existing row into it. Existing policies are untouched, so the running app works
-- exactly as before after this part.

-- ---------------------------------------------------------------- tables
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,60}$'),
  name text not null,
  type text not null default 'brokerage' check (type in ('brokerage', 'solo')),
  status text not null default 'active' check (status in ('active', 'paused', 'archived')),
  address_line1 text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  disclaimer text not null default '',
  franchise_disclaimer text not null default '',
  -- logos by variant, allowed accent colors, default logo, location label. Public by design (public sites show it).
  brand jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Private per-organization settings (plan ceilings, IDX, link to HQ). Never public.
create table public.org_settings (
  org_id uuid primary key references public.organizations(id) on delete cascade,
  features jsonb not null default '{}'::jsonb,
  idx_config jsonb,
  hq_client_id text,
  updated_at timestamptz not null default now()
);

create table public.org_domains (
  domain text primary key check (domain = lower(domain)),
  org_id uuid not null references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('site', 'app')),
  verified boolean not null default false,
  created_at timestamptz not null default now()
);
create index org_domains_org_idx on public.org_domains(org_id);

-- Latchpoint staff. A separate table (not a role on profiles) so it can never be granted by a profile edit.
create table public.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  org_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb
);
create index audit_log_org_idx on public.audit_log(org_id, at desc);

-- ------------------------------------------------------- nullable org_id columns
alter table public.profiles add column org_id uuid references public.organizations(id);
alter table public.listings add column org_id uuid references public.organizations(id);
alter table public.agent_sites add column org_id uuid references public.organizations(id);
alter table public.leads add column org_id uuid references public.organizations(id);
alter table public.page_views add column org_id uuid references public.organizations(id);
alter table public.upcoming_listings add column org_id uuid references public.organizations(id);
alter table public.buyer_needs add column org_id uuid references public.organizations(id);
alter table public.brokerage_site add column org_id uuid references public.organizations(id);
alter table public.brokerage_agents add column org_id uuid references public.organizations(id);
alter table public.brokerage_areas add column org_id uuid references public.organizations(id);
alter table public.brokerage_posts add column org_id uuid references public.organizations(id);
alter table public.area_template_areas add column org_id uuid references public.organizations(id); -- null = platform default pack

-- ------------------------------------------------------------ helper functions
create or replace function public.current_org_id() returns uuid
language sql stable security definer set search_path = public as
$$ select org_id from public.profiles where id = auth.uid() $$;

create or replace function public.is_platform_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.platform_admins where user_id = auth.uid()) $$;

create or replace function public.is_org_admin(org uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select org is not null and exists (select 1 from public.profiles where id = auth.uid() and org_id = org and role = 'admin') $$;

create or replace function public.can_manage_org(org uuid) returns boolean
language sql stable security definer set search_path = public as
$$ select public.is_platform_admin() or public.is_org_admin(org) $$;

-- ------------------------------------- The Agency becomes organization #1, then backfill
insert into public.organizations (slug, name, type, address_line1, city, state, zip, disclaimer, franchise_disclaimer, brand)
values (
  'the-agency-oklahoma', 'The Agency', 'brokerage',
  '112 S. Broadway', 'Edmond', 'OK', '73034',
  'This office is independently owned and operated. Equal Housing Opportunity.',
  'THIS OFFICE IS AN INDEPENDENTLY OWNED AND OPERATED FRANCHISEE OF THE AGENCY REAL ESTATE FRANCHISING, LLC.',
  '{"logos":{"red":"/images/brokerage-logo.png","white":"/images/brokerage-logo-white.png","black":"/images/brokerage-logo-black.png"},"default_logo":"red","accent_colors":["#ed2127","#000000"],"location_label":"Oklahoma"}'::jsonb
);

insert into public.org_settings (org_id, features)
select id, '{"site_access_max":"full","people_allowed":true,"idx_allowed":true,"max_agents":null}'::jsonb
from public.organizations where slug = 'the-agency-oklahoma';

insert into public.platform_admins (user_id) values ('ecbf43ef-f68f-4164-8854-10171ff29c0d');

do $$
declare agency uuid := (select id from public.organizations where slug = 'the-agency-oklahoma');
begin
  -- Skip triggers while backfilling so updated_at timestamps are not touched.
  set local session_replication_role = replica;
  update public.profiles set org_id = agency;
  update public.listings set org_id = agency;
  update public.agent_sites set org_id = agency;
  update public.leads set org_id = agency;
  update public.page_views set org_id = agency;
  update public.upcoming_listings set org_id = agency;
  update public.buyer_needs set org_id = agency;
  update public.brokerage_site set org_id = agency;
  update public.brokerage_agents set org_id = agency;
  update public.brokerage_areas set org_id = agency;
  update public.brokerage_posts set org_id = agency;
  update public.area_template_areas set org_id = agency;
end $$;
