-- =====================================================================
-- Agent sites: pinned blog posts and past sales.
--
-- featured_order: up to 3 blog posts an agent pins to the top of their blog page (1 = first). The home page keeps showing
--   the newest posts regardless. The unique index stops two posts sharing a slot; the check keeps it to three.
-- agent_site_sales: homes the agent has sold, shown as "Recently sold" right under their current listings. Entered by hand
--   (photo, address, price, sold date) or copied from one of their closed listings (listing_id then hides that closed listing
--   from the current-listings grid so it only shows once).
-- =====================================================================
alter table public.agent_site_posts add column if not exists featured_order smallint check (featured_order between 1 and 3);
create unique index if not exists agent_site_posts_featured_slot on public.agent_site_posts (agent_site_id, featured_order) where featured_order is not null;

create table if not exists public.agent_site_sales (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references public.agent_sites(id) on delete cascade,
  address text not null,
  city text not null default '',
  state text not null default '',
  price numeric,
  sold_on date,
  photo_url text,
  listing_id uuid references public.listings(id) on delete set null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists agent_site_sales_site on public.agent_site_sales (agent_site_id);

alter table public.agent_site_sales enable row level security;

drop policy if exists agent_site_sales_public_read on public.agent_site_sales;
create policy agent_site_sales_public_read on public.agent_site_sales for select
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_sales.agent_site_id and s.status <> 'draft'));

drop policy if exists agent_site_sales_manage on public.agent_site_sales;
create policy agent_site_sales_manage on public.agent_site_sales for all
  using (exists (select 1 from public.agent_sites s where s.id = agent_site_sales.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))))
  with check (exists (select 1 from public.agent_sites s where s.id = agent_site_sales.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id))));

alter publication supabase_realtime add table public.agent_site_sales;
