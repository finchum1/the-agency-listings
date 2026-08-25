-- =====================================================================
-- The Agency Listings — Brokerage Site schema
-- Applied via the Supabase MCP, same convention as every other file in
-- this folder — kept here for the record, not meant to be re-run by
-- hand (every statement is idempotent — drop-if-exists / if-not-exists
-- / on-conflict-do-nothing — so re-running it is harmless either way).
--
-- A single admin-editable public site for the local office itself (as
-- opposed to agent_sites, which are 1:1 per agent) — hero/about/stats,
-- a blog, and a roster of agents shown on the brokerage site. Modeled
-- directly on agent-sites-schema.sql's tables/RLS shape, minus anything
-- keyed to a specific agent (slug/theme/font/custom-domain/testimonials/
-- areas), since there's exactly one of these and it's admin-only.
-- =====================================================================

-- ---------------------------------------------------------------------
-- brokerage_site — singleton row. singleton_guard is always `true` and
-- carries a unique constraint, so a second row can never be inserted —
-- same "load or create on first visit" pattern as agent_sites, just
-- without an agent_id to key off of.
-- ---------------------------------------------------------------------
create table if not exists brokerage_site (
  id uuid primary key default gen_random_uuid(),
  singleton_guard boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  tagline text not null default '',
  hero_photo_url text,
  hero_video_url text,
  about_html text not null default '',
  stats jsonb not null default '[]', -- [{ "label": "Years Experience", "value": "10+" }]
  contact_email text not null default '',
  contact_phone text not null default '',
  instagram_url text not null default '',
  facebook_url text not null default '',
  linkedin_url text not null default '',
  seo_title text,
  seo_description text,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint brokerage_site_singleton unique (singleton_guard)
);

alter table brokerage_site enable row level security;

drop policy if exists "brokerage_site_public_read_published" on brokerage_site;
create policy "brokerage_site_public_read_published" on brokerage_site
  for select
  using (status <> 'draft');

drop policy if exists "brokerage_site_admin_read_all" on brokerage_site;
create policy "brokerage_site_admin_read_all" on brokerage_site
  for select
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "brokerage_site_admin_insert" on brokerage_site;
create policy "brokerage_site_admin_insert" on brokerage_site
  for insert
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "brokerage_site_admin_update" on brokerage_site;
create policy "brokerage_site_admin_update" on brokerage_site
  for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists "brokerage_site_admin_delete" on brokerage_site;
create policy "brokerage_site_admin_delete" on brokerage_site
  for delete
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop trigger if exists brokerage_site_set_updated_at on brokerage_site;
create trigger brokerage_site_set_updated_at
  before update on brokerage_site
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- brokerage_posts — blog posts on the brokerage site (brokerage-wide,
-- distinct from each agent's own agent_site_posts)
-- ---------------------------------------------------------------------
create table if not exists brokerage_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null default '',
  post_date date not null default current_date,
  excerpt text not null default '',
  image_url text,
  body_html text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brokerage_posts enable row level security;

drop policy if exists "brokerage_posts_public_read" on brokerage_posts;
create policy "brokerage_posts_public_read" on brokerage_posts
  for select
  using (
    status <> 'draft'
    and exists (select 1 from brokerage_site s where s.status <> 'draft')
  );

drop policy if exists "brokerage_posts_admin_all" on brokerage_posts;
create policy "brokerage_posts_admin_all" on brokerage_posts
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop trigger if exists brokerage_posts_set_updated_at on brokerage_posts;
create trigger brokerage_posts_set_updated_at
  before update on brokerage_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- brokerage_agents — the roster shown on the brokerage site. Standalone
-- from `profiles`/agent_sites on purpose — most agents on this roster
-- don't have, and don't need, a dashboard login.
-- ---------------------------------------------------------------------
create table if not exists brokerage_agents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  title text not null default '',
  license text not null default '',
  phone text not null default '',
  email text not null default '',
  photo_url text,
  specialties text[] not null default '{}',
  bio text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table brokerage_agents enable row level security;

drop policy if exists "brokerage_agents_public_read" on brokerage_agents;
create policy "brokerage_agents_public_read" on brokerage_agents
  for select
  using (exists (select 1 from brokerage_site s where s.status <> 'draft'));

drop policy if exists "brokerage_agents_admin_all" on brokerage_agents;
create policy "brokerage_agents_admin_all" on brokerage_agents
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop trigger if exists brokerage_agents_set_updated_at on brokerage_agents;
create trigger brokerage_agents_set_updated_at
  before update on brokerage_agents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- realtime — so the dashboard live-updates across devices/admins
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table brokerage_site;
alter publication supabase_realtime add table brokerage_posts;
alter publication supabase_realtime add table brokerage_agents;

-- ---------------------------------------------------------------------
-- Storage — brokerage-site-photos bucket (hero photo, post images,
-- agent headshots). Admin-only write, public read, same shape as
-- agent-sites-storage-policies.sql minus the ownership check (there's no
-- "owner" here, only admins touch this site). No manual dashboard step
-- needed first — the bucket itself is created by this migration too.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('brokerage-site-photos', 'brokerage-site-photos', true)
on conflict (id) do nothing;

drop policy if exists "brokerage_site_photos_bucket_public_read" on storage.objects;
create policy "brokerage_site_photos_bucket_public_read" on storage.objects
  for select
  using (bucket_id = 'brokerage-site-photos');

drop policy if exists "brokerage_site_photos_bucket_admin_insert" on storage.objects;
create policy "brokerage_site_photos_bucket_admin_insert" on storage.objects
  for insert
  with check (
    bucket_id = 'brokerage-site-photos'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "brokerage_site_photos_bucket_admin_delete" on storage.objects;
create policy "brokerage_site_photos_bucket_admin_delete" on storage.objects
  for delete
  using (
    bucket_id = 'brokerage-site-photos'
    and exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
