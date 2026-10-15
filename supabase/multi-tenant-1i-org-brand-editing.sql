-- MULTI-TENANT PHASE 2: let an organization's own admins edit its brand (name, location label, logos, colors,
-- address, disclaimer), while only the platform owner can change what the organization IS (slug, type, status) or a
-- franchise organization's locked brand. Run after part A and part F. Safe to re-run. Apply to STAGING first.
--
-- Until now only the platform owner could write `organizations`. The Brand settings page needs organization
-- admins to update their own row, so:
--   * a new UPDATE policy lets an organization's admin update that organization (can_manage_org);
--   * a trigger takes away everything an organization admin must not touch:
--       - slug, type, status, id            (identity and billing state: platform owner only)
--       - franchise_disclaimer              (legal text: platform owner only)
--       - for a franchise organization (brand.franchise set, e.g. "the-agency"): logos, default_logo,
--         accent_colors and the franchise flag itself, because those are the franchisor's brand, not the office's
--   * the same trigger validates brand JSON on insert and update for everyone, so a bad value can't reach the public sites:
--       - logos: an object of short keys -> an address starting with "/" or "https://" (never javascript: or data:)
--       - accent_colors: up to 6 six-digit hex colors
--       - location_label / admin_name / service_area: plain text with sane lengths
--   * brand edits are written to audit_log (who, which organization, what changed).

drop policy if exists organizations_admin_update on public.organizations;
create policy organizations_admin_update on public.organizations for update to authenticated
  using (public.can_manage_org(id)) with check (public.can_manage_org(id));

create or replace function public.guard_organization_write() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  k text;
  v jsonb;
begin
  -- New organizations: keep names that would collide with the app's own addresses.
  if tg_op = 'INSERT' and new.slug in ('dashboard', 'login', 'api', 'sites', 'listings', 'brokerage', 'admin', 'app', 'www', 'accept-invite', 'assets', 'images') then
    raise exception 'That address name is reserved' using errcode = 'check_violation';
  end if;

  -- Same rules for everyone (inserts and updates): the brand JSON must be well-formed.
  if jsonb_typeof(coalesce(new.brand, '{}'::jsonb)) <> 'object' then
    raise exception 'brand must be an object' using errcode = 'check_violation';
  end if;
  if new.brand ? 'logos' then
    if jsonb_typeof(new.brand -> 'logos') <> 'object' then
      raise exception 'brand.logos must be an object' using errcode = 'check_violation';
    end if;
    for k, v in select * from jsonb_each(new.brand -> 'logos') loop
      if k !~ '^[a-z0-9_-]{1,32}$' then
        raise exception 'Logo name "%" is not allowed', k using errcode = 'check_violation';
      end if;
      if jsonb_typeof(v) <> 'string' or (v #>> '{}') !~ '^(/[^/\\]|https://)[^\s<>"'']{1,255}$' then
        raise exception 'Logo "%" must be an address starting with / or https://', k using errcode = 'check_violation';
      end if;
    end loop;
  end if;
  if new.brand ? 'accent_colors' then
    if jsonb_typeof(new.brand -> 'accent_colors') <> 'array'
       or jsonb_array_length(new.brand -> 'accent_colors') > 6
       or exists (select 1 from jsonb_array_elements(new.brand -> 'accent_colors') c
                  where jsonb_typeof(c) <> 'string' or (c #>> '{}') !~* '^#[0-9a-f]{6}$') then
      raise exception 'brand.accent_colors must be up to 6 colors like #ed2127' using errcode = 'check_violation';
    end if;
  end if;
  foreach k in array array['location_label', 'admin_name', 'service_area', 'default_logo', 'dark_nav_logo'] loop
    if new.brand ? k and (jsonb_typeof(new.brand -> k) <> 'string' or length(new.brand ->> k) > 200) then
      raise exception 'brand.% must be short text', k using errcode = 'check_violation';
    end if;
  end loop;
  if length(new.name) > 120 or length(btrim(new.name)) = 0 then
    raise exception 'Organization name must be 1 to 120 characters' using errcode = 'check_violation';
  end if;

  if tg_op = 'UPDATE' and auth.uid() is not null and not public.is_platform_admin() then
    if new.id is distinct from old.id or new.slug is distinct from old.slug
       or new.type is distinct from old.type or new.status is distinct from old.status then
      raise exception 'Only the platform owner can change an organization''s slug, type or status';
    end if;
    if new.franchise_disclaimer is distinct from old.franchise_disclaimer then
      raise exception 'Only the platform owner can change the franchise disclaimer';
    end if;
    if coalesce(old.brand ->> 'franchise', '') <> '' then
      if (new.brand -> 'franchise') is distinct from (old.brand -> 'franchise')
         or (new.brand -> 'logos') is distinct from (old.brand -> 'logos')
         or (new.brand -> 'default_logo') is distinct from (old.brand -> 'default_logo')
         or (new.brand -> 'accent_colors') is distinct from (old.brand -> 'accent_colors') then
        raise exception 'This organization uses its franchise brand: logos and colors are set by the platform owner';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_organization_update on public.organizations;
drop trigger if exists guard_organization_write on public.organizations;
create trigger guard_organization_write before insert or update on public.organizations
  for each row execute function public.guard_organization_write();
drop function if exists public.guard_organization_update(); -- name used while drafting

-- Brand edits are recorded (security definer, so organization admins need no access to audit_log themselves).
create or replace function public.log_organization_change() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  insert into public.audit_log (actor_id, org_id, action, detail)
  values (auth.uid(), new.id, 'update_org',
          jsonb_build_object('changed', (select coalesce(jsonb_agg(c), '[]'::jsonb) from unnest(array[
            case when new.name is distinct from old.name then 'name' end,
            case when new.brand is distinct from old.brand then 'brand' end,
            case when new.address_line1 is distinct from old.address_line1 or new.city is distinct from old.city
                      or new.state is distinct from old.state or new.zip is distinct from old.zip then 'address' end,
            case when new.disclaimer is distinct from old.disclaimer then 'disclaimer' end,
            case when new.franchise_disclaimer is distinct from old.franchise_disclaimer then 'franchise_disclaimer' end,
            case when new.slug is distinct from old.slug then 'slug' end,
            case when new.status is distinct from old.status then 'status' end
          ]) c where c is not null)));
  return new;
end;
$$;
drop trigger if exists log_organization_change on public.organizations;
create trigger log_organization_change after update on public.organizations
  for each row when (old.* is distinct from new.*) execute function public.log_organization_change();

-- The Agency's own organization is marked as the franchise brand, so its offices (and new ones created from the
-- dashboard) lock logos and colors for their own admins.
update public.organizations
set brand = brand || '{"franchise": "the-agency"}'::jsonb
where slug = 'the-agency-oklahoma' and coalesce(brand ->> 'franchise', '') = '';
