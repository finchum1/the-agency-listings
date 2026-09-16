-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder. Adds a fourth theme,
-- "Red" — unlike every other template (where the brand red is only ever
-- the accent), here it's structural: --as-dark is a deep oxblood/maroon
-- (not plain black), so the hero overlay, footer, and testimonials read
-- as bold red-black blocks. See src/index.css's [data-theme="red"] for
-- the actual colors.

alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme in ('classic', 'dark', 'sand', 'red'));

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme in ('classic', 'dark', 'sand', 'red'));

alter table brokerage_site drop constraint if exists brokerage_site_theme_check;
alter table brokerage_site add constraint brokerage_site_theme_check
  check (theme in ('classic', 'dark', 'sand', 'red'));
