-- =====================================================================
-- agent_blog_calendar — the planned schedule of blog topics behind the
-- weekday automation (api/blog-automation.js). One row per planned post;
-- the daily automated run looks up today's row, writes the actual post,
-- and marks it 'generated'. Also doubles as the history the monthly
-- regeneration reads to avoid repeating a topic/city too soon. Applied
-- via the Supabase MCP.
-- =====================================================================
create table if not exists agent_blog_calendar (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references agent_sites(id) on delete cascade,
  post_date date not null,
  pillar text not null, -- 'Neighborhood Guide' | 'Home Spotlight' | 'Restaurant Feature' | 'New Development' | 'Community Feature'
  city text,
  topic text not null,
  angle text,
  cover_photo_suggestion text,
  status text not null default 'pending' check (status in ('pending', 'generated', 'skipped')),
  generated_post_id uuid references agent_site_posts(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (agent_site_id, post_date)
);

alter table agent_blog_calendar enable row level security;

drop policy if exists "agent_blog_calendar_owner_admin_all" on agent_blog_calendar;
create policy "agent_blog_calendar_owner_admin_all" on agent_blog_calendar
  for all
  using (
    exists (
      select 1 from agent_sites s
      where s.id = agent_blog_calendar.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  )
  with check (
    exists (
      select 1 from agent_sites s
      where s.id = agent_blog_calendar.agent_site_id
        and (s.agent_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
    )
  );

alter publication supabase_realtime add table agent_blog_calendar;
