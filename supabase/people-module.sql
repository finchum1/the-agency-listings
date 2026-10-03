-- People module (Leads / Pipeline / Transactions CRM), phase 1.
-- Applied via the Supabase MCP; kept here like the other one-off migrations.

-- 1. Per-agent switch, flipped by an admin on the Agents page. Independent
--    of site_access (website editing level).
alter table public.profiles
  add column if not exists people_enabled boolean not null default false;

-- 2. profiles_update_own_or_admin lets anyone update ANY column of their
--    own row, which would let an agent promote themselves to admin or turn
--    on modules for themselves. Guard the privileged columns: only an
--    admin (or the service role / SQL editor, where auth.uid() is null)
--    may change them.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return new;
  end if;
  if exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.site_access is distinct from old.site_access
     or new.people_enabled is distinct from old.people_enabled
     or new.login_enabled is distinct from old.login_enabled then
    raise exception 'Only an admin can change role, site access, People access, or login access.';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- 3. People: one row per person, moving between boards via stage_group.
create table if not exists public.people (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null,
  email text not null default '',
  phone text not null default '',
  stage_group text not null default 'lead' check (stage_group in ('lead', 'pipeline', 'transaction')),
  stage text not null default 'New',
  source text not null default '',
  next_follow_up date,
  archived boolean not null default false,
  archived_reason text not null default '',
  archived_at timestamptz,
  lead_id uuid references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists people_owner_idx on public.people (owner_id, stage_group, archived);

create table if not exists public.people_notes (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists people_notes_person_idx on public.people_notes (person_id, created_at desc);

create or replace function public.touch_people_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
drop trigger if exists touch_people_updated_at on public.people;
create trigger touch_people_updated_at before update on public.people
  for each row execute function public.touch_people_updated_at();

-- 4. Strictly private: owner only, no admin access. The owner must also
--    have the module turned on.
alter table public.people enable row level security;
alter table public.people_notes enable row level security;

drop policy if exists people_owner_all on public.people;
create policy people_owner_all on public.people
  for all
  using (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
  )
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
  );

drop policy if exists people_notes_owner_all on public.people_notes;
create policy people_notes_owner_all on public.people_notes
  for all
  using (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
  )
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.people pe where pe.id = person_id and pe.owner_id = auth.uid())
  );

-- 5. Website inquiries become Leads automatically for agents with People
--    on. Runs as the table owner (the leads insert comes from the service
--    role in api/contact.js / api/agent-site-contact.js).
create or replace function public.create_person_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_person_id uuid;
begin
  if new.agent_id is null then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.agent_id and p.people_enabled) then
    return new;
  end if;

  insert into public.people (owner_id, name, email, phone, stage_group, stage, source, next_follow_up, lead_id)
  values (new.agent_id, new.name, coalesce(new.email, ''), coalesce(new.phone, ''), 'lead', 'New',
          'Website inquiry', current_date, new.id)
  returning id into new_person_id;

  if coalesce(new.message, '') <> '' then
    insert into public.people_notes (person_id, owner_id, body)
    values (new_person_id, new.agent_id, 'Website inquiry: ' || new.message);
  end if;
  return new;
end;
$$;

drop trigger if exists create_person_from_lead on public.leads;
create trigger create_person_from_lead
  after insert on public.leads
  for each row execute function public.create_person_from_lead();
