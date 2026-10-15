-- MULTI-TENANT PHASE 1, PART B: constraints, indexes, and organization-stamping triggers.
-- Run after part A. Apply to STAGING first.
--
-- Every new row is stamped with its organization by a trigger, so existing app code that
-- inserts rows keeps working without sending an org_id:
--   * rows owned by an agent (listings, agent_sites, upcoming_listings, buyer_needs) take their agent's organization
--   * leads and page views take the organization of what they point at
--   * brokerage pages take the signed-in user's organization unless one is given explicitly
-- Brokerage tables stop being "one row for the whole database" and become one set per organization.

-- ------------------------------------------------------------ required org_id
alter table public.listings alter column org_id set not null;
alter table public.agent_sites alter column org_id set not null;
alter table public.leads alter column org_id set not null;
alter table public.page_views alter column org_id set not null;
alter table public.upcoming_listings alter column org_id set not null;
alter table public.buyer_needs alter column org_id set not null;
alter table public.brokerage_site alter column org_id set not null;
alter table public.brokerage_agents alter column org_id set not null;
alter table public.brokerage_areas alter column org_id set not null;
alter table public.brokerage_posts alter column org_id set not null;

-- ------------------------------------------------------------------- indexes
create index profiles_org_idx on public.profiles(org_id);
create index listings_org_idx on public.listings(org_id);
create index agent_sites_org_idx on public.agent_sites(org_id);
create index leads_org_idx on public.leads(org_id, created_at desc);
create index page_views_org_idx on public.page_views(org_id, created_at desc);
create index upcoming_listings_org_idx on public.upcoming_listings(org_id);
create index buyer_needs_org_idx on public.buyer_needs(org_id);
create index brokerage_agents_org_idx on public.brokerage_agents(org_id);
create index brokerage_areas_org_idx on public.brokerage_areas(org_id);
create index brokerage_posts_org_idx on public.brokerage_posts(org_id);
create index area_template_areas_org_idx on public.area_template_areas(org_id);

-- ------------------------------------------------- per-organization uniqueness
alter table public.brokerage_site drop constraint brokerage_site_singleton;
alter table public.brokerage_site add constraint brokerage_site_org_key unique (org_id);

alter table public.brokerage_agents drop constraint brokerage_agents_slug_key;
alter table public.brokerage_agents add constraint brokerage_agents_org_slug_key unique (org_id, slug);
alter table public.brokerage_areas drop constraint brokerage_areas_slug_key;
alter table public.brokerage_areas add constraint brokerage_areas_org_slug_key unique (org_id, slug);
alter table public.brokerage_posts drop constraint brokerage_posts_slug_key;
alter table public.brokerage_posts add constraint brokerage_posts_org_slug_key unique (org_id, slug);

-- ------------------------------------------------------ organization stamping
create or replace function public.set_org_id() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if tg_table_name in ('listings', 'agent_sites', 'upcoming_listings', 'buyer_needs') then
    -- always the owning agent's organization, whatever the caller sent
    select org_id into new.org_id from public.profiles where id = new.agent_id;

  elsif tg_table_name = 'leads' then
    new.org_id := case new.target_type
      when 'listing' then (select org_id from public.listings where id = new.target_id)
      when 'agent_site' then (select org_id from public.agent_sites where id = new.target_id)
      when 'brokerage_valuation' then (select org_id from public.brokerage_site where id = new.target_id)
    end;
    if new.org_id is null and new.agent_id is not null then
      select org_id into new.org_id from public.profiles where id = new.agent_id;
    end if;

  elsif tg_table_name = 'page_views' then
    new.org_id := case new.target_type
      when 'listing' then (select org_id from public.listings where id = new.target_id)
      when 'agent_site' then (select org_id from public.agent_sites where id = new.target_id)
      when 'agent_post' then (select s.org_id from public.agent_site_posts p join public.agent_sites s on s.id = p.agent_site_id where p.id = new.target_id)
      when 'brokerage_site' then (select org_id from public.brokerage_site where id = new.target_id)
      when 'brokerage_post' then (select org_id from public.brokerage_posts where id = new.target_id)
    end;

  else
    -- brokerage_site / agents / areas / posts: explicit org (platform owner working inside a client) or the user's own
    new.org_id := coalesce(new.org_id, public.current_org_id());
  end if;
  return new;
end;
$$;

create trigger set_org_id before insert or update of agent_id, org_id on public.listings for each row execute function public.set_org_id();
create trigger set_org_id before insert or update of agent_id, org_id on public.agent_sites for each row execute function public.set_org_id();
create trigger set_org_id before insert or update of agent_id, org_id on public.upcoming_listings for each row execute function public.set_org_id();
create trigger set_org_id before insert or update of agent_id, org_id on public.buyer_needs for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.leads for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.page_views for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.brokerage_site for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.brokerage_agents for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.brokerage_areas for each row execute function public.set_org_id();
create trigger set_org_id before insert on public.brokerage_posts for each row execute function public.set_org_id();
