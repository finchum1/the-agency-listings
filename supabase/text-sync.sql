-- Text sync: texts and calls from an agent's Mac land in the History of the contacts they chose to sync (like Rechat Text).
--
-- How it works: a small Mac app the agent installs reads their own Messages and call history on their Mac. It asks api/text-sync.js which contacts
-- are switched on (contacts.text_sync), and uploads ONLY the one-to-one texts and calls with those people. Nothing else leaves the Mac.
-- The app proves who it is with a device token the agent makes in the dashboard (text_sync_devices; only a hash is stored, like the AI tokens).
-- Everything is private to the agent, like the rest of Contacts.

alter table public.contacts add column if not exists text_sync boolean not null default false;
create index if not exists contacts_text_sync_idx on public.contacts (owner_id) where text_sync;

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text', 'call')),
  direction text not null check (direction in ('in', 'out', 'missed')),
  body text not null default '' check (length(body) <= 10000),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  occurred_at timestamptz not null,
  external_id text not null check (length(external_id) between 1 and 200),
  created_at timestamptz not null default now(),
  unique (owner_id, external_id)
);
create index if not exists contact_messages_contact_idx on public.contact_messages (contact_id, occurred_at desc);

alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon;
drop policy if exists contact_messages_owner_read on public.contact_messages;
create policy contact_messages_owner_read on public.contact_messages for select to authenticated
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
drop policy if exists contact_messages_owner_delete on public.contact_messages;
create policy contact_messages_owner_delete on public.contact_messages for delete to authenticated
  using (owner_id = auth.uid());
-- Rows are written only by the sync API (service role), never straight from a browser.
revoke insert, update on public.contact_messages from authenticated;

-- A text or answered call is being in touch.
create or replace function public.contact_message_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction <> 'missed' then
    update public.contacts set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at) where id = new.contact_id;
  end if;
  return new;
end;
$$;
drop trigger if exists contact_message_touch on public.contact_messages;
create trigger contact_message_touch after insert on public.contact_messages for each row execute function public.contact_message_touch();

create table if not exists public.text_sync_devices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz,
  last_synced_at timestamptz,
  revoked_at timestamptz
);
create index if not exists text_sync_devices_owner_idx on public.text_sync_devices (owner_id, created_at desc);
alter table public.text_sync_devices enable row level security;
revoke all on public.text_sync_devices from anon, authenticated;
grant select (id, owner_id, name, token_hint, created_at, last_seen_at, last_synced_at, revoked_at) on public.text_sync_devices to authenticated;
drop policy if exists text_sync_devices_owner_read on public.text_sync_devices;
create policy text_sync_devices_owner_read on public.text_sync_devices for select to authenticated using (owner_id = auth.uid());

create or replace function public.create_text_sync_device(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled) then
    raise exception 'Contacts isn''t turned on for your account.';
  end if;
  if (select count(*) from public.text_sync_devices where owner_id = auth.uid() and revoked_at is null) >= 5 then
    raise exception 'You already have 5 Macs connected. Disconnect one first.';
  end if;
  v_token := 'ts_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.text_sync_devices (owner_id, name, token_hash, token_hint)
  values (auth.uid(), btrim(p_name), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4));
  return v_token;
end;
$$;
revoke all on function public.create_text_sync_device(text) from public, anon;
grant execute on function public.create_text_sync_device(text) to authenticated;

create or replace function public.revoke_text_sync_device(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.text_sync_devices set revoked_at = coalesce(revoked_at, now()) where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.revoke_text_sync_device(uuid) from public, anon;
grant execute on function public.revoke_text_sync_device(uuid) to authenticated;

-- For each synced contact, the newest text and call already saved, so the Mac app only sends what's newer. Used by the sync API (service role).
create or replace function public.text_sync_latest(p_owner uuid) returns table (contact_id uuid, kind text, latest timestamptz)
language sql stable security definer set search_path = public as $$
  select m.contact_id, m.kind, max(m.occurred_at) from public.contact_messages m where m.owner_id = p_owner group by m.contact_id, m.kind;
$$;
revoke all on function public.text_sync_latest(uuid) from public, anon, authenticated;
grant execute on function public.text_sync_latest(uuid) to service_role;
