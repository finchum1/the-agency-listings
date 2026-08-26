-- =====================================================================
-- Brokerage Site — "Areas of Expertise" (neighborhood guide), mirroring
-- agent_site_areas / ServiceAreas.jsx / AreasManager.jsx exactly, just
-- without an agent_site_id (this is the office-wide list, not a
-- per-agent one). Styled after theagencyoklahoma.com/neighborhoods.
-- Applied via the Supabase MCP.
-- =====================================================================
create table if not exists brokerage_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  blurb text not null default '',
  description text not null default '',
  photo_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table brokerage_areas enable row level security;

drop policy if exists "brokerage_areas_public_read" on brokerage_areas;
create policy "brokerage_areas_public_read" on brokerage_areas
  for select
  using (exists (select 1 from brokerage_site s where s.status <> 'draft'));

drop policy if exists "brokerage_areas_admin_all" on brokerage_areas;
create policy "brokerage_areas_admin_all" on brokerage_areas
  for all
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

alter publication supabase_realtime add table brokerage_areas;
