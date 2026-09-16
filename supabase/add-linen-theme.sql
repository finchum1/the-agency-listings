-- Run once in the Supabase SQL Editor — adds the "Linen" theme (all-white
-- and soft cream throughout, even the header & footer, with The Agency's
-- red as the only accent) to the three theme CHECK constraints. See
-- index.css's [data-theme="linen"] block and the THEMES arrays in
-- SiteForm.jsx / BrokerageSiteForm.jsx / ListingForm.jsx.

alter table agent_sites drop constraint agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check check (theme = any (array['classic','dark','sand','red','linen']));

alter table brokerage_site drop constraint brokerage_site_theme_check;
alter table brokerage_site add constraint brokerage_site_theme_check check (theme = any (array['classic','dark','sand','red','linen']));

alter table listings drop constraint listings_theme_check;
alter table listings add constraint listings_theme_check check (theme = any (array['classic','dark','sand','red','linen']));
