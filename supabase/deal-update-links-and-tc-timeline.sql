-- =====================================================================
-- Deals: a coordinator can share the client timeline on a deal they coordinate (it stays branded with the deal's agent, the owner),
-- and can make a private "update" link for the agent: where the deal stands, with tasks and documents.
--
-- create_timeline_link: was owner-only; now also the coordinator of that deal (deal_person_access = 'tc').
-- deal_update_links: one row per link (token stored only as a hash, like vendor/timeline links). Read by the person who made it;
--   the public page reads through api/deal-update-link.js with the service role.
-- =====================================================================
create or replace function public.create_timeline_link(p_person_id uuid, p_message text default '', p_days integer default 120) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_token text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to share a timeline.';
  end if;
  if not exists (select 1 from public.people pe
                 where pe.id = p_person_id and pe.stage_group = 'transaction'
                   and ((pe.owner_id = auth.uid() and exists (select 1 from public.profiles pr where pr.id = pe.owner_id and pr.people_enabled))
                        or public.deal_person_access(pe.id) = 'tc')) then
    raise exception 'A timeline can only be shared for one of your own transactions or one you coordinate.';
  end if;
  if (select count(*) from public.transaction_timeline_links where person_id = p_person_id and revoked_at is null and expires_at > now()) >= 5 then
    raise exception 'This transaction has 5 active timeline links. Turn some off first.';
  end if;
  v_token := 'tl' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.transaction_timeline_links (org_id, person_id, token_hash, token_hint, message, expires_at)
  values (v_org, p_person_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), left(btrim(coalesce(p_message, '')), 600), now() + make_interval(days => greatest(1, least(coalesce(p_days, 120), 365))));
  return v_token;
end;
$$;
revoke all on function public.create_timeline_link(uuid, text, integer) from public, anon;
grant execute on function public.create_timeline_link(uuid, text, integer) to authenticated;

create table if not exists public.deal_update_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  message text not null default '' check (length(message) <= 600),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);
create index if not exists deal_update_links_person_idx on public.deal_update_links (person_id, created_at desc);
alter table public.deal_update_links enable row level security;
revoke all on public.deal_update_links from anon, authenticated;
grant select (id, org_id, person_id, created_by, token_hint, message, created_at, expires_at, revoked_at, last_viewed_at, view_count) on public.deal_update_links to authenticated;
drop policy if exists deal_update_links_read on public.deal_update_links;
create policy deal_update_links_read on public.deal_update_links for select to authenticated using (created_by = auth.uid());

create or replace function public.create_deal_update_link(p_person_id uuid, p_message text default '', p_days integer default 60) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_token text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to share an update.';
  end if;
  if public.deal_person_access(p_person_id) is distinct from 'tc' then
    raise exception 'An update link can only be made for a deal you coordinate.';
  end if;
  if (select count(*) from public.deal_update_links where person_id = p_person_id and created_by = auth.uid() and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'This deal has 10 active update links. Turn some off first.';
  end if;
  v_token := 'du' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.deal_update_links (org_id, person_id, token_hash, token_hint, message, expires_at)
  values (v_org, p_person_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), left(btrim(coalesce(p_message, '')), 600), now() + make_interval(days => greatest(1, least(coalesce(p_days, 60), 365))));
  return v_token;
end;
$$;
revoke all on function public.create_deal_update_link(uuid, text, integer) from public, anon;
grant execute on function public.create_deal_update_link(uuid, text, integer) to authenticated;

create or replace function public.revoke_deal_update_link(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.deal_update_links set revoked_at = coalesce(revoked_at, now()) where id = p_id and created_by = auth.uid();
end;
$$;
revoke all on function public.revoke_deal_update_link(uuid) from public, anon;
grant execute on function public.revoke_deal_update_link(uuid) to authenticated;
