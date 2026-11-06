-- Two new color themes built on The Agency's main color, Velvet (#470300), for agent sites and property sites (see index.css's
-- [data-theme="velvet"] and [data-theme="velvet-night"], and the THEMES lists in SiteForm.jsx / ListingForm.jsx). Only the allowed values
-- change; the brokerage site's themes are left as they were.
alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme = any (array['classic','dark','sand','red','linen','velvet','velvet-night']));

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme = any (array['classic','dark','sand','red','linen','velvet','velvet-night']));
