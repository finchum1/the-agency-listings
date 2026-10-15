-- MULTI-TENANT PHASE 1, PART F: logo color and accent color rules follow each organization's own brand.
-- Run after part A (needs organizations.brand). Safe to re-run. Apply to STAGING first.
--
-- Until now listings, agent_sites and brokerage_site had checks hardcoded to The Agency: logo_variant in
-- (red, white, black) and accent_color in (#ed2127, #000000). Those checks are replaced by plain format checks, and a
-- trigger enforces the real rule per organization: the accent must be one of that organization's brand.accent_colors,
-- and the logo must be one of its brand.logos. The dashboard pickers offer exactly those lists.
--   * accent_color: anything outside the organization's list is rejected (an organization with no list may only use null)
--   * logo_variant: a value the organization doesn't have is replaced by its default logo, so column defaults ('red')
--     never block a row for an organization whose logos are named differently. No logos at all: left alone (the
--     site shows the organization's name instead of a logo).

alter table public.listings drop constraint if exists listings_accent_color_check;
alter table public.listings add constraint listings_accent_color_check check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$');
alter table public.listings drop constraint if exists listings_logo_variant_check;
alter table public.listings add constraint listings_logo_variant_check check (logo_variant ~ '^[a-z0-9_-]{1,32}$');

alter table public.agent_sites drop constraint if exists agent_sites_accent_color_check;
alter table public.agent_sites add constraint agent_sites_accent_color_check check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$');
alter table public.agent_sites drop constraint if exists agent_sites_logo_variant_check;
alter table public.agent_sites add constraint agent_sites_logo_variant_check check (logo_variant ~ '^[a-z0-9_-]{1,32}$');

alter table public.brokerage_site drop constraint if exists brokerage_site_accent_color_check;
alter table public.brokerage_site add constraint brokerage_site_accent_color_check check (accent_color is null or accent_color ~* '^#[0-9a-f]{6}$');
alter table public.brokerage_site drop constraint if exists brokerage_site_logo_variant_check;
alter table public.brokerage_site add constraint brokerage_site_logo_variant_check check (logo_variant ~ '^[a-z0-9_-]{1,32}$');

create or replace function public.enforce_brand_choices() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  b jsonb;
  logos jsonb;
begin
  select brand into b from public.organizations where id = new.org_id;
  b := coalesce(b, '{}'::jsonb);

  if new.accent_color is not null
     and not exists (
       select 1 from jsonb_array_elements_text(coalesce(b -> 'accent_colors', '[]'::jsonb)) c
       where lower(c) = lower(new.accent_color)
     ) then
    raise exception 'Accent color % is not one of this organization''s brand colors', new.accent_color
      using errcode = 'check_violation';
  end if;

  logos := coalesce(b -> 'logos', '{}'::jsonb);
  if logos <> '{}'::jsonb and not (logos ? new.logo_variant) then
    new.logo_variant := case
      when logos ? (b ->> 'default_logo') then b ->> 'default_logo'
      when logos ? 'red' then 'red'
      else (select k from jsonb_object_keys(logos) k order by k limit 1)
    end;
  end if;
  return new;
end;
$$;

-- Named so it fires after set_org_id (triggers on one table run alphabetically): new.org_id is already stamped.
create or replace trigger validate_brand_choices before insert or update of org_id, accent_color, logo_variant on public.listings
  for each row execute function public.enforce_brand_choices();
create or replace trigger validate_brand_choices before insert or update of org_id, accent_color, logo_variant on public.agent_sites
  for each row execute function public.enforce_brand_choices();
create or replace trigger validate_brand_choices before insert or update of org_id, accent_color, logo_variant on public.brokerage_site
  for each row execute function public.enforce_brand_choices();
