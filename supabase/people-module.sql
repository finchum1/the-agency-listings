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

-- 6. Per-agent custom column names (renaming kanban stages). `stages` is
--    { lead: [...], pipeline: [...], transaction: [...] }; any group
--    missing falls back to the defaults in src/lib/peopleStages.js.
create table if not exists public.people_settings (
  owner_id uuid primary key default auth.uid() references public.profiles(id) on delete cascade,
  stages jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.people_settings enable row level security;
drop policy if exists people_settings_owner_all on public.people_settings;
create policy people_settings_owner_all on public.people_settings
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

-- 7. Transactions (phase 2): deal details live on the same person row.
alter table public.people
  add column if not exists side text check (side in ('buyer', 'seller')),
  add column if not exists property_address text not null default '',
  add column if not exists price numeric,
  add column if not exists commission numeric,
  add column if not exists other_agent text not null default '',
  add column if not exists title_company text not null default '',
  add column if not exists lender text not null default '',
  add column if not exists contract_date date,
  add column if not exists inspection_date date,
  add column if not exists appraisal_date date,
  add column if not exists financing_deadline date,
  add column if not exists closing_date date;

-- 8. Checklists (phase 4). Templates are per agent and side; applying one
--    to a transaction copies its items into transaction_tasks so later
--    template edits never rewrite deals already in progress. A task's due
--    date = the person's <anchor> date + offset_days, unless due_override
--    is set to a specific date.
create table if not exists public.checklist_templates (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  side text not null check (side in ('buyer', 'seller')),
  sections jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, side)
);
alter table public.checklist_templates enable row level security;
drop policy if exists checklist_templates_owner_all on public.checklist_templates;
create policy checklist_templates_owner_all on public.checklist_templates
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

create table if not exists public.transaction_tasks (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  section text not null default '',
  position integer not null default 0,
  text text not null,
  anchor text not null default 'contract_date' check (anchor in ('contract_date', 'inspection_date', 'closing_date')),
  offset_days integer not null default 0,
  due_override date,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists transaction_tasks_person_idx on public.transaction_tasks (person_id, position);
alter table public.transaction_tasks enable row level security;
drop policy if exists transaction_tasks_owner_all on public.transaction_tasks;
create policy transaction_tasks_owner_all on public.transaction_tasks
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.people pe where pe.id = person_id and pe.owner_id = auth.uid())
  );

-- 9. site_access gains 'none' for agents who only use Listings / Upcoming /
--    People and have no website: 'full' | 'limited' (blog only) | 'none'.
alter table public.profiles drop constraint if exists profiles_site_access_check;
alter table public.profiles add constraint profiles_site_access_check check (site_access in ('full', 'limited', 'none'));

-- 10. (SUPERSEDED by section 11 — the live-site template below was
--     replaced with a standalone snapshot.) New agent sites start with a
--     copy of a template site's Areas of Expertise.
create table if not exists public.area_template_site (
  id boolean primary key default true check (id),
  site_id uuid not null references public.agent_sites(id) on delete cascade
);
alter table public.area_template_site enable row level security;
insert into public.area_template_site (id, site_id)
select true, id from public.agent_sites where slug = 'terrence-finchum'
on conflict (id) do nothing;

create or replace function public.copy_template_areas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agent_site_areas (agent_site_id, slug, name, blurb, description, photo_url, sort_order, stats)
  select new.id, a.slug, a.name, a.blurb, a.description, a.photo_url, a.sort_order, a.stats
  from public.agent_site_areas a
  join public.area_template_site t on t.site_id = a.agent_site_id
  where t.site_id <> new.id;
  return new;
end;
$$;

drop trigger if exists copy_template_areas on public.agent_sites;
create trigger copy_template_areas
  after insert on public.agent_sites
  for each row execute function public.copy_template_areas();

-- 11. The starting Areas of Expertise are a standalone snapshot
--     (area_template_areas), NOT tied to any agent's live site — editing
--     or deleting areas on terrence-finchum never changes what new agents
--     get, and copies are never linked back. Photos are copied by URL;
--     areas never delete the stored file, so they stay valid. RLS is on
--     with no policies: the snapshot can only be changed from SQL.
create table if not exists public.area_template_areas (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  blurb text not null default '',
  description text not null default '',
  photo_url text,
  sort_order integer not null default 0,
  stats jsonb not null default '[]'::jsonb
);
alter table public.area_template_areas enable row level security;

create or replace function public.copy_template_areas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agent_site_areas (agent_site_id, slug, name, blurb, description, photo_url, sort_order, stats)
  select new.id, t.slug, t.name, t.blurb, t.description, t.photo_url, t.sort_order, t.stats
  from public.area_template_areas t;
  return new;
end;
$$;

drop table if exists public.area_template_site;

-- 12. Per-site redirects (site_redirects): old URL -> new URL, answered with
--     a permanent 301 by middleware.js on the agent site's custom domain
--     before anything renders — for moving a site over from another
--     platform (e.g. Luxury Presence) without losing search rankings.
--     Readable by anyone (middleware reads it with the anon key; the
--     redirects are public the moment they work); writable only by the
--     site's own agent or an admin. from_path is stored lowercase with no
--     trailing slash or query; a trailing /* means "everything under".
create table if not exists public.site_redirects (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references public.agent_sites(id) on delete cascade,
  from_path text not null,
  to_path text not null,
  created_at timestamptz not null default now(),
  unique (agent_site_id, from_path)
);
create index if not exists site_redirects_site_idx on public.site_redirects (agent_site_id);
alter table public.site_redirects enable row level security;
drop policy if exists site_redirects_public_read on public.site_redirects;
create policy site_redirects_public_read on public.site_redirects for select using (true);
drop policy if exists site_redirects_owner_admin_write on public.site_redirects;
create policy site_redirects_owner_admin_write on public.site_redirects
  for all
  using (exists (select 1 from public.agent_sites s where s.id = site_redirects.agent_site_id
    and (s.agent_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))))
  with check (exists (select 1 from public.agent_sites s where s.id = site_redirects.agent_site_id
    and (s.agent_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))));

-- 13. Transaction documents: a second checklist per deal for the paperwork
--     to collect (listing/seller set vs. buyer set), shown on its own
--     "Documents" tab beside "Tasks". Same shape as the task checklist but
--     with no due dates, and kept in separate tables so the overdue/follow-up
--     views on the People overview (which read transaction_tasks) are
--     untouched. document_templates holds the agent's saved list per side;
--     applying one to a deal copies it into transaction_documents.
create table if not exists public.document_templates (
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  side text not null check (side in ('buyer', 'seller')),
  sections jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (owner_id, side)
);
alter table public.document_templates enable row level security;
drop policy if exists document_templates_owner_all on public.document_templates;
create policy document_templates_owner_all on public.document_templates
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

create table if not exists public.transaction_documents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  section text not null default '',
  position integer not null default 0,
  text text not null,
  done boolean not null default false,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists transaction_documents_person_idx on public.transaction_documents (person_id, position);
alter table public.transaction_documents enable row level security;
drop policy if exists transaction_documents_owner_all on public.transaction_documents;
create policy transaction_documents_owner_all on public.transaction_documents
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.people pe where pe.id = person_id and pe.owner_id = auth.uid())
  );

-- 14. A repeat website inquiry from someone already in People (matched by
--     email, ignoring case) no longer creates a second card. It adds a note
--     to their existing card, sets the follow-up to today, fills in a
--     missing phone number, and brings the card back if it was archived.
--     Their stage is never changed. New contacts work exactly as in 5.
create or replace function public.create_person_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_person_id uuid;
  existing_id uuid;
begin
  if new.agent_id is null then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.agent_id and p.people_enabled) then
    return new;
  end if;

  if coalesce(new.email, '') <> '' then
    select pe.id into existing_id
    from public.people pe
    where pe.owner_id = new.agent_id and lower(pe.email) = lower(new.email)
    order by pe.archived, pe.created_at
    limit 1;
  end if;

  if existing_id is not null then
    update public.people
    set next_follow_up = current_date,
        phone = case when phone = '' then coalesce(new.phone, '') else phone end,
        archived = false,
        archived_reason = '',
        archived_at = null
    where id = existing_id;

    insert into public.people_notes (person_id, owner_id, body)
    values (existing_id, new.agent_id,
            case when coalesce(new.message, '') <> ''
                 then 'Website inquiry (repeat): ' || new.message
                 else 'Website inquiry (repeat), no message' end);
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

-- 15. Agent sites: button shape. "square" (original) or "pill" (fully rounded
--     buttons and tags across the public site). Picked in the Site editor
--     next to Header style; applied by [data-buttons="pill"] .as-btn in index.css.
alter table public.agent_sites
  add column if not exists button_style text not null default 'square';
alter table public.agent_sites drop constraint if exists agent_sites_button_style_check;
alter table public.agent_sites add constraint agent_sites_button_style_check check (button_style in ('square', 'pill'));

-- 16. General tasks (dashboard home page): one-off and recurring to-dos with due dates. Strictly private to the agent
--     who owns them, like People: no admin, organization or platform access (the owner-only policy below is the whole
--     rule). A recurring task is one row: completing it moves due_date to the next occurrence (the app computes it from
--     series_start, the date the repeat was set up on, so "monthly from the 31st" never drifts) and stamps
--     last_done_at. A one-off task is marked done/done_at.
create table if not exists public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (length(btrim(title)) between 1 and 300),
  due_date date,
  recurrence text not null default 'none'
    check (recurrence in ('none', 'daily', 'weekdays', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  series_start date,
  done boolean not null default false,
  done_at timestamptz,
  last_done_at timestamptz,
  created_at timestamptz not null default now(),
  constraint agent_tasks_recurring_needs_date check (recurrence = 'none' or due_date is not null)
);
create index if not exists agent_tasks_owner_idx on public.agent_tasks (owner_id, done, due_date);
alter table public.agent_tasks enable row level security;
revoke all on public.agent_tasks from anon;
drop policy if exists agent_tasks_owner_all on public.agent_tasks;
create policy agent_tasks_owner_all on public.agent_tasks
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 17. A lead or pipeline contact can be a buyer, a seller, or both (shown as a tag on their board card). Transactions
--     stay buyer or seller: a deal is one side, and the checklists are per side. The app clears "both" when someone
--     is moved into Transactions, so they pick the side for that deal.
alter table public.people drop constraint if exists people_side_check;
alter table public.people add constraint people_side_check check (side in ('buyer', 'seller', 'both'));

-- 18. Dashboard home page: calendars and goals.
--     agent_calendars: the calendars an agent has linked to their schedule, by each calendar's private iCal address
--     (Google Calendar: Settings > Integrate calendar > "Secret address in iCal format"). The address is a credential,
--     so the rows are strictly private to the agent (no admin, organization or platform access) and the dashboard only
--     ever lists id/name/color; the server (api/calendar.js) reads the address as the signed-in agent to fetch events.
--     people_settings.goals: the agent's yearly targets for the home page scorecard, { "2026": { commission, deals } }.
create table if not exists public.agent_calendars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  ics_url text not null check (ics_url ~ '^https://[^[:space:]]+$' and length(ics_url) <= 2000),
  color text not null default '#ed2127' check (color ~* '^#[0-9a-f]{6}$'),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists agent_calendars_owner_idx on public.agent_calendars (owner_id);
alter table public.agent_calendars enable row level security;
revoke all on public.agent_calendars from anon;
drop policy if exists agent_calendars_owner_all on public.agent_calendars;
create policy agent_calendars_owner_all on public.agent_calendars
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create or replace function public.limit_agent_calendars() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if (select count(*) from public.agent_calendars where owner_id = new.owner_id) >= 10 then
    raise exception 'You can link up to 10 calendars' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
drop trigger if exists limit_agent_calendars on public.agent_calendars;
create trigger limit_agent_calendars before insert on public.agent_calendars
  for each row execute function public.limit_agent_calendars();

alter table public.people_settings add column if not exists goals jsonb not null default '{}'::jsonb;

-- 19. Inquiry alerts on the home page. The `leads` row is the permanent record of a website inquiry (analytics count it),
--     so it is never deleted along with the person it created in People. Instead a lead is "dismissed": automatically
--     when that person is deleted, or by hand with the dismiss button (an agent can't update `leads` directly, so the
--     function below does it, only for their own leads). Dismissed leads stop appearing on the home page and nowhere else.
alter table public.leads add column if not exists dismissed_at timestamptz;

create or replace function public.dismiss_lead_when_person_deleted() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if old.lead_id is not null then
    update public.leads set dismissed_at = coalesce(dismissed_at, now()) where id = old.lead_id;
  end if;
  return old;
end;
$$;
drop trigger if exists dismiss_lead_when_person_deleted on public.people;
create trigger dismiss_lead_when_person_deleted after delete on public.people
  for each row execute function public.dismiss_lead_when_person_deleted();

create or replace function public.dismiss_lead_alert(p_lead uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  update public.leads set dismissed_at = coalesce(dismissed_at, now()) where id = p_lead and agent_id = auth.uid();
end;
$$;
revoke all on function public.dismiss_lead_alert(uuid) from public, anon;
grant execute on function public.dismiss_lead_alert(uuid) to authenticated;

-- One-time cleanup: for agents who use People, an inquiry with no person behind it was deleted from People already.
update public.leads l
set dismissed_at = now()
where l.dismissed_at is null
  and l.agent_id in (select id from public.profiles where people_enabled)
  and not exists (select 1 from public.people pe where pe.lead_id = l.id);

-- 20. Google accounts for two-way calendar sync (dashboard home page).
--     google_connections: which Google accounts an agent has connected (email + status only; the agent can read their
--       own rows; only the server, with the service key, creates or changes them).
--     google_tokens: the long-lived refresh tokens, ENCRYPTED by the server (AES-256-GCM). Nobody but the server can read
--       this table: row-level security with no policy at all, and no privileges for the signed-in roles.
--     agent_calendars gains a source: 'ics' (a private iCal address, read-only, as before) or 'google' (a calendar from a
--       connected account: events are read live from Google and can be created, changed and deleted from the dashboard).
create table if not exists public.google_connections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null check (length(email) <= 320),
  status text not null default 'active' check (status in ('active', 'needs_reconnect')),
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);
alter table public.google_connections enable row level security;
revoke all on public.google_connections from anon;
revoke insert, update, delete on public.google_connections from authenticated;
drop policy if exists google_connections_owner_read on public.google_connections;
create policy google_connections_owner_read on public.google_connections for select to authenticated using (owner_id = auth.uid());

create table if not exists public.google_tokens (
  connection_id uuid primary key references public.google_connections(id) on delete cascade,
  refresh_token_enc text not null,
  scopes text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.google_tokens enable row level security;
revoke all on public.google_tokens from anon, authenticated;

alter table public.agent_calendars add column if not exists source text not null default 'ics' check (source in ('ics', 'google'));
alter table public.agent_calendars add column if not exists connection_id uuid references public.google_connections(id) on delete cascade;
alter table public.agent_calendars add column if not exists google_calendar_id text check (length(google_calendar_id) <= 500);
alter table public.agent_calendars add column if not exists can_write boolean not null default false;
alter table public.agent_calendars alter column ics_url drop not null;
alter table public.agent_calendars drop constraint if exists agent_calendars_ics_url_check;
alter table public.agent_calendars drop constraint if exists agent_calendars_source_check_rule;
alter table public.agent_calendars add constraint agent_calendars_source_check_rule check (
  (source = 'ics' and ics_url is not null and ics_url ~ '^https://[^[:space:]]+$' and length(ics_url) <= 2000 and connection_id is null)
  or (source = 'google' and ics_url is null and connection_id is not null and google_calendar_id is not null)
);
create unique index if not exists agent_calendars_google_unique on public.agent_calendars (connection_id, google_calendar_id) where source = 'google';

-- A calendar may only point at a Google connection its own agent owns (otherwise someone could ask the server to read
-- another agent's calendar). The server checks this again before every Google call.
drop policy if exists agent_calendars_owner_all on public.agent_calendars;
create policy agent_calendars_owner_all on public.agent_calendars
  for all to authenticated
  using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (connection_id is null or exists (select 1 from public.google_connections gc where gc.id = connection_id and gc.owner_id = auth.uid()))
  );

-- 21. Board order. Cards used to sort by follow-up date only; an agent can now drag a card anywhere in a column.
--     board_position is the card's place in its column (1, 2, 3...). A card with none yet (new, or never ordered) shows at
--     the top of its column by follow-up date, so new people are seen first. move_person() saves a whole column's order
--     in one call. A person who changes column any other way (the card panel, "Move to Pipeline", archiving) loses their
--     old position, which meant a place in a different column.
alter table public.people add column if not exists board_position integer check (board_position is null or board_position between 1 and 100000);

create or replace function public.reset_board_position()
returns trigger language plpgsql as $$
begin
  if (new.stage is distinct from old.stage or new.stage_group is distinct from old.stage_group)
     and coalesce(current_setting('app.keep_board_position', true), '') <> 'on' then
    new.board_position := null;
  end if;
  return new;
end;
$$;
drop trigger if exists reset_board_position on public.people;
create trigger reset_board_position before update on public.people
  for each row execute function public.reset_board_position();

-- Moves one person into a column and saves that column's order: p_ordered is every person in the column, top to bottom,
-- including the one being moved. Runs as the caller, so the usual rules apply (only their own people).
create or replace function public.move_person(p_person uuid, p_stage text, p_ordered uuid[])
returns void language plpgsql security invoker set search_path = public as $$
declare
  grp text;
  n int;
begin
  if p_person is null or p_stage is null or btrim(p_stage) = '' or p_ordered is null
     or not (p_person = any (p_ordered)) or array_length(p_ordered, 1) > 2000 then
    raise exception 'move_person: invalid arguments';
  end if;
  select stage_group into grp from public.people where id = p_person and not archived;
  if grp is null then
    raise exception 'move_person: person not found';
  end if;
  -- everyone listed must be the person being moved, or already in the target column of the same board
  select count(*) into n from public.people
   where id = any (p_ordered) and not archived
     and (id = p_person or (stage = p_stage and stage_group = grp));
  if n <> array_length(p_ordered, 1) or (select count(distinct x) from unnest(p_ordered) x) <> array_length(p_ordered, 1) then
    raise exception 'move_person: those people are not all in this column';
  end if;
  perform set_config('app.keep_board_position', 'on', true);
  update public.people p
     set stage = case when p.id = p_person then p_stage else p.stage end,
         board_position = o.ord::int
    from unnest(p_ordered) with ordinality as o(id, ord)
   where p.id = o.id;
  perform set_config('app.keep_board_position', '', true);
end;
$$;
revoke all on function public.move_person(uuid, text, uuid[]) from public, anon;
grant execute on function public.move_person(uuid, text, uuid[]) to authenticated;

-- 22. Time blocking. A task with a date can also have a start time and a length, which puts it on the hourly schedule
--     as a block. Both stay null for an ordinary to-do. Repeating tasks keep their time when they roll to the next date.
alter table public.agent_tasks add column if not exists start_time time;
alter table public.agent_tasks add column if not exists duration_min integer;
alter table public.agent_tasks drop constraint if exists agent_tasks_duration_check;
alter table public.agent_tasks add constraint agent_tasks_duration_check
  check (duration_min is null or duration_min between 5 and 1440);

-- 23. Task lists and checklists. `list` is a flat label an agent types in ("Clients", "Listings"...); the home page can
--     filter by it. `checklist` is the steps inside one task: [{ id, text, done }]. A repeating task's steps are unticked
--     again when it rolls to its next date (done in the app).
alter table public.agent_tasks add column if not exists list text;
alter table public.agent_tasks add column if not exists checklist jsonb not null default '[]'::jsonb;
alter table public.agent_tasks drop constraint if exists agent_tasks_list_check;
alter table public.agent_tasks add constraint agent_tasks_list_check check (list is null or length(btrim(list)) between 1 and 40);
alter table public.agent_tasks drop constraint if exists agent_tasks_checklist_check;
alter table public.agent_tasks add constraint agent_tasks_checklist_check
  check (jsonb_typeof(checklist) = 'array' and jsonb_array_length(checklist) <= 50);

-- 24. Website layouts. `theme` (classic, dark, sand, red, linen) only changes colors; `layout` changes how the home
--     page and its sections are arranged. 'classic' is the original look and stays the default, so nobody's site
--     changes until an agent (or an admin) picks another layout.
alter table public.agent_sites add column if not exists layout text not null default 'classic';
alter table public.agent_sites drop constraint if exists agent_sites_layout_check;
alter table public.agent_sites add constraint agent_sites_layout_check check (layout in ('classic', 'editorial', 'bold'));

-- 25. Two more website layouts: 'portrait' (Portrait split) and 'listings' (Listings first).
alter table public.agent_sites drop constraint if exists agent_sites_layout_check;
alter table public.agent_sites add constraint agent_sites_layout_check check (layout in ('classic', 'editorial', 'bold', 'portrait', 'listings'));

-- 26. Property (listing) sites can use the floating pill header too, like agent sites do (agent_sites.header_style).
alter table public.listings add column if not exists header_style text not null default 'classic';
alter table public.listings drop constraint if exists listings_header_style_check;
alter table public.listings add constraint listings_header_style_check check (header_style in ('classic', 'floating'));

-- 27. A short label (a neighborhood or city) shown next to the logo in a property site's header, typed in the back office.
alter table public.listings add column if not exists header_label text;
alter table public.listings drop constraint if exists listings_header_label_check;
alter table public.listings add constraint listings_header_label_check check (header_label is null or length(header_label) <= 40);

-- 28. Personal access tokens for the Claude connection (api/mcp.js). The token itself is shown once when it is made and
--     only its SHA-256 hash is stored, so a database leak can't be used to connect. Only an admin can make one for now;
--     the connection reads data as that person, through the same row-level rules as the dashboard.
create table if not exists public.mcp_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table public.mcp_tokens enable row level security;
revoke all on public.mcp_tokens from anon, authenticated;
-- The hash column is never readable by the browser; the list shows the rest.
grant select (id, owner_id, name, token_hint, created_at, last_used_at, revoked_at) on public.mcp_tokens to authenticated;
drop policy if exists mcp_tokens_owner_read on public.mcp_tokens;
create policy mcp_tokens_owner_read on public.mcp_tokens for select to authenticated using (owner_id = auth.uid());

create or replace function public.create_mcp_token(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an admin can create a Claude connection token.';
  end if;
  if (select count(*) from public.mcp_tokens where owner_id = auth.uid() and revoked_at is null) >= 10 then
    raise exception 'You already have 10 active tokens. Revoke one first.';
  end if;
  v_token := 'lp_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.mcp_tokens (owner_id, name, token_hash, token_hint)
  values (auth.uid(), btrim(p_name), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4));
  return v_token;
end;
$$;
revoke all on function public.create_mcp_token(text) from public, anon;
grant execute on function public.create_mcp_token(text) to authenticated;

create or replace function public.revoke_mcp_token(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.mcp_tokens set revoked_at = coalesce(revoked_at, now()) where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.revoke_mcp_token(uuid) from public, anon;
grant execute on function public.revoke_mcp_token(uuid) to authenticated;

-- 29. Bot API (api/bots.js, served at /v1/...). Scoped personal tokens for automation (for example Grok bots): each token
--     gets only the scopes it needs ('blog', 'agents', 'sites', 'listings'), so one bot can write blog posts and nothing
--     else. Like the Claude tokens: shown once, only the SHA-256 hash is kept, admin-only, revocable. Every call a token
--     makes is logged in api_audit_log.
create table if not exists public.api_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  scopes text[] not null,
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint api_tokens_scopes_check check (scopes <@ array['blog', 'agents', 'sites', 'listings']::text[] and cardinality(scopes) > 0)
);
alter table public.api_tokens enable row level security;
revoke all on public.api_tokens from anon, authenticated;
grant select (id, owner_id, name, scopes, token_hint, created_at, last_used_at, revoked_at) on public.api_tokens to authenticated;
drop policy if exists api_tokens_owner_read on public.api_tokens;
create policy api_tokens_owner_read on public.api_tokens for select to authenticated using (owner_id = auth.uid());

create table if not exists public.api_audit_log (
  id bigint generated always as identity primary key,
  token_id uuid references public.api_tokens(id) on delete set null,
  owner_id uuid,
  method text not null,
  path text not null,
  status integer not null,
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists api_audit_log_token_idx on public.api_audit_log (token_id, created_at desc);
alter table public.api_audit_log enable row level security;
revoke all on public.api_audit_log from anon, authenticated;
grant select on public.api_audit_log to authenticated;
drop policy if exists api_audit_log_owner_read on public.api_audit_log;
create policy api_audit_log_owner_read on public.api_audit_log for select to authenticated using (owner_id = auth.uid());

create or replace function public.create_api_token(p_name text, p_scopes text[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an admin can create an API token.';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 or not (p_scopes <@ array['blog', 'agents', 'sites', 'listings']::text[]) then
    raise exception 'Choose at least one valid scope.';
  end if;
  if (select count(*) from public.api_tokens where owner_id = auth.uid() and revoked_at is null) >= 20 then
    raise exception 'You already have 20 active API tokens. Revoke one first.';
  end if;
  v_token := 'lp_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.api_tokens (owner_id, name, scopes, token_hash, token_hint)
  values (auth.uid(), btrim(p_name), p_scopes, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4));
  return v_token;
end;
$$;
revoke all on function public.create_api_token(text, text[]) from public, anon;
grant execute on function public.create_api_token(text, text[]) to authenticated;

create or replace function public.revoke_api_token(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.api_tokens set revoked_at = coalesce(revoked_at, now()) where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.revoke_api_token(uuid) from public, anon;
grant execute on function public.revoke_api_token(uuid) to authenticated;

-- 30. Template comparison share links. An agent whose site is still a draft (or who can't log in yet) can open
--     /preview/<token> to see their own site in every layout and color theme and tell us which they like. The token is
--     shown once when the link is made and only its SHA-256 hash is stored. A link expires, can be revoked, and only the
--     site's owner or an admin of its organization can make one. api/site-preview.js (service role) serves the draft site's
--     data to a valid token; the browser never reads these rows' hashes.
create table if not exists public.site_preview_links (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid not null references public.agent_sites(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  picked_layout text,
  picked_theme text,
  picked_at timestamptz
);
create index if not exists site_preview_links_site_idx on public.site_preview_links (agent_site_id, created_at desc);
alter table public.site_preview_links enable row level security;
revoke all on public.site_preview_links from anon, authenticated;
grant select (id, agent_site_id, created_by, token_hint, created_at, expires_at, revoked_at, last_viewed_at, picked_layout, picked_theme, picked_at) on public.site_preview_links to authenticated;
drop policy if exists site_preview_links_manager_read on public.site_preview_links;
create policy site_preview_links_manager_read on public.site_preview_links for select to authenticated using (
  exists (select 1 from public.agent_sites s where s.id = site_preview_links.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id)))
);

create or replace function public.create_site_preview_link(p_site uuid, p_days integer default 30) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
  v_site public.agent_sites%rowtype;
begin
  select * into v_site from public.agent_sites where id = p_site;
  if v_site.id is null or auth.uid() is null or not (v_site.agent_id = auth.uid() or public.can_manage_org(v_site.org_id)) then
    raise exception 'You can''t share this site.';
  end if;
  if (select count(*) from public.site_preview_links where agent_site_id = p_site and revoked_at is null and expires_at > now()) >= 10 then
    raise exception 'This site already has 10 active share links. Revoke one first.';
  end if;
  v_token := 'pv' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.site_preview_links (agent_site_id, token_hash, token_hint, expires_at)
  values (p_site, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 90))));
  return v_token;
end;
$$;
revoke all on function public.create_site_preview_link(uuid, integer) from public, anon;
grant execute on function public.create_site_preview_link(uuid, integer) to authenticated;

create or replace function public.revoke_site_preview_link(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.site_preview_links l set revoked_at = coalesce(l.revoked_at, now())
  where l.id = p_id and exists (select 1 from public.agent_sites s where s.id = l.agent_site_id and (s.agent_id = auth.uid() or public.can_manage_org(s.org_id)));
end;
$$;
revoke all on function public.revoke_site_preview_link(uuid) from public, anon;
grant execute on function public.revoke_site_preview_link(uuid) to authenticated;

-- 31. Vendors: the office's preferred vendors and contractors, one list per organization. Every signed-in member of the
--     organization can read it; only its admins can add, change or delete vendors. An agent can also turn a hand-picked set of
--     vendors into a private link for a client (vendor_share_links). The link page is served by api/vendor-share.js with the
--     service role, so a client never needs to sign in.
create table if not exists public.vendors (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  category text not null check (length(btrim(category)) between 1 and 60),
  name text not null check (length(btrim(name)) between 1 and 160),
  contact_name text not null default '' check (length(contact_name) <= 120),
  phone text not null default '' check (length(phone) <= 40),
  email text not null default '' check (length(email) <= 200),
  website text not null default '' check (length(website) <= 300),
  notes text not null default '' check (length(notes) <= 1000),
  created_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists vendors_org_category_idx on public.vendors (org_id, lower(category), lower(name));
alter table public.vendors enable row level security;
drop policy if exists vendors_member_read on public.vendors;
create policy vendors_member_read on public.vendors for select to authenticated using (org_id = public.current_org_id() or public.is_platform_admin());
drop policy if exists vendors_admin_write on public.vendors;
create policy vendors_admin_write on public.vendors for all to authenticated using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));
drop trigger if exists vendors_touch on public.vendors;
create trigger vendors_touch before update on public.vendors for each row execute function public.set_updated_at();

create table if not exists public.vendor_share_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  title text not null default '' check (length(title) <= 100),
  vendor_ids uuid[] not null check (cardinality(vendor_ids) between 1 and 80),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);
create index if not exists vendor_share_links_owner_idx on public.vendor_share_links (created_by, created_at desc);
alter table public.vendor_share_links enable row level security;
revoke all on public.vendor_share_links from anon, authenticated;
grant select (id, org_id, created_by, token_hint, title, vendor_ids, created_at, expires_at, revoked_at, last_viewed_at, view_count) on public.vendor_share_links to authenticated;
drop policy if exists vendor_share_links_owner_read on public.vendor_share_links;
create policy vendor_share_links_owner_read on public.vendor_share_links for select to authenticated using (created_by = auth.uid());

create or replace function public.create_vendor_share_link(p_vendor_ids uuid[], p_title text default '', p_days integer default 90) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_token text;
  v_ids uuid[];
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to share vendors.';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_vendor_ids) x;
  if cardinality(v_ids) = 0 then
    raise exception 'Pick at least one vendor.';
  end if;
  if (select count(*) from public.vendors where id = any(v_ids) and org_id = v_org) <> cardinality(v_ids) then
    raise exception 'Some of those vendors aren''t in your office''s list.';
  end if;
  if (select count(*) from public.vendor_share_links where created_by = auth.uid() and revoked_at is null and expires_at > now()) >= 100 then
    raise exception 'You have 100 active vendor links. Revoke some first.';
  end if;
  v_token := 'vs' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.vendor_share_links (org_id, token_hash, token_hint, title, vendor_ids, expires_at)
  values (v_org, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), left(btrim(coalesce(p_title, '')), 100), v_ids, now() + make_interval(days => greatest(1, least(coalesce(p_days, 90), 365))));
  return v_token;
end;
$$;
revoke all on function public.create_vendor_share_link(uuid[], text, integer) from public, anon;
grant execute on function public.create_vendor_share_link(uuid[], text, integer) to authenticated;

create or replace function public.revoke_vendor_share_link(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.vendor_share_links set revoked_at = coalesce(revoked_at, now()) where id = p_id and created_by = auth.uid();
end;
$$;
revoke all on function public.revoke_vendor_share_link(uuid) from public, anon;
grant execute on function public.revoke_vendor_share_link(uuid) to authenticated;

-- ============================================================================
-- 32. Property-site analytics: who visited, from where, on what device, how long, and what they looked at.
--     page_views gains optional visit details (written only by api/track-view.js, as before). listing_events records the
--     things a buyer does on a listing site. listing_analytics() rolls one listing's numbers up for the dashboard and for the
--     private seller report links (listing_report_links), which api/listing-report.js serves without a sign-in.
-- ============================================================================
alter table public.page_views
  add column if not exists visitor_id text,
  add column if not exists session_id text,
  add column if not exists source text,
  add column if not exists referrer_host text,
  add column if not exists device text,
  add column if not exists country text,
  add column if not exists region text,
  add column if not exists city text,
  add column if not exists duration_sec integer,
  add column if not exists max_depth smallint;

create table if not exists public.listing_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  view_id uuid,
  visitor_id text,
  type text not null check (type in ('gallery_open', 'photo_view', 'phone_click', 'email_click', 'form_start', 'section')),
  detail text check (length(detail) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists listing_events_listing_idx on public.listing_events (listing_id, created_at desc);
create index if not exists listing_events_view_idx on public.listing_events (view_id);
alter table public.listing_events enable row level security;
revoke all on public.listing_events from anon, authenticated;
grant select on public.listing_events to authenticated;
drop policy if exists listing_events_read on public.listing_events;
create policy listing_events_read on public.listing_events for select to authenticated
  using (public.can_manage_org(org_id) or exists (select 1 from public.listings l where l.id = listing_events.listing_id and l.agent_id = auth.uid()));

create or replace function public.listing_events_set_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.listings where id = new.listing_id;
  return new;
end;
$$;
drop trigger if exists set_org_id on public.listing_events;
create trigger set_org_id before insert on public.listing_events for each row execute function public.listing_events_set_org();

-- One listing's numbers for the last p_days days. SECURITY INVOKER: a signed-in caller only sees what row-level security lets
-- them read (their own listings, or any in an organization they manage); the seller-report API calls it with the service role
-- after checking the link's token.
create or replace function public.listing_analytics(p_listing_id uuid, p_days integer default 30, p_tz text default 'America/Chicago') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 730));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 730)));
  v_chart integer := least(greatest(1, least(coalesce(p_days, 30), 730)), 90);
  r jsonb;
begin
  with pv as (
    select id, coalesce(visitor_id, id::text) as vid, session_id, source, referrer_host, device, country, region, city, duration_sec, max_depth, created_at
    from public.page_views where target_type = 'listing' and target_id = p_listing_id and created_at >= v_since
  ), ev as (
    select view_id, type, detail from public.listing_events where listing_id = p_listing_id and created_at >= v_since
  ), days as (
    select d::date as day from generate_series((now() at time zone p_tz)::date - (v_chart - 1), (now() at time zone p_tz)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'days', v_days,
    'views', (select count(*) from pv),
    'visitors', (select count(distinct vid) from pv),
    'returning', (select count(*) from (select vid from pv group by vid having count(distinct coalesce(session_id, id::text)) > 1) t),
    'avg_duration', (select round(avg(duration_sec))::int from pv where duration_sec between 3 and 3600),
    'avg_depth', (select round(avg(max_depth))::int from pv where max_depth is not null),
    'tracked_views', (select count(*) from pv where session_id is not null),
    'detail_since', (select min(created_at) from public.page_views where target_type = 'listing' and target_id = p_listing_id and session_id is not null),
    'leads', (select count(*) from public.leads where target_type = 'listing' and target_id = p_listing_id and created_at >= v_since),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', days.day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by days.day)
      from days left join (select (created_at at time zone p_tz)::date as day, count(*) as views, count(distinct vid) as visitors from pv group by 1) x on x.day = days.day), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t order by t.views desc) from (select coalesce(source, 'direct') as source, count(*) as views, count(distinct vid) as visitors from pv group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(t order by t.views desc) from (select referrer_host, count(*) as views from pv where source = 'referral' and referrer_host is not null group by 1 order by 2 desc limit 8) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t order by t.views desc) from (select coalesce(device, 'unknown') as device, count(*) as views from pv group by 1) t), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(t order by t.views desc) from (select city, region, country, count(*) as views, count(distinct vid) as visitors from pv where city is not null group by 1, 2, 3 order by 4 desc limit 10) t), '[]'::jsonb),
    'regions', coalesce((select jsonb_agg(t order by t.views desc) from (select region, country, count(*) as views from pv where region is not null group by 1, 2 order by 3 desc limit 8) t), '[]'::jsonb),
    'engagement', jsonb_build_object(
      'gallery_opens', (select count(distinct view_id) from ev where type = 'gallery_open'),
      'photo_views', (select count(*) from ev where type = 'photo_view'),
      'phone_clicks', (select count(distinct view_id) from ev where type = 'phone_click'),
      'email_clicks', (select count(distinct view_id) from ev where type = 'email_click'),
      'form_starts', (select count(distinct view_id) from ev where type = 'form_start'),
      'sections', coalesce((select jsonb_object_agg(detail, n) from (select detail, count(distinct view_id) as n from ev where type = 'section' group by 1) s), '{}'::jsonb)
    )
  ) into r;
  return r;
end;
$$;
revoke all on function public.listing_analytics(uuid, integer, text) from public, anon;
grant execute on function public.listing_analytics(uuid, integer, text) to authenticated, service_role;

-- Private, no-sign-in report links for a seller (token stored only as a hash, like the other share links).
create table if not exists public.listing_report_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  token_hint text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0
);
create index if not exists listing_report_links_listing_idx on public.listing_report_links (listing_id, created_at desc);
alter table public.listing_report_links enable row level security;
revoke all on public.listing_report_links from anon, authenticated;
grant select (id, org_id, listing_id, created_by, token_hint, created_at, expires_at, revoked_at, last_viewed_at, view_count) on public.listing_report_links to authenticated;
drop policy if exists listing_report_links_read on public.listing_report_links;
create policy listing_report_links_read on public.listing_report_links for select to authenticated
  using (created_by = auth.uid() or public.can_manage_org(org_id));

create or replace function public.create_listing_report_link(p_listing_id uuid, p_days integer default 180) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid;
  v_token text;
begin
  select org_id into v_org from public.listings l
   where l.id = p_listing_id and (l.agent_id = auth.uid() or public.can_manage_org(l.org_id));
  if auth.uid() is null or v_org is null then
    raise exception 'You can only share reports for your own listings.';
  end if;
  if (select count(*) from public.listing_report_links where listing_id = p_listing_id and revoked_at is null and expires_at > now()) >= 20 then
    raise exception 'This listing has 20 active report links. Turn some off first.';
  end if;
  v_token := 'lr' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.listing_report_links (org_id, listing_id, token_hash, token_hint, expires_at)
  values (v_org, p_listing_id, encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), now() + make_interval(days => greatest(1, least(coalesce(p_days, 180), 365))));
  return v_token;
end;
$$;
revoke all on function public.create_listing_report_link(uuid, integer) from public, anon;
grant execute on function public.create_listing_report_link(uuid, integer) to authenticated;

create or replace function public.revoke_listing_report_link(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.listing_report_links set revoked_at = coalesce(revoked_at, now())
   where id = p_id and (created_by = auth.uid() or public.can_manage_org(org_id));
end;
$$;
revoke all on function public.revoke_listing_report_link(uuid) from public, anon;
grant execute on function public.revoke_listing_report_link(uuid) to authenticated;

-- ============================================================================
-- 33. Agent-site analytics: the same visit details as property sites (page_views.page, site_events, site_analytics()).
-- ============================================================================
alter table public.page_views add column if not exists page text;

create table if not exists public.site_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.agent_sites(id) on delete cascade,
  view_id uuid,
  visitor_id text,
  type text not null check (type in ('phone_click', 'email_click', 'form_start', 'section', 'listing_click', 'social_click', 'blog_click')),
  detail text check (length(detail) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists site_events_site_idx on public.site_events (site_id, created_at desc);
create index if not exists site_events_view_idx on public.site_events (view_id);
alter table public.site_events enable row level security;
revoke all on public.site_events from anon, authenticated;
grant select on public.site_events to authenticated;
drop policy if exists site_events_read on public.site_events;
create policy site_events_read on public.site_events for select to authenticated
  using (public.can_manage_org(org_id) or exists (select 1 from public.agent_sites s where s.id = site_events.site_id and s.agent_id = auth.uid()));

create or replace function public.site_events_set_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.agent_sites where id = new.site_id;
  return new;
end;
$$;
drop trigger if exists set_org_id on public.site_events;
create trigger set_org_id before insert on public.site_events for each row execute function public.site_events_set_org();

-- One agent site's numbers for the last p_days days: page views of the site and its blog posts, visitors, visits (sessions),
-- time per visit, where they came from, and what they did. SECURITY INVOKER like listing_analytics().
create or replace function public.site_analytics(p_site_id uuid, p_days integer default 30, p_tz text default 'America/Chicago') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 730));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 730)));
  v_chart integer := least(greatest(1, least(coalesce(p_days, 30), 730)), 90);
  r jsonb;
begin
  with pv as (
    select p.id, coalesce(p.visitor_id, p.id::text) as vid, p.session_id, p.source, p.referrer_host, p.device, p.country, p.region, p.city,
           p.duration_sec, p.max_depth, p.created_at, p.target_type, p.target_id, p.page
    from public.page_views p
    where p.created_at >= v_since and (
      (p.target_type = 'agent_site' and p.target_id = p_site_id)
      or (p.target_type = 'agent_post' and p.target_id in (select id from public.agent_site_posts where agent_site_id = p_site_id)))
  ), ev as (
    select e.type, e.detail, pv.session_id as sid from public.site_events e join pv on pv.id = e.view_id where e.site_id = p_site_id and pv.session_id is not null
  ), days as (
    select d::date as day from generate_series((now() at time zone p_tz)::date - (v_chart - 1), (now() at time zone p_tz)::date, interval '1 day') d
  ), visits as (
    select session_id, sum(coalesce(duration_sec, 0)) as secs, count(*) as pages from pv where session_id is not null group by session_id
  )
  select jsonb_build_object(
    'days', v_days,
    'views', (select count(*) from pv),
    'visitors', (select count(distinct vid) from pv),
    'visits', (select count(distinct coalesce(session_id, id::text)) from pv),
    'returning', (select count(*) from (select vid from pv group by vid having count(distinct coalesce(session_id, id::text)) > 1) t),
    'avg_visit_secs', (select round(avg(secs))::int from visits where secs between 3 and 7200),
    'pages_per_visit', (select round(avg(pages), 1) from visits),
    'avg_depth', (select round(avg(max_depth))::int from pv where max_depth is not null),
    'tracked_views', (select count(*) from pv where session_id is not null),
    'tracked_visits', (select count(*) from visits),
    'detail_since', (select min(created_at) from pv where session_id is not null),
    'leads', (select count(*) from public.leads where target_type = 'agent_site' and target_id = p_site_id and created_at >= v_since),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', days.day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by days.day)
      from days left join (select (created_at at time zone p_tz)::date as day, count(*) as views, count(distinct vid) as visitors from pv group by 1) x on x.day = days.day), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t order by t.views desc) from (select case when target_type = 'agent_post' then 'post' else coalesce(page, 'home') end as page, count(*) as views from pv group by 1 order by 2 desc) t), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(t order by t.views desc) from (select sp.title, count(*) as views from pv join public.agent_site_posts sp on sp.id = pv.target_id where pv.target_type = 'agent_post' group by sp.id, sp.title order by 2 desc limit 8) t), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t order by t.visits desc) from (select source, count(distinct coalesce(session_id, id::text)) as visits from pv where source is not null group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'referrers', coalesce((select jsonb_agg(t order by t.views desc) from (select referrer_host, count(*) as views from pv where source = 'referral' and referrer_host is not null group by 1 order by 2 desc limit 8) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t order by t.visits desc) from (select coalesce(device, 'unknown') as device, count(distinct coalesce(session_id, id::text)) as visits from pv group by 1) t), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(t order by t.visits desc) from (select city, region, country, count(distinct coalesce(session_id, id::text)) as visits from pv where city is not null group by 1, 2, 3 order by 4 desc limit 10) t), '[]'::jsonb),
    'engagement', jsonb_build_object(
      'phone_clicks', (select count(distinct sid) from ev where type = 'phone_click'),
      'email_clicks', (select count(distinct sid) from ev where type = 'email_click'),
      'form_starts', (select count(distinct sid) from ev where type = 'form_start'),
      'listing_clicks', (select count(distinct sid) from ev where type = 'listing_click'),
      'blog_clicks', (select count(distinct sid) from ev where type = 'blog_click'),
      'social_clicks', (select count(distinct sid) from ev where type = 'social_click'),
      'sections', coalesce((select jsonb_object_agg(detail, n) from (select detail, count(distinct sid) as n from ev where type = 'section' group by 1) s), '{}'::jsonb)
    )
  ) into r;
  return r;
end;
$$;
revoke all on function public.site_analytics(uuid, integer, text) from public, anon;
grant execute on function public.site_analytics(uuid, integer, text) to authenticated, service_role;
