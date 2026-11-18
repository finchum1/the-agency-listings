-- Co-listing agents: a property site can show a second agent beside the listing agent (two agents who list together but are not a team).
-- A separate table instead of a second agent column on listings: a second foreign key from listings to profiles would make every existing
-- `agent:profiles(...)` query ambiguous (and see the primary-key note below). The table also keeps room for more than one co-agent later (the form offers one for now).
--
-- What a co-listing agent gets (decided with Terrence): they appear on the property site, flyer and social post, they are emailed every
-- inquiry (api/contact.js), and the listing shows in their own Listings list with its analytics, read-only. Only the listing agent or an
-- admin edits it.
-- NOTE: the primary key is a surrogate id, not (listing_id, agent_id). A table whose primary key is made of foreign keys to both listings and
-- profiles is a "junction table" to PostgREST, which then sees listings <-> profiles as many-to-many and makes EVERY `agent:profiles(...)` embed on
-- listings ambiguous (PGRST201: property sites 404). The unique constraint keeps one row per listing and agent. (Found and fixed on 2026-11-18.)
create table if not exists public.listing_co_agents (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  agent_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint listing_co_agents_unique unique (listing_id, agent_id)
);
create index if not exists listing_co_agents_agent_idx on public.listing_co_agents (agent_id);
alter table public.listing_co_agents enable row level security;

-- SECURITY DEFINER helpers so the policies on listings, profiles and friends can ask "is this a co-agent row?" without the two tables' policies
-- referring to each other (Postgres rejects that as infinite recursion).
create or replace function public.is_listing_co_agent(p_listing uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listing_co_agents c where c.listing_id = p_listing and c.agent_id = (select auth.uid()));
$$;
create or replace function public.is_public_co_agent(p_profile uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.listing_co_agents c join public.listings l on l.id = c.listing_id where c.agent_id = p_profile and l.status <> 'draft');
$$;

-- listing_co_agents: readable wherever the listing is (public once published), by the listing's agent and admins always, and by the co-agent themself.
drop policy if exists listing_co_agents_read on public.listing_co_agents;
create policy listing_co_agents_read on public.listing_co_agents for select using (
  agent_id = (select auth.uid())
  or exists (select 1 from public.listings l where l.id = listing_co_agents.listing_id
             and (l.status <> 'draft' or l.agent_id = (select auth.uid()) or public.can_manage_org(l.org_id)))
);
drop policy if exists listing_co_agents_write on public.listing_co_agents;
create policy listing_co_agents_write on public.listing_co_agents for all
  using (exists (select 1 from public.listings l where l.id = listing_co_agents.listing_id and (l.agent_id = (select auth.uid()) or public.can_manage_org(l.org_id))))
  with check (exists (select 1 from public.listings l where l.id = listing_co_agents.listing_id and (l.agent_id = (select auth.uid()) or public.can_manage_org(l.org_id))));

-- A co-agent works in the same office as the listing and is not the listing's own agent.
create or replace function public.check_listing_co_agent() returns trigger language plpgsql security definer set search_path = public as $$
declare l_org uuid; l_agent uuid; p_org uuid;
begin
  select org_id, agent_id into l_org, l_agent from public.listings where id = new.listing_id;
  select org_id into p_org from public.profiles where id = new.agent_id;
  if new.agent_id = l_agent then raise exception 'The listing agent cannot also be the co-listing agent.'; end if;
  if p_org is distinct from l_org then raise exception 'A co-listing agent must be in the same office as the listing.'; end if;
  return new;
end $$;
drop trigger if exists listing_co_agents_check on public.listing_co_agents;
create trigger listing_co_agents_check before insert or update on public.listing_co_agents for each row execute function public.check_listing_co_agent();

-- Reassigning a listing to its co-agent drops them from the co-agent list.
create or replace function public.drop_co_agent_on_reassign() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.agent_id is distinct from old.agent_id then
    delete from public.listing_co_agents where listing_id = new.id and agent_id = new.agent_id;
  end if;
  return new;
end $$;
drop trigger if exists listings_drop_co_agent on public.listings;
create trigger listings_drop_co_agent after update of agent_id on public.listings for each row execute function public.drop_co_agent_on_reassign();

-- Read access for the co-agent: the listing itself (drafts too), its analytics, and the profile card shown on the public site.
drop policy if exists listings_member_read on public.listings;
create policy listings_member_read on public.listings for select using (
  (select auth.uid()) = agent_id or public.can_manage_org(org_id) or public.is_listing_co_agent(id)
);

drop policy if exists listing_events_read on public.listing_events;
create policy listing_events_read on public.listing_events for select using (
  public.can_manage_org(org_id)
  or exists (select 1 from public.listings l where l.id = listing_events.listing_id and l.agent_id = (select auth.uid()))
  or public.is_listing_co_agent(listing_events.listing_id)
);

drop policy if exists page_views_read on public.page_views;
create policy page_views_read on public.page_views for select using (
  public.can_manage_org(org_id)
  or (target_type = 'listing' and (
        exists (select 1 from public.listings l where l.id = page_views.target_id and l.agent_id = (select auth.uid()))
        or public.is_listing_co_agent(page_views.target_id)))
  or (target_type = 'agent_site' and exists (select 1 from public.agent_sites s where s.id = page_views.target_id and s.agent_id = (select auth.uid())))
  or (target_type = 'agent_post' and exists (
        select 1 from public.agent_site_posts ap join public.agent_sites s on s.id = ap.agent_site_id
        where ap.id = page_views.target_id and s.agent_id = (select auth.uid())))
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = (select auth.uid())
  or org_id = public.current_org_id()
  or public.is_platform_admin()
  or exists (select 1 from public.agent_sites s where s.agent_id = profiles.id and s.status <> 'draft')
  or exists (select 1 from public.listings l where l.agent_id = profiles.id and l.status <> 'draft')
  or public.is_public_co_agent(profiles.id)
  or (team_id is not null and public.team_is_public(team_id))
);

-- The two trigger functions don't need to be callable through the API (the helper functions above must stay callable: the policies use them).
revoke execute on function public.check_listing_co_agent() from public, anon, authenticated;
revoke execute on function public.drop_co_agent_on_reassign() from public, anon, authenticated;
