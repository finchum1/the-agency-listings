-- =====================================================================
-- The Agency Listings — agent personal-website schema
-- Run once in the Supabase SQL Editor, after schema.sql. Same convention:
-- no migration CLI for this project.
--
-- Adds the ability for an agent to have their own personal marketing
-- site (bio, testimonials, areas of expertise, blog posts) managed the
-- same way listings already are — a database row instead of a one-off
-- git repo per agent. Their "Featured Properties" section is powered
-- directly by the existing `listings` table (status <> 'draft' AND
-- agent_id = this agent), no new table needed for that.
-- =====================================================================

-- ---------------------------------------------------------------------
-- agent_sites — one row per agent's personal site (1:1 with profiles)
-- ---------------------------------------------------------------------
create table if not exists agent_sites (
  id uuid primary key default gen_random_uuid(),
  agent_id uuid not null unique references profiles(id) on delete cascade,
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published')),
  tagline text not null default '',
  region text not null default '',
  hero_photo_url text,
  hero_video_url text,
  bio text[] not null default '{}',
  stats jsonb not null default '[]', -- [{ "label": "Years Experience", "value": "10+" }]
  instagram_url text default '',
  facebook_url text default '',
  linkedin_url text default '',
  custom_domain text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table agent_sites enable row level security;

drop policy if exists "agent_sites_public_read_published" on agent_sites;
create policy "agent_sites_public_read_published" on agent_sites
  for select
  using (status <> 'draft');

drop policy if exists "agent_sites_owner_admin_read_all" on agent_sites;
create policy "agent_sites_owner_admin_read_all" on agent_sites
  for select
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "agent_sites_insert_own_or_admin" on agent_sites;
create policy "agent_sites_insert_own_or_admin" on agent_sites
  for insert
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "agent_sites_update_own_or_admin" on agent_sites;
create policy "agent_sites_update_own_or_admin" on agent_sites
  for update
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists "agent_sites_delete_own_or_admin" on agent_sites;
create policy "agent_sites_delete_own_or_admin" on agent_sites
  for delete
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop trigger if exists agent_sites_set_updated_at on agent_sites;
create trigger agent_sites_set_updated_at
  before update on agent_sites
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- Shared helper: is the current user the owner (via agent_sites) or an
-- admin? Used identically by testimonials/areas/posts below — all three
-- are simple children of agent_sites, same shape as listing_photos'
-- relationship to listings.
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- agent_site_testimonials
-- ---------------------------------------------------------------------
create table if not exists agent_site_testimonials (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references agent_sites(id) on delete cascade,
  quote text not null,
  author text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table agent_site_testimonials enable row level security;

drop policy if exists "agent_site_testimonials_public_read" on agent_site_testimonials;
create policy "agent_site_testimonials_public_read" on agent_site_testimonials
  for select
  using (
    exists (select 1 from agent_sites s where s.id = agent_site_testimonials.agent_site_id and s.status <> 'draft')
  );

drop policy if exists "agent_site_testimonials_owner_admin_all" on agent_site_testimonials;
create policy "agent_site_testimonials_owner_admin_all" on agent_site_testimonials
  for all
  using (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_testimonials.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_testimonials.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- ---------------------------------------------------------------------
-- agent_site_areas — "Areas of Expertise" / service-area cards
-- ---------------------------------------------------------------------
create table if not exists agent_site_areas (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references agent_sites(id) on delete cascade,
  slug text not null,
  name text not null,
  blurb text not null default '',
  description text not null default '',
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (agent_site_id, slug)
);

alter table agent_site_areas enable row level security;

drop policy if exists "agent_site_areas_public_read" on agent_site_areas;
create policy "agent_site_areas_public_read" on agent_site_areas
  for select
  using (
    exists (select 1 from agent_sites s where s.id = agent_site_areas.agent_site_id and s.status <> 'draft')
  );

drop policy if exists "agent_site_areas_owner_admin_all" on agent_site_areas;
create policy "agent_site_areas_owner_admin_all" on agent_site_areas
  for all
  using (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_areas.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_areas.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

-- ---------------------------------------------------------------------
-- agent_site_posts — blog posts
-- ---------------------------------------------------------------------
create table if not exists agent_site_posts (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references agent_sites(id) on delete cascade,
  slug text not null,
  title text not null,
  category text not null default '',
  post_date date not null default current_date,
  excerpt text not null default '',
  image_url text,
  body jsonb not null default '[]', -- [{ "type": "p" | "h3", "text": "…" }]
  related_listing_id uuid references listings(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (agent_site_id, slug)
);

alter table agent_site_posts enable row level security;

drop policy if exists "agent_site_posts_public_read" on agent_site_posts;
create policy "agent_site_posts_public_read" on agent_site_posts
  for select
  using (
    status <> 'draft'
    and exists (select 1 from agent_sites s where s.id = agent_site_posts.agent_site_id and s.status <> 'draft')
  );

drop policy if exists "agent_site_posts_owner_admin_all" on agent_site_posts;
create policy "agent_site_posts_owner_admin_all" on agent_site_posts
  for all
  using (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_posts.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from agent_sites s
      where s.id = agent_site_posts.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

drop trigger if exists agent_site_posts_set_updated_at on agent_site_posts;
create trigger agent_site_posts_set_updated_at
  before update on agent_site_posts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- realtime — so the dashboard live-updates across devices/agents
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table agent_sites;
alter publication supabase_realtime add table agent_site_testimonials;
alter publication supabase_realtime add table agent_site_areas;
alter publication supabase_realtime add table agent_site_posts;
