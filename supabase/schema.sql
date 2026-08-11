-- =====================================================================
-- The Agency Listings — database schema
-- Run this once in the Supabase SQL Editor (your project > SQL Editor >
-- New query > paste this whole file > Run). No migration CLI is used for
-- this project, same convention as debt-tracker-app and tc-dashboard-web.
-- =====================================================================

-- ---------------------------------------------------------------------
-- profiles — one row per agent/admin, mirrors auth.users 1:1
-- ---------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  title text not null default 'Real Estate Agent',
  license text not null default '',
  phone text not null default '',
  photo_url text,
  role text not null default 'agent' check (role in ('admin', 'agent')),
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Agent name/phone/email/photo need to show on public listing pages, so
-- profiles are fully public-read. Nothing sensitive lives here.
drop policy if exists "profiles_read_public" on profiles;
create policy "profiles_read_public" on profiles
  for select
  using (true);

drop policy if exists "profiles_update_own_or_admin" on profiles;
create policy "profiles_update_own_or_admin" on profiles
  for update
  using (
    auth.uid() = id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- A profile row is auto-created whenever a new auth user appears, whether
-- created via api/admin/invite-agent.js or directly in the Supabase
-- dashboard (needed to bootstrap the very first admin — see bottom of file).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agent')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- listings — the core table; a "draft" status doubles as unpublished
-- ---------------------------------------------------------------------
create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  agent_id uuid not null references profiles(id) on delete restrict,
  status text not null default 'draft'
    check (status in ('draft', 'coming_soon', 'for_sale', 'pending', 'closed', 'off_market')),
  mls_number text default '',
  address_line1 text not null,
  city text not null,
  state text not null,
  zip text not null,
  price numeric,
  beds integer,
  baths numeric,
  sqft integer,
  lot_size text default '',
  year_built text default '',
  garage text default '',
  property_type text default 'Single Family Home',
  description text[] not null default '{}',
  features jsonb not null default '[]',
  hero_video_url text,
  custom_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table listings enable row level security;

-- Public (anonymous) visitors can read any non-draft listing.
drop policy if exists "listings_public_read_published" on listings;
create policy "listings_public_read_published" on listings
  for select
  using (status <> 'draft');

-- The owning agent (or an admin) can additionally read their own drafts.
drop policy if exists "listings_owner_admin_read_all" on listings;
create policy "listings_owner_admin_read_all" on listings
  for select
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "listings_insert_own_or_admin" on listings;
create policy "listings_insert_own_or_admin" on listings
  for insert
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "listings_update_own_or_admin" on listings;
create policy "listings_update_own_or_admin" on listings
  for update
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "listings_delete_own_or_admin" on listings;
create policy "listings_delete_own_or_admin" on listings
  for delete
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists listings_set_updated_at on listings;
create trigger listings_set_updated_at
  before update on listings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- listing_photos
-- ---------------------------------------------------------------------
create table if not exists listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  url text not null,
  alt text default '',
  caption text default '',
  sort_order integer not null default 0,
  is_hero boolean not null default false,
  created_at timestamptz not null default now()
);

alter table listing_photos enable row level security;

drop policy if exists "listing_photos_public_read" on listing_photos;
create policy "listing_photos_public_read" on listing_photos
  for select
  using (
    exists (select 1 from listings l where l.id = listing_photos.listing_id and l.status <> 'draft')
  );

drop policy if exists "listing_photos_owner_admin_all" on listing_photos;
create policy "listing_photos_owner_admin_all" on listing_photos
  for all
  using (
    exists (
      select 1 from listings l
      where l.id = listing_photos.listing_id
        and (l.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from listings l
      where l.id = listing_photos.listing_id
        and (l.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- ---------------------------------------------------------------------
-- open_houses
-- ---------------------------------------------------------------------
create table if not exists open_houses (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text default '',
  created_at timestamptz not null default now()
);

alter table open_houses enable row level security;

drop policy if exists "open_houses_public_read" on open_houses;
create policy "open_houses_public_read" on open_houses
  for select
  using (
    exists (select 1 from listings l where l.id = open_houses.listing_id and l.status <> 'draft')
  );

drop policy if exists "open_houses_owner_admin_all" on open_houses;
create policy "open_houses_owner_admin_all" on open_houses
  for all
  using (
    exists (
      select 1 from listings l
      where l.id = open_houses.listing_id
        and (l.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from listings l
      where l.id = open_houses.listing_id
        and (l.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- ---------------------------------------------------------------------
-- realtime — so the dashboard live-updates across devices/agents
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table listings;
alter publication supabase_realtime add table listing_photos;
alter publication supabase_realtime add table open_houses;

-- =====================================================================
-- BOOTSTRAP THE FIRST ADMIN (run manually, once)
--
-- There's no public sign-up page in this app (accounts are invite-only),
-- so the very first account has to be created directly in Supabase:
--
-- 1. Supabase dashboard > Authentication > Users > Add user > enter your
--    email + a password, and check "Auto Confirm User". The trigger
--    above auto-creates your profiles row with role='agent'.
-- 2. Run this, with your real email, to promote yourself to admin:
--
--      update profiles set role = 'admin' where email = 'you@example.com';
--
-- After that, invite every other agent from inside the app itself
-- (Dashboard > Agents > Invite) — no one else needs this manual step.
-- =====================================================================
