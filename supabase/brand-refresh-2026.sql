-- The Agency's 2026 brand refresh (see the one-page reference guide, August 2026).
--  1. Two new color themes built from the guide's palette: Chambray (light blue, Iron text) and Brownstone (warm brown, white text).
--     Only the allowed values change (see index.css's [data-theme="chambray"] / [data-theme="brownstone"] and the THEMES lists in
--     SiteForm.jsx / ListingForm.jsx). The brokerage site's themes are left as they were.
--  2. The Agency offices' brand: the three logo colors now point at the 2026 artwork (public/brand/the-agency-lockup-*.svg) and the offered
--     accent colors become Agency Red (#d8091b) and Iron (#1c1c1b). No site or listing has an accent color saved today (all null), so no rows
--     need converting; one that did would be rejected by the brand-choices trigger until it matched the new list.
alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme = any (array['classic','dark','sand','red','linen','velvet','velvet-night','chambray','brownstone']));

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme = any (array['classic','dark','sand','red','linen','velvet','velvet-night','chambray','brownstone']));

update organizations
set brand = jsonb_set(
  jsonb_set(brand, '{logos}', '{"red":"/brand/the-agency-lockup-red.svg","white":"/brand/the-agency-lockup-white.svg","black":"/brand/the-agency-lockup-iron.svg"}'::jsonb),
  '{accent_colors}', '["#d8091b","#1c1c1b"]'::jsonb)
where brand ->> 'franchise' = 'the-agency';
