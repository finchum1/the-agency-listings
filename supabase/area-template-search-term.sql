-- A new agent site starts with the organization's template areas (area_template_areas); carry each area's search term along with the rest.
-- (Replaces the live copy_template_areas, which copies from the organization's template table.)
create or replace function public.copy_template_areas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.agent_site_areas (agent_site_id, slug, name, blurb, description, photo_url, sort_order, stats, search_term)
  select new.id, t.slug, t.name, t.blurb, t.description, t.photo_url, t.sort_order, t.stats, t.search_term
  from public.area_template_areas t
  where t.org_id = new.org_id;
  return new;
end;
$$;
