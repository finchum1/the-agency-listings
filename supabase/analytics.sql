-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder.
--
-- Two new tables powering the dashboard's analytics stat cards (Listings
-- module + agent site editor):
--   page_views — one row per page load of a listing / agent site / agent
--     site blog post. Written ONLY by api/track-view.js using the service
--     role key — there is NO client-facing RLS policy on this table at
--     all (not even insert), so a browser can never write or read it
--     directly; only the trusted server function (which bypasses RLS)
--     can. Reads for the dashboard go through the SELECT policy below,
--     using the normal logged-in session.
--   leads — a durable, queryable copy of every contact-form submission
--     (previously these only ever existed as an outbound email — nothing
--     was stored). Written ONLY by api/contact.js and
--     api/agent-site-contact.js, same service-role pattern.

create table if not exists page_views (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing', 'agent_site', 'agent_post')),
  target_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists page_views_target_idx on page_views (target_type, target_id, created_at desc);

alter table page_views enable row level security;

-- Read: the listing/site's own agent, or an admin. Resolved by joining
-- through whichever table target_type points at — there's no single
-- direct agent_id column on page_views itself since target_id is
-- polymorphic (listing vs. agent_site vs. agent_site_posts, three
-- separate id spaces, never actually colliding in practice).
drop policy if exists "page_views_owner_admin_read" on page_views;
create policy "page_views_owner_admin_read" on page_views
  for select
  using (
    exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or (
      target_type = 'listing'
      and exists (select 1 from listings l where l.id = page_views.target_id and l.agent_id = auth.uid())
    )
    or (
      target_type = 'agent_site'
      and exists (select 1 from agent_sites s where s.id = page_views.target_id and s.agent_id = auth.uid())
    )
    or (
      target_type = 'agent_post'
      and exists (
        select 1 from agent_site_posts ap
        join agent_sites s on s.id = ap.agent_site_id
        where ap.id = page_views.target_id and s.agent_id = auth.uid()
      )
    )
  );
-- Deliberately no insert/update/delete policy — writes only ever happen
-- via the service-role key in api/track-view.js, which bypasses RLS.

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('listing', 'agent_site')),
  target_id uuid not null,
  agent_id uuid references profiles(id) on delete set null,
  name text not null,
  email text not null,
  phone text not null default '',
  message text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists leads_target_idx on leads (target_type, target_id, created_at desc);
create index if not exists leads_agent_idx on leads (agent_id, created_at desc);

alter table leads enable row level security;

drop policy if exists "leads_owner_admin_read" on leads;
create policy "leads_owner_admin_read" on leads
  for select
  using (
    auth.uid() = agent_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
-- Same as page_views: no client insert policy — only api/contact.js and
-- api/agent-site-contact.js write here, via the service role key.

alter publication supabase_realtime add table page_views;
alter publication supabase_realtime add table leads;
