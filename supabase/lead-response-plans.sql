-- =====================================================================
-- Lead response: how fast a new lead is answered, and follow-up plans.
--
-- 1. people.first_response_at: when the agent first reached out to a website lead (a call, text or email tapped from their card, "Followed up",
--    or a drafted message marked sent). It drives the "Waiting 12 min" / "Responded in 4 min" badge, the Leads bubble and the response-time tile.
--    Leads that already exist count as handled, so only new ones show as waiting.
-- 2. plans: a plan is timed steps counted from the day someone enters it. A step creates a to-do for the agent, a DRAFT message for them to send
--    (nothing is sent), or moves the person to another column. plan_enrollments are the people on a plan. The steps are run by api/plans.js.
--    An active plan can start by itself when someone is added with a given source, or enters a given column; it stops by itself when the person is
--    moved, archived or becomes a deal.
-- =====================================================================

alter table public.people add column if not exists first_response_at timestamptz;
update public.people set first_response_at = created_at where lead_id is not null and first_response_at is null;
create index if not exists people_waiting_idx on public.people (owner_id) where lead_id is not null and first_response_at is null and not archived;

-- A drafted message marked sent is a first response.
create or replace function public.outreach_first_response() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if new.status = 'sent' and old.status is distinct from 'sent' then
    update public.people set first_response_at = coalesce(first_response_at, now()) where id = new.person_id and lead_id is not null;
  end if;
  return new;
end;
$$;
drop trigger if exists outreach_first_response on public.people_outreach;
create trigger outreach_first_response after update of status on public.people_outreach for each row execute function public.outreach_first_response();

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  starts_when jsonb not null default '{"type": "manual"}'::jsonb,
  steps jsonb not null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_steps_check check (jsonb_typeof(steps) = 'array' and jsonb_array_length(steps) between 1 and 20),
  constraint plans_trigger_check check (jsonb_typeof(starts_when) = 'object' and starts_when ->> 'type' in ('manual', 'source', 'column'))
);
create index if not exists plans_owner_idx on public.plans (owner_id, active);

create table if not exists public.plan_enrollments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete cascade,
  started_on date not null default ((now() at time zone 'America/Chicago')::date),
  next_step integer not null default 0 check (next_step >= 0),
  next_due date,
  status text not null default 'active' check (status in ('active', 'paused', 'done', 'stopped')),
  stop_reason text not null default '',
  expect_stage text,
  log jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists plan_enrollments_one on public.plan_enrollments (plan_id, person_id);
create index if not exists plan_enrollments_due_idx on public.plan_enrollments (next_due) where status = 'active';
create index if not exists plan_enrollments_person_idx on public.plan_enrollments (person_id);

-- Private to the agent, and only while People is on for them (like the rest of People).
alter table public.plans enable row level security;
alter table public.plan_enrollments enable row level security;
revoke all on public.plans, public.plan_enrollments from anon;
drop policy if exists plans_owner_all on public.plans;
create policy plans_owner_all on public.plans for all to authenticated
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));
drop policy if exists plan_enrollments_owner_all on public.plan_enrollments;
create policy plan_enrollments_owner_all on public.plan_enrollments for all to authenticated
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

-- A person can only be put on a plan by their own agent.
create or replace function public.plan_enrollment_check() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if not exists (select 1 from public.people pe join public.plans pl on pl.id = new.plan_id where pe.id = new.person_id and pe.owner_id = new.owner_id and pl.owner_id = new.owner_id) then
    raise exception 'That person or plan isn''t yours.';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists plan_enrollment_check on public.plan_enrollments;
create trigger plan_enrollment_check before insert or update on public.plan_enrollments for each row execute function public.plan_enrollment_check();

create or replace function public.plans_touch() returns trigger language plpgsql as $$ begin new.updated_at := now(); return new; end; $$;
drop trigger if exists plans_touch on public.plans;
create trigger plans_touch before update on public.plans for each row execute function public.plans_touch();

-- Stop: someone moved to another column, archived, or turned into a deal stops their plans (the plan's own "move" step is let through).
-- Named "a" so it runs before the enrolling trigger below, which would otherwise be stopped by it right away.
create or replace function public.plan_stop_on_change() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if new.archived and not old.archived then
    update public.plan_enrollments set status = 'stopped', stop_reason = 'Archived' where person_id = new.id and status in ('active', 'paused');
  elsif new.stage_group is distinct from old.stage_group or new.stage is distinct from old.stage then
    update public.plan_enrollments
       set status = 'stopped', stop_reason = case when new.stage_group = 'transaction' then 'Became a deal' else 'Moved to ' || new.stage end
     where person_id = new.id and status in ('active', 'paused') and not (expect_stage is not null and expect_stage = new.stage);
    update public.plan_enrollments set expect_stage = null where person_id = new.id and expect_stage = new.stage;
  end if;
  return new;
end;
$$;
drop trigger if exists plan_a_stop on public.people;
create trigger plan_a_stop after update of archived, stage, stage_group on public.people for each row execute function public.plan_stop_on_change();

-- Start: an active plan that starts "when someone has a source" (a new person) or "when someone enters a column".
create or replace function public.plan_auto_enroll() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  pl record;
  today date := (now() at time zone 'America/Chicago')::date;
  moved boolean;
begin
  moved := case when tg_op = 'INSERT' then true else (new.stage is distinct from old.stage or new.stage_group is distinct from old.stage_group) end;
  if new.archived or new.stage_group = 'transaction' then return new; end if;
  for pl in select id, starts_when, steps from public.plans where owner_id = new.owner_id and active loop
    if (pl.starts_when ->> 'type' = 'source' and tg_op = 'INSERT' and new.source = pl.starts_when ->> 'value')
       or (pl.starts_when ->> 'type' = 'column' and moved and pl.starts_when ->> 'group' = new.stage_group and pl.starts_when ->> 'stage' = new.stage) then
      insert into public.plan_enrollments (plan_id, owner_id, person_id, started_on, next_step, next_due)
      values (pl.id, new.owner_id, new.id, today, 0, today + coalesce((pl.steps -> 0 ->> 'day')::int, 0))
      on conflict (plan_id, person_id) do nothing;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists plan_b_enroll_ins on public.people;
create trigger plan_b_enroll_ins after insert on public.people for each row execute function public.plan_auto_enroll();
drop trigger if exists plan_b_enroll_upd on public.people;
create trigger plan_b_enroll_upd after update of stage, stage_group on public.people for each row
  when (new.stage is distinct from old.stage or new.stage_group is distinct from old.stage_group) execute function public.plan_auto_enroll();
