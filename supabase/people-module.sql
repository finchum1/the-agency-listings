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

-- ============================================================================
-- 34. Brokerage-site analytics: brokerage_events + brokerage_analytics(), same shape as the agent-site rollup.
-- ============================================================================
create table if not exists public.brokerage_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  site_id uuid not null references public.brokerage_site(id) on delete cascade,
  view_id uuid,
  visitor_id text,
  type text not null check (type in ('phone_click', 'email_click', 'form_start', 'section', 'listing_click', 'social_click', 'blog_click')),
  detail text check (length(detail) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists brokerage_events_site_idx on public.brokerage_events (site_id, created_at desc);
create index if not exists brokerage_events_view_idx on public.brokerage_events (view_id);
alter table public.brokerage_events enable row level security;
revoke all on public.brokerage_events from anon, authenticated;
grant select on public.brokerage_events to authenticated;
drop policy if exists brokerage_events_read on public.brokerage_events;
create policy brokerage_events_read on public.brokerage_events for select to authenticated using (public.can_manage_org(org_id));

create or replace function public.brokerage_events_set_org() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select org_id into new.org_id from public.brokerage_site where id = new.site_id;
  return new;
end;
$$;
drop trigger if exists set_org_id on public.brokerage_events;
create trigger set_org_id before insert on public.brokerage_events for each row execute function public.brokerage_events_set_org();

-- The office's own site: same rollup as site_analytics(), over brokerage_site / brokerage_post views. Inquiries are the Home
-- Valuation form's leads (the only stored form on that site). Admins only, through can_manage_org on the views' org.
create or replace function public.brokerage_analytics(p_site_id uuid, p_days integer default 30, p_tz text default 'America/Chicago') returns jsonb
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
      (p.target_type = 'brokerage_site' and p.target_id = p_site_id)
      or (p.target_type = 'brokerage_post' and p.target_id in (select id from public.brokerage_posts where org_id = (select org_id from public.brokerage_site where id = p_site_id))))
  ), ev as (
    select e.type, e.detail, pv.session_id as sid from public.brokerage_events e join pv on pv.id = e.view_id where e.site_id = p_site_id and pv.session_id is not null
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
    'leads', (select count(*) from public.leads where target_type = 'brokerage_valuation' and target_id = p_site_id and created_at >= v_since),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', days.day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by days.day)
      from days left join (select (created_at at time zone p_tz)::date as day, count(*) as views, count(distinct vid) as visitors from pv group by 1) x on x.day = days.day), '[]'::jsonb),
    'pages', coalesce((select jsonb_agg(t order by t.views desc) from (select case when target_type = 'brokerage_post' then 'post' else coalesce(page, 'home') end as page, count(*) as views from pv group by 1 order by 2 desc) t), '[]'::jsonb),
    'posts', coalesce((select jsonb_agg(t order by t.views desc) from (select sp.title, count(*) as views from pv join public.brokerage_posts sp on sp.id = pv.target_id where pv.target_type = 'brokerage_post' group by sp.id, sp.title order by 2 desc limit 8) t), '[]'::jsonb),
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
revoke all on function public.brokerage_analytics(uuid, integer, text) from public, anon;
grant execute on function public.brokerage_analytics(uuid, integer, text) to authenticated, service_role;

-- ============================================================================
-- 35. Flyer templates: which layout a listing's flyer uses (src/components/dashboard/flyer/templates.jsx).
-- ============================================================================
alter table public.listings add column if not exists flyer_template text not null default 'classic' check (flyer_template in ('classic', 'editorial'));

-- 36. Flyer template: add 'luxury' to the allowed keys.
alter table public.listings drop constraint if exists listings_flyer_template_check;
alter table public.listings add constraint listings_flyer_template_check check (flyer_template in ('classic', 'editorial', 'luxury'));
-- ============================================================================
-- 37. People bot: a 'people' scope for the Bot API (leads, pipeline, transactions, notes, to-dos) and people_outreach, the
--     messages a bot drafts for an agent to approve. Nothing is ever sent by the bot: the agent opens a draft from the person's
--     card in the dashboard, sends it from their own email or messages app, and marks it sent.
-- ============================================================================
alter table public.api_tokens drop constraint if exists api_tokens_scopes_check;
alter table public.api_tokens add constraint api_tokens_scopes_check check (scopes <@ array['blog', 'agents', 'sites', 'listings', 'people']::text[] and cardinality(scopes) > 0);

create or replace function public.create_api_token(p_name text, p_scopes text[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an admin can create an API token.';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 or not (p_scopes <@ array['blog', 'agents', 'sites', 'listings', 'people']::text[]) then
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

create table if not exists public.people_outreach (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  channel text not null check (channel in ('email', 'text', 'call')),
  subject text not null default '' check (length(subject) <= 200),
  body text not null check (length(btrim(body)) between 1 and 5000),
  status text not null default 'draft' check (status in ('draft', 'sent', 'discarded')),
  drafted_by text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists people_outreach_owner_idx on public.people_outreach (owner_id, status, created_at desc);
create index if not exists people_outreach_person_idx on public.people_outreach (person_id, created_at desc);
alter table public.people_outreach enable row level security;
drop policy if exists people_outreach_owner_all on public.people_outreach;
create policy people_outreach_owner_all on public.people_outreach
  for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.people pe where pe.id = person_id and pe.owner_id = auth.uid())
  );

-- ============================================================================
-- 38. Weekly listing report email: an agent can turn on a Monday-morning email, per listing, with last week's visits (see
--     api/weekly-reports.js, run by a Vercel cron). weekly_report_sent_at keeps it to one email a week however often it runs.
-- ============================================================================
alter table public.listings add column if not exists weekly_report boolean not null default false;
alter table public.listings add column if not exists weekly_report_sent_at timestamptz;
-- ============================================================================
-- 39. Office analytics: one rollup across every property site (and agent website) in the organization, filterable by agent,
--     listing status and traffic source. Admin-only. SECURITY INVOKER, so row-level security still applies.
-- ============================================================================
create or replace function public.office_analytics(p_days integer default 30, p_agent uuid default null, p_status text default null, p_source text default null, p_tz text default 'America/Chicago') returns jsonb
language plpgsql stable set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_prior timestamptz := now() - make_interval(days => 2 * greatest(1, least(coalesce(p_days, 30), 365)));
  v_chart integer := least(greatest(1, least(coalesce(p_days, 30), 365)), 90);
  r jsonb;
begin
  if v_org is null or not public.can_manage_org(v_org) then
    raise exception 'Only an admin can see office analytics.';
  end if;
  with ls as (
    select l.id, l.address_line1, l.city, l.status, l.agent_id, p.full_name as agent_name
    from public.listings l left join public.profiles p on p.id = l.agent_id
    where l.org_id = v_org and (p_agent is null or l.agent_id = p_agent) and (p_status is null or l.status = p_status)
  ), pv as (
    select v.id, coalesce(v.visitor_id, v.id::text) as vid, v.target_id as listing_id, v.source, v.device, v.city, v.region, v.duration_sec, v.created_at
    from public.page_views v join ls on ls.id = v.target_id
    where v.target_type = 'listing' and v.created_at >= v_prior and (p_source is null or coalesce(v.source, 'direct') = p_source)
  ), cur as (select * from pv where created_at >= v_since),
  prev as (select * from pv where created_at < v_since),
  lead_counts as (
    select target_id as listing_id, count(*) as n from public.leads
    where target_type = 'listing' and created_at >= v_since and target_id in (select id from ls) group by 1
  ), days as (
    select d::date as day from generate_series((now() at time zone p_tz)::date - (v_chart - 1), (now() at time zone p_tz)::date, interval '1 day') d
  ), per_listing as (
    select ls.id, ls.address_line1, ls.city, ls.status, ls.agent_id, ls.agent_name,
           count(c.id) as views, count(distinct c.vid) as visitors,
           round(avg(c.duration_sec) filter (where c.duration_sec between 3 and 3600))::int as avg_duration,
           coalesce(max(lc.n), 0) as leads, max(c.created_at) as last_view
    from ls left join cur c on c.listing_id = ls.id left join lead_counts lc on lc.listing_id = ls.id
    group by ls.id, ls.address_line1, ls.city, ls.status, ls.agent_id, ls.agent_name
  ), per_agent as (
    select ls.agent_id, ls.agent_name, count(distinct ls.id) as listings, count(c.id) as views, count(distinct c.vid) as visitors
    from ls left join cur c on c.listing_id = ls.id group by ls.agent_id, ls.agent_name
  ), site_set as (
    select s.id as site_id, s.agent_id, s.slug from public.agent_sites s where s.org_id = v_org and (p_agent is null or s.agent_id = p_agent)
  ), site_posts as (
    select sp.id as post_id, sp.agent_site_id as site_id from public.agent_site_posts sp where sp.agent_site_id in (select site_id from site_set)
  ), site_pv as (
    select v.id, coalesce(v.visitor_id, v.id::text) as vid, ss.site_id
    from public.page_views v join site_set ss on v.target_type = 'agent_site' and v.target_id = ss.site_id
    where v.created_at >= v_since and (p_source is null or coalesce(v.source, 'direct') = p_source)
    union all
    select v.id, coalesce(v.visitor_id, v.id::text) as vid, spp.site_id
    from public.page_views v join site_posts spp on v.target_type = 'agent_post' and v.target_id = spp.post_id
    where v.created_at >= v_since and (p_source is null or coalesce(v.source, 'direct') = p_source)
  ), site_leads as (
    select target_id as site_id, count(*) as n from public.leads where target_type = 'agent_site' and created_at >= v_since group by 1
  )
  select jsonb_build_object(
    'days', v_days,
    'views', (select count(*) from cur),
    'prior_views', (select count(*) from prev),
    'visitors', (select count(distinct vid) from cur),
    'avg_duration', (select round(avg(duration_sec))::int from cur where duration_sec between 3 and 3600),
    'leads', (select coalesce(sum(n), 0) from lead_counts),
    'listings_count', (select count(*) from ls),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', days.day, 'views', coalesce(x.views, 0), 'visitors', coalesce(x.visitors, 0)) order by days.day)
      from days left join (select (created_at at time zone p_tz)::date as day, count(*) as views, count(distinct vid) as visitors from cur group by 1) x on x.day = days.day), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(t order by t.views desc) from (select coalesce(source, 'direct') as source, count(*) as views, count(distinct vid) as visitors from cur group by 1 order by 2 desc limit 12) t), '[]'::jsonb),
    'devices', coalesce((select jsonb_agg(t order by t.views desc) from (select coalesce(device, 'unknown') as device, count(*) as views from cur group by 1) t), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(t order by t.views desc) from (select city, region, count(*) as views from cur where city is not null group by 1, 2 order by 3 desc limit 10) t), '[]'::jsonb),
    'listings', coalesce((select jsonb_agg(t order by t.views desc, t.address_line1) from (select * from per_listing order by views desc, address_line1 limit 300) t), '[]'::jsonb),
    'agents', coalesce((select jsonb_agg(jsonb_build_object('agent_id', a.agent_id, 'agent_name', a.agent_name, 'listings', a.listings, 'views', a.views, 'visitors', a.visitors,
        'leads', (select coalesce(sum(pl.leads), 0) from per_listing pl where pl.agent_id = a.agent_id)) order by a.views desc, a.agent_name) from per_agent a), '[]'::jsonb),
    'sites', coalesce((select jsonb_agg(t order by t.views desc, t.agent_name) from (
        select ss.site_id, ss.agent_id, pr.full_name as agent_name, ss.slug, count(p.id) as views, count(distinct p.vid) as visitors, coalesce(max(sl.n), 0) as leads
        from site_set ss left join site_pv p on p.site_id = ss.site_id left join public.profiles pr on pr.id = ss.agent_id left join site_leads sl on sl.site_id = ss.site_id
        group by ss.site_id, ss.agent_id, pr.full_name, ss.slug order by 5 desc limit 200) t), '[]'::jsonb)
  ) into r;
  return r;
end;
$$;
revoke all on function public.office_analytics(integer, uuid, text, text, text) from public, anon;
grant execute on function public.office_analytics(integer, uuid, text, text, text) to authenticated, service_role;

-- ============================================================================
-- 40. Client transaction timeline: a private, no-sign-in page that shows a buyer or seller where their deal stands (contract,
--     inspection, appraisal, financing, closing) and what's still coming, branded with the agent. Same pattern as the seller
--     report links: the token is stored only as a hash. The page (api/transaction-timeline.js) shows dates and names, never
--     price, commission or the agent's internal checklist.
-- ============================================================================
create table if not exists public.transaction_timeline_links (
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
create index if not exists transaction_timeline_links_person_idx on public.transaction_timeline_links (person_id, created_at desc);
alter table public.transaction_timeline_links enable row level security;
revoke all on public.transaction_timeline_links from anon, authenticated;
grant select (id, org_id, person_id, created_by, token_hint, message, created_at, expires_at, revoked_at, last_viewed_at, view_count) on public.transaction_timeline_links to authenticated;
drop policy if exists transaction_timeline_links_read on public.transaction_timeline_links;
create policy transaction_timeline_links_read on public.transaction_timeline_links for select to authenticated using (created_by = auth.uid());

create or replace function public.create_timeline_link(p_person_id uuid, p_message text default '', p_days integer default 120) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid := public.current_org_id();
  v_token text;
begin
  if auth.uid() is null or v_org is null then
    raise exception 'Sign in to share a timeline.';
  end if;
  if not exists (select 1 from public.people pe join public.profiles pr on pr.id = pe.owner_id
                 where pe.id = p_person_id and pe.owner_id = auth.uid() and pr.people_enabled and pe.stage_group = 'transaction') then
    raise exception 'A timeline can only be shared for one of your own transactions.';
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

create or replace function public.revoke_timeline_link(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.transaction_timeline_links set revoked_at = coalesce(revoked_at, now()) where id = p_id and created_by = auth.uid();
end;
$$;
revoke all on function public.revoke_timeline_link(uuid) from public, anon;
grant execute on function public.revoke_timeline_link(uuid) to authenticated;

-- ============================================================================
-- 41. Contacts CRM. One private record per person in an agent's database (People > Contacts): details, tags, an activity log,
--     follow-up to-dos, and links to the Leads / Pipeline / Transactions cards they appear on. Strictly private to the agent,
--     like People. Cards (people rows) now point at their contact (people.contact_id) and stay in step with it: name, email and
--     phone changed on either side are copied to the other.
-- ============================================================================
create or replace function public.split_person_name(p_name text, out first_name text, out last_name text)
language plpgsql immutable as $$
declare
  n text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  i integer;
begin
  i := length(n) - position(' ' in reverse(n)) + 1;
  if n = '' or position(' ' in n) = 0 then
    first_name := n;
    last_name := '';
  else
    first_name := left(n, i - 1);
    last_name := substr(n, i + 1);
  end if;
end;
$$;

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  company text not null default '',
  email text not null default '',
  phone text not null default '',
  other_emails text[] not null default '{}',
  other_phones text[] not null default '{}',
  address_line1 text not null default '',
  city text not null default '',
  state text not null default '',
  zip text not null default '',
  birthday date,
  home_anniversary date,
  relationship text not null default 'other' check (relationship in ('client', 'past_client', 'lead', 'sphere', 'referral_partner', 'vendor', 'agent', 'lender', 'other')),
  source text not null default '',
  about text not null default '',
  touch_every_days integer check (touch_every_days is null or touch_every_days between 1 and 1095),
  last_contacted_at timestamptz,
  do_not_contact boolean not null default false,
  archived boolean not null default false,
  search_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contacts_has_a_name check (btrim(first_name || last_name || company) <> '')
);
create index if not exists contacts_owner_idx on public.contacts (owner_id, archived);
create index if not exists contacts_owner_email_idx on public.contacts (owner_id, lower(email)) where email <> '';

create or replace function public.contacts_before_write() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.search_text := lower(concat_ws(' ', new.first_name, new.last_name, new.company, new.email, new.phone,
    array_to_string(new.other_emails, ' '), array_to_string(new.other_phones, ' '),
    regexp_replace(new.phone, '\D', '', 'g'), regexp_replace(array_to_string(new.other_phones, ' '), '\D', '', 'g'),
    new.address_line1, new.city, new.state, new.zip, new.source, new.about));
  return new;
end;
$$;
drop trigger if exists contacts_before_write on public.contacts;
create trigger contacts_before_write before insert or update on public.contacts for each row execute function public.contacts_before_write();

create table if not exists public.contact_tags (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 40),
  color text not null default 'gray' check (color in ('gray', 'red', 'orange', 'amber', 'green', 'teal', 'blue', 'violet', 'pink')),
  created_at timestamptz not null default now()
);
create unique index if not exists contact_tags_owner_name_idx on public.contact_tags (owner_id, lower(name));
create table if not exists public.contact_tag_links (
  contact_id uuid not null references public.contacts(id) on delete cascade,
  tag_id uuid not null references public.contact_tags(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  primary key (contact_id, tag_id)
);
create index if not exists contact_tag_links_tag_idx on public.contact_tag_links (tag_id);

create table if not exists public.contact_notes (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  kind text not null default 'note' check (kind in ('note', 'call', 'text', 'email', 'meeting', 'showing', 'other')),
  body text not null default '' check (length(body) <= 5000),
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists contact_notes_contact_idx on public.contact_notes (contact_id, occurred_at desc);

-- A call, text, email, meeting or showing counts as being in touch.
create or replace function public.contact_note_touch() returns trigger
language plpgsql as $$
begin
  if new.kind in ('call', 'text', 'email', 'meeting', 'showing') then
    update public.contacts set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at) where id = new.contact_id;
  end if;
  return new;
end;
$$;
drop trigger if exists contact_note_touch on public.contact_notes;
create trigger contact_note_touch after insert on public.contact_notes for each row execute function public.contact_note_touch();

create table if not exists public.contact_smart_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.agent_tasks add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists agent_tasks_contact_idx on public.agent_tasks (contact_id) where contact_id is not null;
alter table public.people add column if not exists contact_id uuid references public.contacts(id) on delete set null;
create index if not exists people_contact_idx on public.people (contact_id) where contact_id is not null;

-- Private to the agent (and only while People is on for them), like the rest of People.
alter table public.contacts enable row level security;
alter table public.contact_tags enable row level security;
alter table public.contact_tag_links enable row level security;
alter table public.contact_notes enable row level security;
alter table public.contact_smart_lists enable row level security;

drop policy if exists contacts_owner_all on public.contacts;
create policy contacts_owner_all on public.contacts for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
drop policy if exists contact_tags_owner_all on public.contact_tags;
create policy contact_tags_owner_all on public.contact_tags for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
drop policy if exists contact_tag_links_owner_all on public.contact_tag_links;
create policy contact_tag_links_owner_all on public.contact_tag_links for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid())
    and exists (select 1 from public.contact_tags t where t.id = tag_id and t.owner_id = auth.uid()));
drop policy if exists contact_notes_owner_all on public.contact_notes;
create policy contact_notes_owner_all on public.contact_notes for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid()));
drop policy if exists contact_smart_lists_owner_all on public.contact_smart_lists;
create policy contact_smart_lists_owner_all on public.contact_smart_lists for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

-- Every new Leads / Pipeline / Transactions card gets a contact: an existing one with the same email, or a new one. This covers
-- cards made in the app, by the bot and from website inquiries alike.
create or replace function public.people_ensure_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  nm record;
begin
  if new.contact_id is not null then
    return new;
  end if;
  if btrim(coalesce(new.email, '')) <> '' then
    select id into cid from public.contacts where owner_id = new.owner_id and lower(email) = lower(btrim(new.email)) order by created_at limit 1;
  end if;
  if cid is null then
    select * into nm from public.split_person_name(new.name);
    insert into public.contacts (owner_id, first_name, last_name, email, phone, relationship, source)
    values (new.owner_id, case when nm.first_name = '' and nm.last_name = '' then 'Unnamed' else nm.first_name end, nm.last_name, btrim(coalesce(new.email, '')), coalesce(new.phone, ''), case when new.stage_group = 'transaction' then 'client' else 'lead' end, coalesce(new.source, ''))
    returning id into cid;
  end if;
  new.contact_id := cid;
  return new;
end;
$$;
drop trigger if exists people_ensure_contact on public.people;
create trigger people_ensure_contact before insert on public.people for each row execute function public.people_ensure_contact();

-- Name, email and phone stay the same on a card and its contact. pg_trigger_depth() stops the two from echoing back and forth.
create or replace function public.people_push_to_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  nm record;
begin
  if pg_trigger_depth() > 1 or new.contact_id is null then
    return new;
  end if;
  select * into nm from public.split_person_name(new.name);
  update public.contacts
     set first_name = nm.first_name, last_name = nm.last_name, email = btrim(coalesce(new.email, '')), phone = coalesce(new.phone, '')
   where id = new.contact_id and owner_id = new.owner_id
     and (first_name, last_name, email, phone) is distinct from (nm.first_name, nm.last_name, btrim(coalesce(new.email, '')), coalesce(new.phone, ''));
  return new;
end;
$$;
drop trigger if exists people_push_to_contact on public.people;
create trigger people_push_to_contact after update of name, email, phone on public.people for each row execute function public.people_push_to_contact();

create or replace function public.contact_push_to_people() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  update public.people
     set name = btrim(new.first_name || ' ' || new.last_name), email = new.email, phone = new.phone
   where contact_id = new.id and btrim(new.first_name || ' ' || new.last_name) <> ''
     and (name, email, phone) is distinct from (btrim(new.first_name || ' ' || new.last_name), new.email, new.phone);
  return new;
end;
$$;
drop trigger if exists contact_push_to_people on public.contacts;
create trigger contact_push_to_people after update of first_name, last_name, email, phone on public.contacts for each row execute function public.contact_push_to_people();

-- One-time: a contact for every existing card (cards with the same email share one).
alter table public.people disable trigger touch_people_updated_at;
do $$
declare
  r record;
  cid uuid;
  nm record;
begin
  for r in select * from public.people where contact_id is null order by created_at loop
    cid := null;
    if btrim(r.email) <> '' then
      select id into cid from public.contacts where owner_id = r.owner_id and lower(email) = lower(btrim(r.email)) order by created_at limit 1;
    end if;
    if cid is null then
      select * into nm from public.split_person_name(r.name);
      insert into public.contacts (owner_id, first_name, last_name, email, phone, relationship, source, created_at)
      values (r.owner_id, case when nm.first_name = '' and nm.last_name = '' then 'Unnamed' else nm.first_name end, nm.last_name, btrim(r.email), r.phone, case when r.stage_group = 'transaction' then 'client' else 'lead' end, r.source, r.created_at)
      returning id into cid;
    end if;
    update public.people set contact_id = cid where id = r.id;
  end loop;
end $$;
alter table public.people enable trigger touch_people_updated_at;

-- Merge a duplicate into the contact you keep: everything attached to it moves over, blanks on the kept one are filled in.
create or replace function public.merge_contacts(p_keep uuid, p_remove uuid) returns void
language plpgsql set search_path = public as $$
declare
  k public.contacts;
  d public.contacts;
begin
  if p_keep = p_remove then
    raise exception 'Pick two different contacts.';
  end if;
  select * into k from public.contacts where id = p_keep and owner_id = auth.uid();
  select * into d from public.contacts where id = p_remove and owner_id = auth.uid();
  if k.id is null or d.id is null then
    raise exception 'Those contacts aren''t yours to merge.';
  end if;
  update public.contact_notes set contact_id = k.id where contact_id = d.id;
  insert into public.contact_tag_links (contact_id, tag_id) select k.id, tag_id from public.contact_tag_links where contact_id = d.id on conflict do nothing;
  update public.agent_tasks set contact_id = k.id where contact_id = d.id;
  update public.people set contact_id = k.id where contact_id = d.id;
  update public.contacts set
    company = case when k.company = '' then d.company else k.company end,
    email = case when k.email = '' then d.email else k.email end,
    phone = case when k.phone = '' then d.phone else k.phone end,
    other_emails = (select coalesce(array_agg(distinct x), '{}') from unnest(k.other_emails || d.other_emails || case when k.email <> '' and d.email <> '' and lower(k.email) <> lower(d.email) then array[d.email] else '{}'::text[] end) x where x <> '' and lower(x) <> lower(case when k.email = '' then d.email else k.email end)),
    other_phones = (select coalesce(array_agg(distinct x), '{}') from unnest(k.other_phones || d.other_phones || case when k.phone <> '' and d.phone <> '' and k.phone <> d.phone then array[d.phone] else '{}'::text[] end) x where x <> '' and x <> case when k.phone = '' then d.phone else k.phone end),
    address_line1 = case when k.address_line1 = '' then d.address_line1 else k.address_line1 end,
    city = case when k.address_line1 = '' and k.city = '' then d.city else k.city end,
    state = case when k.address_line1 = '' and k.state = '' then d.state else k.state end,
    zip = case when k.address_line1 = '' and k.zip = '' then d.zip else k.zip end,
    birthday = coalesce(k.birthday, d.birthday),
    home_anniversary = coalesce(k.home_anniversary, d.home_anniversary),
    source = case when k.source = '' then d.source else k.source end,
    about = case when k.about = '' then d.about when d.about = '' then k.about else k.about || E'\n\n' || d.about end,
    touch_every_days = coalesce(k.touch_every_days, d.touch_every_days),
    last_contacted_at = greatest(k.last_contacted_at, d.last_contacted_at),
    do_not_contact = k.do_not_contact or d.do_not_contact
  where id = k.id;
  delete from public.contacts where id = d.id;
end;
$$;
revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;

-- ============================================================================
-- 42. Deals (the old "Transactions" board, now its own top-level module). Same rows as before (people with
--     stage_group = 'transaction'); what's new is who can see and work on them:
--       owner       the agent. Everything, as before.
--       tc          a transaction coordinator an admin assigned to this agent (deal_team). Can see and edit the deal, its
--                   tasks and documents, and talk in the deal's thread.
--       compliance  office-wide read of every deal in the organization (profiles.deals_role = 'compliance'), plus the
--                   review actions: mark documents OK / needs fixing, approve, or send back with a message.
--     Admins get no automatic access: an admin who should review deals gives themselves the compliance role.
--     Leads, Pipeline, notes and contacts stay strictly private to their agent: none of the new rules touch them.
-- ============================================================================
alter table public.profiles
  add column if not exists deals_role text check (deals_role in ('tc', 'compliance'));

create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql security definer set search_path to 'public' as $$
begin
  if auth.uid() is null then return new; end if;
  if public.is_platform_admin() then return new; end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'Only the platform owner can change which organization an account belongs to.';
  end if;
  if new.role is distinct from old.role
     or new.site_access is distinct from old.site_access
     or new.people_enabled is distinct from old.people_enabled
     or new.deals_role is distinct from old.deals_role
     or new.login_enabled is distinct from old.login_enabled then
    if exists (
      select 1 from public.profiles p join public.organizations o on o.id = p.org_id
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = old.org_id and o.type = 'brokerage'
    ) then
      return new;
    end if;
    raise exception 'Only an admin can change role, site access, People access, Deals role, or login access.';
  end if;
  return new;
end;
$$;

-- Which transaction coordinator works with which agents.
create table if not exists public.deal_team (
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  tc_id uuid not null references public.profiles(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tc_id, agent_id)
);
alter table public.deal_team enable row level security;
drop policy if exists deal_team_read on public.deal_team;
create policy deal_team_read on public.deal_team for select to authenticated using (tc_id = auth.uid() or public.can_manage_org(org_id));
drop policy if exists deal_team_admin_write on public.deal_team;
create policy deal_team_admin_write on public.deal_team for all to authenticated using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

-- How the signed-in user relates to a deal owned by p_owner: 'owner', 'compliance', 'tc' or null.
create or replace function public.deal_access(p_owner uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_owner is null or auth.uid() is null then null
    when p_owner = auth.uid() then 'owner'
    when exists (select 1 from public.profiles me join public.profiles o on o.id = p_owner
                 where me.id = auth.uid() and me.deals_role = 'compliance' and me.org_id is not null and me.org_id = o.org_id) then 'compliance'
    when exists (select 1 from public.deal_team t where t.tc_id = auth.uid() and t.agent_id = p_owner) then 'tc'
  end
$$;
create or replace function public.deal_person_access(p_person uuid) returns text
language sql stable security definer set search_path = public as $$
  select public.deal_access((select owner_id from public.people where id = p_person and stage_group = 'transaction'))
$$;
grant execute on function public.deal_access(uuid), public.deal_person_access(uuid) to authenticated;

alter table public.people
  add column if not exists compliance_status text not null default 'none' check (compliance_status in ('none', 'submitted', 'needs_changes', 'approved')),
  add column if not exists compliance_updated_at timestamptz,
  add column if not exists compliance_by uuid references public.profiles(id) on delete set null;

alter table public.transaction_documents
  add column if not exists review_status text check (review_status in ('ok', 'issue')),
  add column if not exists review_note text not null default '',
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz;

-- The compliance columns and document review marks only move through the functions below.
create or replace function public.people_deal_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare acc text;
begin
  if auth.uid() is null then return new; end if;
  if (new.compliance_status, new.compliance_updated_at, new.compliance_by) is distinct from (old.compliance_status, old.compliance_updated_at, old.compliance_by)
     and coalesce(current_setting('app.deal_rpc', true), '') <> '1' then
    raise exception 'Use Submit for review (or the compliance actions) to change a deal''s review status.';
  end if;
  acc := public.deal_access(old.owner_id);
  if acc = 'tc' and (new.owner_id is distinct from old.owner_id or new.stage_group is distinct from old.stage_group
                     or new.contact_id is distinct from old.contact_id or new.lead_id is distinct from old.lead_id) then
    raise exception 'A transaction coordinator can edit a deal but not move it or reassign it.';
  end if;
  return new;
end;
$$;
drop trigger if exists people_deal_guard on public.people;
create trigger people_deal_guard before update on public.people for each row execute function public.people_deal_guard();

create or replace function public.transaction_documents_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if tg_op = 'INSERT' then
    new.owner_id := (select owner_id from public.people where id = new.person_id);
    if new.review_status is not null or coalesce(new.review_note, '') <> '' then new.review_status := null; new.review_note := ''; end if;
  elsif (new.review_status, new.review_note, new.reviewed_by, new.reviewed_at) is distinct from (old.review_status, old.review_note, old.reviewed_by, old.reviewed_at)
        and coalesce(current_setting('app.deal_rpc', true), '') <> '1' then
    raise exception 'Only compliance can mark a document as reviewed.';
  end if;
  return new;
end;
$$;
drop trigger if exists transaction_documents_guard on public.transaction_documents;
create trigger transaction_documents_guard before insert or update on public.transaction_documents for each row execute function public.transaction_documents_guard();

-- Tasks added by a coordinator still belong to the agent who owns the deal.
create or replace function public.transaction_tasks_owner() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null then new.owner_id := (select owner_id from public.people where id = new.person_id); end if;
  return new;
end;
$$;
drop trigger if exists transaction_tasks_owner on public.transaction_tasks;
create trigger transaction_tasks_owner before insert on public.transaction_tasks for each row execute function public.transaction_tasks_owner();

-- Access rules (added to the existing owner-only ones, which are unchanged).
drop policy if exists people_deal_team_read on public.people;
create policy people_deal_team_read on public.people for select to authenticated
  using (stage_group = 'transaction' and public.deal_access(owner_id) in ('tc', 'compliance'));
drop policy if exists people_deal_tc_update on public.people;
create policy people_deal_tc_update on public.people for update to authenticated
  using (stage_group = 'transaction' and public.deal_access(owner_id) = 'tc')
  with check (stage_group = 'transaction' and public.deal_access(owner_id) = 'tc');

drop policy if exists transaction_tasks_team_read on public.transaction_tasks;
create policy transaction_tasks_team_read on public.transaction_tasks for select to authenticated using (public.deal_person_access(person_id) in ('tc', 'compliance'));
drop policy if exists transaction_tasks_tc_write on public.transaction_tasks;
create policy transaction_tasks_tc_write on public.transaction_tasks for all to authenticated
  using (public.deal_person_access(person_id) = 'tc') with check (public.deal_person_access(person_id) = 'tc');

drop policy if exists transaction_documents_team_read on public.transaction_documents;
create policy transaction_documents_team_read on public.transaction_documents for select to authenticated using (public.deal_person_access(person_id) in ('tc', 'compliance'));
drop policy if exists transaction_documents_tc_write on public.transaction_documents;
create policy transaction_documents_tc_write on public.transaction_documents for all to authenticated
  using (public.deal_person_access(person_id) = 'tc') with check (public.deal_person_access(person_id) = 'tc');

-- A conversation per deal between the agent, their coordinator and compliance, plus the review history.
create table if not exists public.deal_messages (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles(id) on delete set null,
  kind text not null default 'message' check (kind in ('message', 'submitted', 'approved', 'changes')),
  body text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists deal_messages_person_idx on public.deal_messages (person_id, created_at);
alter table public.deal_messages enable row level security;
drop policy if exists deal_messages_read on public.deal_messages;
create policy deal_messages_read on public.deal_messages for select to authenticated using (public.deal_person_access(person_id) is not null);
drop policy if exists deal_messages_post on public.deal_messages;
create policy deal_messages_post on public.deal_messages for insert to authenticated
  with check (author_id = auth.uid() and kind = 'message' and length(btrim(body)) > 0 and public.deal_person_access(person_id) is not null);

create table if not exists public.deal_reads (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, person_id)
);
alter table public.deal_reads enable row level security;
drop policy if exists deal_reads_own on public.deal_reads;
create policy deal_reads_own on public.deal_reads for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function public.deal_mark_read(p_person uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.deal_reads (user_id, person_id, read_at) select auth.uid(), p_person, now()
  where public.deal_person_access(p_person) is not null
  on conflict (user_id, person_id) do update set read_at = now()
$$;

-- Agent or coordinator: hand the deal to compliance. Flags from a previous round are cleared so the list is fresh.
create or replace function public.deal_submit_review(p_person uuid, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.deal_person_access(p_person) not in ('owner', 'tc') then raise exception 'Only the agent or their coordinator can submit a deal for review.'; end if;
  perform set_config('app.deal_rpc', '1', true);
  update public.people set compliance_status = 'submitted', compliance_updated_at = now(), compliance_by = null where id = p_person;
  update public.transaction_documents set review_status = null, review_note = '', reviewed_by = null, reviewed_at = null where person_id = p_person and review_status = 'issue';
  insert into public.deal_messages (person_id, author_id, kind, body) values (p_person, auth.uid(), 'submitted', coalesce(nullif(btrim(p_note), ''), 'Submitted for compliance review.'));
end;
$$;

-- Compliance: approve, or send back. Flagged documents are listed in the message automatically.
create or replace function public.deal_review(p_person uuid, p_decision text, p_message text default '') returns void
language plpgsql security definer set search_path = public as $$
declare flagged text; body text;
begin
  if public.deal_person_access(p_person) is distinct from 'compliance' then raise exception 'Only compliance can review a deal.'; end if;
  if p_decision not in ('approved', 'needs_changes') then raise exception 'Decision must be approved or needs_changes.'; end if;
  select string_agg('• ' || text || case when btrim(review_note) <> '' then ': ' || btrim(review_note) else '' end, E'\n' order by position)
    into flagged from public.transaction_documents where person_id = p_person and review_status = 'issue';
  if p_decision = 'needs_changes' and coalesce(btrim(p_message), '') = '' and flagged is null then raise exception 'Add a message or flag at least one document.'; end if;
  body := btrim(coalesce(p_message, ''));
  if p_decision = 'needs_changes' and flagged is not null then body := btrim(body || E'\n\nNeeds fixing:\n' || flagged); end if;
  if p_decision = 'approved' and body = '' then body := 'Approved.'; end if;
  perform set_config('app.deal_rpc', '1', true);
  update public.people set compliance_status = p_decision, compliance_updated_at = now(), compliance_by = auth.uid() where id = p_person;
  insert into public.deal_messages (person_id, author_id, kind, body) values (p_person, auth.uid(), case when p_decision = 'approved' then 'approved' else 'changes' end, body);
end;
$$;

create or replace function public.deal_mark_document(p_doc uuid, p_status text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  select person_id into pid from public.transaction_documents where id = p_doc;
  if public.deal_person_access(pid) is distinct from 'compliance' then raise exception 'Only compliance can mark a document.'; end if;
  if p_status is not null and p_status not in ('ok', 'issue') then raise exception 'Status must be ok, issue, or empty.'; end if;
  perform set_config('app.deal_rpc', '1', true);
  update public.transaction_documents
    set review_status = p_status, review_note = case when p_status = 'issue' then left(coalesce(p_note, ''), 500) else '' end,
        reviewed_by = case when p_status is null then null else auth.uid() end, reviewed_at = case when p_status is null then null else now() end
    where id = p_doc;
end;
$$;

-- Counts for the Deals menu badge. Runs as the caller, so the access rules above decide what is counted.
create or replace function public.deal_attention() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'needs_changes', count(*) filter (where p.compliance_status = 'needs_changes' and public.deal_access(p.owner_id) in ('owner', 'tc')),
    'to_review', count(*) filter (where p.compliance_status = 'submitted' and public.deal_access(p.owner_id) = 'compliance'),
    'unread', (select count(*) from public.deal_messages m left join public.deal_reads r on r.person_id = m.person_id and r.user_id = auth.uid()
               where m.author_id is distinct from auth.uid() and m.created_at > coalesce(r.read_at, '-infinity'::timestamptz)
                 and exists (select 1 from public.people pp where pp.id = m.person_id and pp.stage_group = 'transaction' and not pp.archived)))
  from public.people p where p.stage_group = 'transaction' and not p.archived
$$;

revoke all on function public.deal_mark_read(uuid), public.deal_submit_review(uuid, text), public.deal_review(uuid, text, text), public.deal_mark_document(uuid, text, text), public.deal_attention() from public, anon;
grant execute on function public.deal_mark_read(uuid), public.deal_submit_review(uuid, text), public.deal_review(uuid, text, text), public.deal_mark_document(uuid, text, text), public.deal_attention() to authenticated;

-- ============================================================================
-- 43. Email when compliance sends a deal back. api/deal-notify.js emails the agent (and their coordinators) once per send-back;
--     emailed_at marks the message as handled so a retry or a second click never sends it twice.
-- ============================================================================
alter table public.deal_messages add column if not exists emailed_at timestamptz;

-- ============================================================================
-- 44. Pick a coordinator per deal. An agent can hand individual deals to a TC (deal_tcs) without giving that TC all their deals;
--     the agent-wide assignment an admin makes on the Agents page (deal_team) still works for agents who always use one. A TC must
--     have the coordinator role (profiles.deals_role = 'tc') and work in the same office to be picked.
-- ============================================================================
create table if not exists public.deal_tcs (
  person_id uuid not null references public.people(id) on delete cascade,
  tc_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid default auth.uid() references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (person_id, tc_id)
);
create index if not exists deal_tcs_tc_idx on public.deal_tcs (tc_id);
alter table public.deal_tcs enable row level security;

create or replace function public.deal_access(p_owner uuid, p_person uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when p_owner is null or auth.uid() is null then null
    when p_owner = auth.uid() then 'owner'
    when exists (select 1 from public.profiles me join public.profiles o on o.id = p_owner
                 where me.id = auth.uid() and me.deals_role = 'compliance' and me.org_id is not null and me.org_id = o.org_id) then 'compliance'
    when exists (select 1 from public.profiles me where me.id = auth.uid() and me.deals_role = 'tc')
         and (exists (select 1 from public.deal_team t where t.tc_id = auth.uid() and t.agent_id = p_owner)
              or (p_person is not null and exists (select 1 from public.deal_tcs d where d.person_id = p_person and d.tc_id = auth.uid()))) then 'tc'
  end
$$;
create or replace function public.deal_access(p_owner uuid) returns text
language sql stable security definer set search_path = public as $$ select public.deal_access(p_owner, null::uuid) $$;
create or replace function public.deal_person_access(p_person uuid) returns text
language sql stable security definer set search_path = public as $$
  select public.deal_access(p.owner_id, p.id) from public.people p where p.id = p_person and p.stage_group = 'transaction'
$$;
grant execute on function public.deal_access(uuid, uuid) to authenticated;

create or replace function public.is_office_tc(p_tc uuid, p_owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles tc join public.profiles o on o.id = p_owner
                 where tc.id = p_tc and tc.deals_role = 'tc' and tc.org_id is not null and tc.org_id = o.org_id)
$$;
grant execute on function public.is_office_tc(uuid, uuid) to authenticated;

drop policy if exists deal_tcs_read on public.deal_tcs;
create policy deal_tcs_read on public.deal_tcs for select to authenticated using (tc_id = auth.uid() or public.deal_person_access(person_id) is not null);
drop policy if exists deal_tcs_owner_add on public.deal_tcs;
create policy deal_tcs_owner_add on public.deal_tcs for insert to authenticated
  with check (public.deal_person_access(person_id) = 'owner' and public.is_office_tc(tc_id, auth.uid()));
drop policy if exists deal_tcs_owner_remove on public.deal_tcs;
create policy deal_tcs_owner_remove on public.deal_tcs for delete to authenticated using (public.deal_person_access(person_id) = 'owner');

-- Everything that decided access by owner alone now looks at the deal too.
drop policy if exists people_deal_team_read on public.people;
create policy people_deal_team_read on public.people for select to authenticated
  using (stage_group = 'transaction' and public.deal_access(owner_id, id) in ('tc', 'compliance'));
drop policy if exists people_deal_tc_update on public.people;
create policy people_deal_tc_update on public.people for update to authenticated
  using (stage_group = 'transaction' and public.deal_access(owner_id, id) = 'tc')
  with check (stage_group = 'transaction' and public.deal_access(owner_id, id) = 'tc');

create or replace function public.people_deal_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare acc text;
begin
  if auth.uid() is null then return new; end if;
  if (new.compliance_status, new.compliance_updated_at, new.compliance_by) is distinct from (old.compliance_status, old.compliance_updated_at, old.compliance_by)
     and coalesce(current_setting('app.deal_rpc', true), '') <> '1' then
    raise exception 'Use Submit for review (or the compliance actions) to change a deal''s review status.';
  end if;
  acc := public.deal_access(old.owner_id, old.id);
  if acc = 'tc' and (new.owner_id is distinct from old.owner_id or new.stage_group is distinct from old.stage_group
                     or new.contact_id is distinct from old.contact_id or new.lead_id is distinct from old.lead_id) then
    raise exception 'A transaction coordinator can edit a deal but not move it or reassign it.';
  end if;
  return new;
end;
$$;

create or replace function public.deal_attention() returns jsonb
language sql stable set search_path = public as $$
  select jsonb_build_object(
    'needs_changes', count(*) filter (where p.compliance_status = 'needs_changes' and public.deal_access(p.owner_id, p.id) in ('owner', 'tc')),
    'to_review', count(*) filter (where p.compliance_status = 'submitted' and public.deal_access(p.owner_id, p.id) = 'compliance'),
    'unread', (select count(*) from public.deal_messages m left join public.deal_reads r on r.person_id = m.person_id and r.user_id = auth.uid()
               where m.author_id is distinct from auth.uid() and m.created_at > coalesce(r.read_at, '-infinity'::timestamptz)
                 and exists (select 1 from public.people pp where pp.id = m.person_id and pp.stage_group = 'transaction' and not pp.archived)))
  from public.people p where p.stage_group = 'transaction' and not p.archived
$$;

-- Fix: a user with no access to a deal (access = null) slipped past the "not in" check in deal_submit_review.
create or replace function public.deal_submit_review(p_person uuid, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(public.deal_person_access(p_person), '') not in ('owner', 'tc') then raise exception 'Only the agent or their coordinator can submit a deal for review.'; end if;
  perform set_config('app.deal_rpc', '1', true);
  update public.people set compliance_status = 'submitted', compliance_updated_at = now(), compliance_by = null where id = p_person;
  update public.transaction_documents set review_status = null, review_note = '', reviewed_by = null, reviewed_at = null where person_id = p_person and review_status = 'issue';
  insert into public.deal_messages (person_id, author_id, kind, body) values (p_person, auth.uid(), 'submitted', coalesce(nullif(btrim(p_note), ''), 'Submitted for compliance review.'));
end;
$$;

-- An agent can see which coordinators are assigned to them for every deal, and compliance can see who coordinates what.
drop policy if exists deal_team_agent_read on public.deal_team;
create policy deal_team_agent_read on public.deal_team for select to authenticated
  using (agent_id = auth.uid() or public.deal_access(agent_id, null::uuid) = 'compliance');

-- 45. Email a coordinator when an agent picks them on a deal (api/deal-notify.js action "tc_assigned"); emailed_at keeps it to once per pick.
alter table public.deal_tcs add column if not exists emailed_at timestamptz;

-- ============================================================================
-- 46. Video plays on property sites. listing_events gains 'video_play' (detail: where it played, "gallery"); listing_analytics()
--     reports engagement.video_plays (visits that pressed play) and engagement.video_gallery (whether this listing has a video
--     in the gallery spot, so the dashboard knows to show the row even at zero).
-- ============================================================================
alter table public.listing_events drop constraint if exists listing_events_type_check;
alter table public.listing_events add constraint listing_events_type_check
  check (type in ('gallery_open', 'photo_view', 'phone_click', 'email_click', 'form_start', 'section', 'video_play'));

do $$
declare def text;
begin
  def := pg_get_functiondef('public.listing_analytics(uuid, integer, text)'::regprocedure);
  if def like '%video_plays%' then return; end if;
  def := replace(def,
    '''form_starts'', (select count(distinct view_id) from ev where type = ''form_start''),',
    '''form_starts'', (select count(distinct view_id) from ev where type = ''form_start''),
      ''video_plays'', (select count(distinct view_id) from ev where type = ''video_play''),
      ''video_gallery'', coalesce((select hero_video_url is not null and video_placement in (''gallery'', ''both'') from public.listings where id = p_listing_id), false),');
  if def not like '%video_plays%' then raise exception 'listing_analytics was not changed'; end if;
  execute def;
end $$;

-- ============================================================================
-- 47. Domain monitoring. domain_health remembers how each property site's custom domain checked out last time (written only by
--     api/_lib/domainCheck.js with the service role: no client policies), so an email goes out once when a domain that was working
--     stops responding, and once when it comes back. An admin turns the emails on in My Profile (domain_alerts); it is off by default.
-- ============================================================================
create table if not exists public.domain_health (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  org_id uuid,
  domain text not null,
  status text not null,
  last_checked_at timestamptz not null default now(),
  last_ok_at timestamptz,
  down_since timestamptz,
  alerted_at timestamptz
);
alter table public.domain_health enable row level security;
revoke all on public.domain_health from anon, authenticated;

alter table public.agent_notification_settings add column if not exists domain_alerts boolean not null default false;

-- ============================================================================
-- 48. Monitoring for bots. A 'monitoring' scope lets a bot read what is wrong (GET /v1/alerts, currently property-site domains that
--     aren't responding) and, optionally, be told the moment something breaks: a token can have a webhook address, and when a working
--     domain stops responding (or returns) the server POSTs a signed JSON event there (api/_lib/webhooks.js). The signing secret is
--     shown once when the webhook is set and is never readable by the dashboard (no column grant), only by the server.
-- ============================================================================
alter table public.api_tokens drop constraint if exists api_tokens_scopes_check;
alter table public.api_tokens add constraint api_tokens_scopes_check check (scopes <@ array['blog', 'agents', 'sites', 'listings', 'people', 'monitoring']::text[] and cardinality(scopes) > 0);

create or replace function public.create_api_token(p_name text, p_scopes text[]) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an admin can create an API token.';
  end if;
  if p_scopes is null or cardinality(p_scopes) = 0 or not (p_scopes <@ array['blog', 'agents', 'sites', 'listings', 'people', 'monitoring']::text[]) then
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

create table if not exists public.api_token_webhooks (
  token_id uuid primary key references public.api_tokens(id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 500),
  secret text not null,
  last_status text,
  last_attempt_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.api_token_webhooks enable row level security;
revoke all on public.api_token_webhooks from anon, authenticated;
grant select (token_id, url, last_status, last_attempt_at, created_at) on public.api_token_webhooks to authenticated;
drop policy if exists api_token_webhooks_owner_read on public.api_token_webhooks;
create policy api_token_webhooks_owner_read on public.api_token_webhooks for select to authenticated
  using (exists (select 1 from public.api_tokens t where t.id = token_id and t.owner_id = auth.uid()));

-- Set (or, with an empty address, remove) a token's webhook. Returns the signing secret, shown once; setting it again makes a new secret.
create or replace function public.set_token_webhook(p_token uuid, p_url text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_secret text;
  v_url text := btrim(coalesce(p_url, ''));
begin
  if not exists (select 1 from public.api_tokens t join public.profiles p on p.id = t.owner_id
                 where t.id = p_token and t.owner_id = auth.uid() and t.revoked_at is null and p.role = 'admin' and 'monitoring' = any(t.scopes)) then
    raise exception 'That token can''t have a webhook (it needs the monitoring scope and to be yours).';
  end if;
  if v_url = '' then
    delete from public.api_token_webhooks where token_id = p_token;
    return null;
  end if;
  if v_url !~ '^https://[^\s]+$' or length(v_url) > 500 then raise exception 'The webhook address must start with https:// and be under 500 characters.'; end if;
  v_secret := 'whsec_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.api_token_webhooks (token_id, url, secret) values (p_token, v_url, v_secret)
  on conflict (token_id) do update set url = excluded.url, secret = excluded.secret, last_status = null, last_attempt_at = null;
  return v_secret;
end;
$$;
revoke all on function public.set_token_webhook(uuid, text) from public, anon;
grant execute on function public.set_token_webhook(uuid, text) to authenticated;

-- ============================================================================
-- 49. A coordinator starts a deal for an agent. deal_start_for_agent() makes the deal on the agent's board (it is the agent's deal, and
--     their private contact is made as for any new card), puts the coordinator on it, and leaves a first message in its thread. The
--     agent is told by email (api/deal-notify.js action "deal_started"); agent_emailed_at keeps that to once. The coordinator can pick
--     any agent in the office who has the People module on.
-- ============================================================================
alter table public.deal_tcs
  add column if not exists started_by_tc boolean not null default false,
  add column if not exists agent_emailed_at timestamptz;

create or replace function public.deal_start_for_agent(
  p_agent uuid, p_name text, p_side text, p_property_address text default '', p_phone text default '', p_email text default '',
  p_price numeric default null, p_contract_date date default null, p_closing_date date default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me record;
  v_stage text;
  v_id uuid;
begin
  select id, org_id, full_name, deals_role into me from public.profiles where id = auth.uid();
  if me.id is null or me.deals_role is distinct from 'tc' then raise exception 'Only a transaction coordinator can start a deal for an agent.'; end if;
  if p_agent is null or p_agent = me.id or not exists (select 1 from public.profiles a where a.id = p_agent and a.org_id = me.org_id and a.people_enabled) then
    raise exception 'Pick an agent in your office who uses Deals.';
  end if;
  if btrim(coalesce(p_name, '')) = '' then raise exception 'Add the client''s name.'; end if;
  if p_side not in ('buyer', 'seller') then raise exception 'Choose buyer or seller.'; end if;
  select coalesce(nullif(s.stages #>> '{transaction,0}', ''), 'Pending') into v_stage from (select 1) x left join public.people_settings s on s.owner_id = p_agent;
  insert into public.people (owner_id, name, phone, email, stage_group, stage, side, property_address, price, contract_date, closing_date, source)
  values (p_agent, btrim(p_name), btrim(coalesce(p_phone, '')), btrim(coalesce(p_email, '')), 'transaction', coalesce(v_stage, 'Pending'), p_side, btrim(coalesce(p_property_address, '')), p_price, p_contract_date, p_closing_date, '')
  returning id into v_id;
  insert into public.deal_tcs (person_id, tc_id, assigned_by, started_by_tc) values (v_id, me.id, me.id, true);
  insert into public.deal_messages (person_id, author_id, kind, body) values (v_id, me.id, 'message', coalesce(me.full_name, 'The coordinator') || ' started this deal and is coordinating it.');
  return v_id;
end;
$$;
revoke all on function public.deal_start_for_agent(uuid, text, text, text, text, text, numeric, date, date) from public, anon;
grant execute on function public.deal_start_for_agent(uuid, text, text, text, text, text, numeric, date, date) to authenticated;
