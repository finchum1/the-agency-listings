-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder. Narrows the theme check
-- constraints from four options to three: Light removed per request
-- (it was functionally near-identical to Classic -- same accent/dark/
-- text tokens, just bg and bg-alt swapped -- and nothing was on it,
-- confirmed via a count query before applying).

alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme in ('classic', 'dark', 'sand'));

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme in ('classic', 'dark', 'sand'));

alter table brokerage_site drop constraint if exists brokerage_site_theme_check;
alter table brokerage_site add constraint brokerage_site_theme_check
  check (theme in ('classic', 'dark', 'sand'));
