-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder. Narrows the theme check
-- constraints from six options to four: Midnight and Ivory removed per
-- request (neither had any live sites/listings on them at the time —
-- confirmed via a count query before applying). Sand's own colors also
-- changed (see src/index.css's [data-theme="sand"]) but that's a CSS-only
-- change, not a schema one — no migration needed for it.

alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand'));

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand'));

alter table brokerage_site drop constraint if exists brokerage_site_theme_check;
alter table brokerage_site add constraint brokerage_site_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand'));
