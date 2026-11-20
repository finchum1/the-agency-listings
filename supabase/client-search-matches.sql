-- Daily matches for client searches. An agent turns on "Find new matches daily" for a saved client search (client_searches.alerts). Each morning
-- api/search-matches.js runs those searches against the MLS feed and, when homes appear that the search hasn't seen, saves them as a batch
-- (client_search_matches) for the agent to review and send to the client. NOTHING is sent to a client automatically: the agent gets one email
-- listing the new matches, and sends or dismisses each batch from Home Search. seen_mls remembers what the search has already shown.
alter table public.client_searches add column if not exists alerts boolean not null default false;
alter table public.client_searches add column if not exists seen_mls text[] not null default '{}';
alter table public.client_searches add column if not exists last_checked_at timestamptz;
grant update (alerts) on public.client_searches to authenticated;

create table if not exists public.client_search_matches (
  id uuid primary key default gen_random_uuid(),
  search_id uuid not null references public.client_searches(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listings jsonb not null default '[]'::jsonb check (jsonb_typeof(listings) = 'array'),
  total integer not null default 0,
  status text not null default 'new' check (status in ('new', 'sent', 'dismissed')),
  found_at timestamptz not null default now(),
  handled_at timestamptz
);
create index if not exists client_search_matches_owner_idx on public.client_search_matches (owner_id, found_at desc);
create index if not exists client_search_matches_search_idx on public.client_search_matches (search_id, found_at desc);
alter table public.client_search_matches enable row level security;
revoke all on public.client_search_matches from anon, authenticated;
grant select on public.client_search_matches to authenticated;
grant update (status, handled_at) on public.client_search_matches to authenticated;
grant delete on public.client_search_matches to authenticated;
drop policy if exists client_search_matches_owner on public.client_search_matches;
create policy client_search_matches_owner on public.client_search_matches for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
