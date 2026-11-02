-- =====================================================================
-- Birthday and home-anniversary plans.
--
-- A plan can now start "on a contact's birthday" or "on a contact's home anniversary" (starts_when type 'birthday' / 'anniversary', with how many
-- days ahead to run and which relationships it covers). They run on CONTACTS (that's where those dates live), once a year per contact. Their steps
-- are to-dos (a drafted message rides along on the to-do); nothing is sent. plan_occasion_runs remembers who a plan already ran for, so a plan runs
-- once per contact per year however often the schedule checks.
-- =====================================================================

alter table public.plans drop constraint if exists plans_trigger_check;
alter table public.plans add constraint plans_trigger_check
  check (jsonb_typeof(starts_when) = 'object' and starts_when ->> 'type' in ('manual', 'source', 'column', 'birthday', 'anniversary'));

create table if not exists public.plan_occasion_runs (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  occasion_on date not null,
  created_at timestamptz not null default now(),
  unique (plan_id, contact_id, occasion_on)
);
create index if not exists plan_occasion_runs_owner_idx on public.plan_occasion_runs (owner_id, plan_id);
alter table public.plan_occasion_runs enable row level security;
revoke all on public.plan_occasion_runs from anon;
drop policy if exists plan_occasion_runs_owner_read on public.plan_occasion_runs;
create policy plan_occasion_runs_owner_read on public.plan_occasion_runs for select to authenticated using (owner_id = auth.uid());

-- Contacts whose birthday / home anniversary falls on a given day (any year). A Feb 29 date counts on Feb 28 in years without one.
-- Only the server (service role) calls this.
create or replace function public.plans_due_occasions(p_owner uuid, p_kind text, p_on date)
returns table (contact_id uuid, first_name text, last_name text, company text, email text, phone text, relationship text, occasion_date date)
language sql stable security definer set search_path = public as
$$
  with t as (
    select p_on as d,
           (extract(year from p_on)::int % 4 = 0 and (extract(year from p_on)::int % 100 <> 0 or extract(year from p_on)::int % 400 = 0)) as leap
  )
  select c.id, c.first_name, c.last_name, c.company, c.email, c.phone, c.relationship,
         case when p_kind = 'birthday' then c.birthday else c.home_anniversary end
  from public.contacts c, t
  where c.owner_id = p_owner and not c.archived and not c.do_not_contact
    and p_kind in ('birthday', 'anniversary')
    and (case when p_kind = 'birthday' then c.birthday else c.home_anniversary end) is not null
    and (
      (extract(month from (case when p_kind = 'birthday' then c.birthday else c.home_anniversary end)) = extract(month from t.d)
       and extract(day from (case when p_kind = 'birthday' then c.birthday else c.home_anniversary end)) = extract(day from t.d))
      or (not t.leap and extract(month from t.d) = 2 and extract(day from t.d) = 28
          and extract(month from (case when p_kind = 'birthday' then c.birthday else c.home_anniversary end)) = 2
          and extract(day from (case when p_kind = 'birthday' then c.birthday else c.home_anniversary end)) = 29)
    );
$$;
revoke all on function public.plans_due_occasions(uuid, text, date) from public, anon, authenticated;
grant execute on function public.plans_due_occasions(uuid, text, date) to service_role;
