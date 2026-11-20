-- Client searches: an agent's saved Home Search filters, optionally for one of their people (a buyer client). Private to the agent. The filters are
-- stored as the same query params the Home Search uses (city, minPrice, maxPrice, minBeds, minBaths, sortBy, map), so a saved search can be put back
-- on the page or turned into a link to the public Home Search.
create table if not exists public.client_searches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  name text not null check (length(btrim(name)) between 1 and 120),
  params jsonb not null default '{}'::jsonb check (jsonb_typeof(params) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists client_searches_owner_idx on public.client_searches (owner_id, created_at desc);
create index if not exists client_searches_person_idx on public.client_searches (person_id) where person_id is not null;
alter table public.client_searches enable row level security;
revoke all on public.client_searches from anon, authenticated;
grant select on public.client_searches to authenticated;
grant insert (person_id, name, params) on public.client_searches to authenticated;
grant update (person_id, name, params, updated_at) on public.client_searches to authenticated;
grant delete on public.client_searches to authenticated;
drop policy if exists client_searches_owner on public.client_searches;
create policy client_searches_owner on public.client_searches for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop trigger if exists client_searches_touch on public.client_searches;
create trigger client_searches_touch before update on public.client_searches for each row execute function public.set_updated_at();
