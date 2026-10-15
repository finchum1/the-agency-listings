-- MULTI-TENANT PHASE 1, PART E: one registry for every domain, kept in sync automatically.
-- Run after parts A to D. Apply to STAGING first.
--
-- Today a custom domain lives in listings.custom_domain, agent_sites.custom_domain or brokerage_site.custom_domain,
-- and "one site per domain" is only enforced inside each table. That lets one organization attach a domain another
-- organization already uses on a different kind of site (an agent-site claim even outranks a brokerage claim when the
-- request is routed). This part mirrors every site domain into org_domains, whose primary key is the domain, so a domain
-- can belong to exactly one site in the whole database. The existing "That custom domain is already attached to another
-- site" error (unique violation) fires for those cross-table, cross-organization clashes too.
--
-- org_domains rows come in three kinds of origin:
--   * source 'agent_site' / 'listing' / 'brokerage_site': maintained by the trigger below, never edited by hand
--   * source 'manual', kind 'app': a brokerage's own dashboard/login domain (platform owner adds it)
-- and may carry a Google Search Console verification token (replaces the hardcoded map in api/meta-custom-domain.js).

alter table public.org_domains
  add column source text not null default 'manual' check (source in ('manual', 'agent_site', 'listing', 'brokerage_site')),
  add column source_id uuid,
  add column google_site_verification text;

create unique index org_domains_source_idx on public.org_domains (source, source_id) where source_id is not null;

create or replace function public.sync_org_domain() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  src text := case tg_table_name when 'agent_sites' then 'agent_site' when 'listings' then 'listing' else 'brokerage_site' end;
  new_domain text;
begin
  if tg_op = 'DELETE' then
    delete from public.org_domains where source = src and source_id = old.id;
    return old;
  end if;

  new_domain := nullif(lower(btrim(new.custom_domain)), '');
  if new_domain is null then
    delete from public.org_domains where source = src and source_id = new.id;
  else
    -- The primary key on domain makes a second claim by ANY other site fail with a unique violation.
    -- If this same site changes its domain, the old row is updated in place; a Search Console token belongs
    -- to the domain, so it is dropped if the domain changes.
    insert into public.org_domains (domain, org_id, kind, verified, source, source_id)
    values (new_domain, new.org_id, 'site', true, src, new.id)
    on conflict (source, source_id) where source_id is not null do update
      set google_site_verification = case when public.org_domains.domain = excluded.domain then public.org_domains.google_site_verification end,
          domain = excluded.domain,
          org_id = excluded.org_id;
  end if;
  return new;
end;
$$;

create trigger sync_org_domain after insert or update of custom_domain, org_id or delete on public.agent_sites
  for each row execute function public.sync_org_domain();
create trigger sync_org_domain after insert or update of custom_domain, org_id or delete on public.listings
  for each row execute function public.sync_org_domain();
create trigger sync_org_domain after insert or update of custom_domain, org_id or delete on public.brokerage_site
  for each row execute function public.sync_org_domain();

-- Backfill from what exists today. If two sites already shared a domain, this fails loudly: fix that first.
insert into public.org_domains (domain, org_id, kind, verified, source, source_id)
select lower(btrim(custom_domain)), org_id, 'site', true, 'agent_site', id from public.agent_sites where nullif(btrim(custom_domain), '') is not null
union all
select lower(btrim(custom_domain)), org_id, 'site', true, 'listing', id from public.listings where nullif(btrim(custom_domain), '') is not null
union all
select lower(btrim(custom_domain)), org_id, 'site', true, 'brokerage_site', id from public.brokerage_site where nullif(btrim(custom_domain), '') is not null;

-- The Search Console token that was hardcoded in api/meta-custom-domain.js and middleware.js
update public.org_domains
set google_site_verification = 'e9f3EdK-JafciudKWSUna24_LF_kM-70yBL6jZsUi-Q'
where domain = 'terrencefinchum.com';
