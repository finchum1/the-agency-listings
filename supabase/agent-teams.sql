-- Teams: agents who work together under a team name (e.g. "Petry Signature Team").
--
-- Every agent keeps their own profile, login, listings and site. A team is just a name that profiles can be linked to (profiles.team_id).
-- A listing whose agent is on a team shows the whole team on its property site (and flyer, social post, inquiry emails); the agent site can
-- show a "team" section. listings.show_team lets one listing opt out and show only its own agent.
--
-- Who can do what:
--   read   anyone (a team's name is public, like an agent's name)
--   write  an admin of the team's organization (can_manage_org), the same people who manage agents
--   link   only an admin can put an agent on a team or take them off (added to guard_profile_privileged_columns below), and the team must be in
--          the agent's own organization.

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists teams_org_idx on public.teams (org_id);

alter table public.teams enable row level security;
drop policy if exists teams_read on public.teams;
create policy teams_read on public.teams for select using (true);
drop policy if exists teams_manage on public.teams;
create policy teams_manage on public.teams for all
  using (public.can_manage_org(org_id)) with check (public.can_manage_org(org_id));

alter table public.profiles add column if not exists team_id uuid references public.teams(id) on delete set null;
create index if not exists profiles_team_idx on public.profiles (team_id) where team_id is not null;
alter table public.listings add column if not exists show_team boolean not null default true;

-- A teammate has to be readable on the public site even if they have no published listing or site of their own yet, as long as someone on
-- their team does. (A function, because the policy on profiles can't look back into profiles without recursing.)
create or replace function public.team_is_public(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.team_id = t
      and (exists (select 1 from public.listings l where l.agent_id = p.id and l.status <> 'draft')
        or exists (select 1 from public.agent_sites s where s.agent_id = p.id and s.status <> 'draft'))
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid()
  or org_id = public.current_org_id()
  or public.is_platform_admin()
  or exists (select 1 from public.agent_sites s where s.agent_id = profiles.id and s.status <> 'draft')
  or exists (select 1 from public.listings l where l.agent_id = profiles.id and l.status <> 'draft')
  or (team_id is not null and public.team_is_public(team_id))
);

-- Changing someone's team is an admin-only change, like their role. Same function as before with team_id added to the list.
create or replace function public.guard_profile_privileged_columns()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  if auth.uid() is null then return new; end if;
  if public.is_platform_admin() then return new; end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'Only the platform owner can change which organization an account belongs to.';
  end if;
  if new.role is distinct from old.role
     or new.site_access is distinct from old.site_access
     or new.people_enabled is distinct from old.people_enabled
     or new.ai_access is distinct from old.ai_access
     or new.deals_role is distinct from old.deals_role
     or new.login_enabled is distinct from old.login_enabled
     or new.team_id is distinct from old.team_id then
    if exists (
      select 1 from public.profiles p join public.organizations o on o.id = p.org_id
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = old.org_id and o.type = 'brokerage'
    ) then
      return new;
    end if;
    raise exception 'Only an admin can change role, site access, People access, AI access, Deals role, login access, or team.';
  end if;
  return new;
end;
$function$;

-- A team and its members are always in the same organization (the platform owner can't link across by accident either).
create or replace function public.profiles_team_same_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.team_id is not null and not exists (select 1 from public.teams t where t.id = new.team_id and t.org_id = new.org_id) then
    raise exception 'A team can only include agents from its own organization.';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_team_same_org on public.profiles;
create trigger profiles_team_same_org before insert or update of team_id on public.profiles
  for each row execute function public.profiles_team_same_org();
