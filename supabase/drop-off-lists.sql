-- Gift drop-off lists: pick contacts, send one private link to whoever is doing the deliveries.
-- The link page (/dropoff/<token>, served by api/drop-off.js) shows each stop's name, address and your note, with tap-for-directions
-- buttons and a "Delivered" check. It never shows phone numbers or emails: a stop is a snapshot of just a name and an address, so
-- later edits to a contact don't change a list already sent, and the link can't reach anything else about the contact.
-- Same credential model as the vendor links: the long random token in the address is the key; the public page finds a list by its hash. The agent's
-- own row also keeps the token, so they can copy the link again later.

create table if not exists public.drop_off_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token text not null, -- readable only by the agent who made the list, so the link can be copied again later
  title text not null default '' check (length(title) <= 100),
  note text not null default '' check (length(note) <= 1000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);
create index if not exists drop_off_lists_owner_idx on public.drop_off_lists (owner_id, created_at desc);

create table if not exists public.drop_off_stops (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.drop_off_lists(id) on delete cascade,
  position integer not null default 0,
  contact_id uuid references public.contacts(id) on delete set null,
  name text not null default '' check (length(name) <= 120),
  address text not null default '' check (length(address) <= 300),
  note text not null default '' check (length(note) <= 300),
  done_at timestamptz
);
create index if not exists drop_off_stops_list_idx on public.drop_off_stops (list_id, position);

alter table public.drop_off_lists enable row level security;
alter table public.drop_off_stops enable row level security;
revoke all on public.drop_off_lists from anon, authenticated;
revoke all on public.drop_off_stops from anon, authenticated;
-- token_hash is never readable by the browser; token only through the owner's own row (policy below).
grant select (id, owner_id, token, title, note, created_at, expires_at, revoked_at, last_viewed_at, view_count) on public.drop_off_lists to authenticated;
grant select on public.drop_off_stops to authenticated;

drop policy if exists drop_off_lists_owner_read on public.drop_off_lists;
create policy drop_off_lists_owner_read on public.drop_off_lists for select to authenticated using (owner_id = auth.uid());
drop policy if exists drop_off_stops_owner_read on public.drop_off_stops;
create policy drop_off_stops_owner_read on public.drop_off_stops for select to authenticated
  using (exists (select 1 from public.drop_off_lists l where l.id = list_id and l.owner_id = auth.uid()));

-- p_stops: [{ "contact_id": uuid|null, "name": "...", "address": "...", "note": "..." }, ...] in the order they should be shown.
create or replace function public.create_drop_off_list(p_title text, p_note text, p_days integer, p_stops jsonb) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_list uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in to make a drop-off list.';
  end if;
  if jsonb_typeof(p_stops) <> 'array' or jsonb_array_length(p_stops) = 0 then
    raise exception 'Pick at least one stop.';
  end if;
  if jsonb_array_length(p_stops) > 150 then
    raise exception 'A list can have up to 150 stops.';
  end if;
  if (select count(*) from public.drop_off_lists where owner_id = auth.uid() and revoked_at is null and expires_at > now()) >= 50 then
    raise exception 'You have 50 active drop-off lists. Turn some off first.';
  end if;
  v_token := 'do' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.drop_off_lists (owner_id, token_hash, token, title, note, expires_at)
  values (auth.uid(), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), v_token, left(btrim(coalesce(p_title, '')), 100), left(btrim(coalesce(p_note, '')), 1000),
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 180))))
  returning id into v_list;
  insert into public.drop_off_stops (list_id, position, contact_id, name, address, note)
  select v_list, t.n::int, c.id, left(btrim(coalesce(t.s->>'name', '')), 120), left(btrim(coalesce(t.s->>'address', '')), 300), left(btrim(coalesce(t.s->>'note', '')), 300)
  from jsonb_array_elements(p_stops) with ordinality as t(s, n)
  left join public.contacts c on c.id = nullif(t.s->>'contact_id', '')::uuid and c.owner_id = auth.uid()
  order by t.n;
  return v_token;
end;
$$;
revoke all on function public.create_drop_off_list(text, text, integer, jsonb) from public, anon;
grant execute on function public.create_drop_off_list(text, text, integer, jsonb) to authenticated;

create or replace function public.revoke_drop_off_list(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.drop_off_lists set revoked_at = coalesce(revoked_at, now()) where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.revoke_drop_off_list(uuid) from public, anon;
grant execute on function public.revoke_drop_off_list(uuid) to authenticated;

-- Turn a link back on or push its end date out (the agent's own list only).
create or replace function public.extend_drop_off_list(p_id uuid, p_days integer default 30) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.drop_off_lists
     set revoked_at = null, expires_at = now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 180)))
   where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.extend_drop_off_list(uuid, integer) from public, anon;
grant execute on function public.extend_drop_off_list(uuid, integer) to authenticated;

-- Permanently removes the agent's own list and its stops (the stops go with it). The link stops working at once.
create or replace function public.delete_drop_off_list(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  delete from public.drop_off_lists where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.delete_drop_off_list(uuid) from public, anon;
grant execute on function public.delete_drop_off_list(uuid) to authenticated;
