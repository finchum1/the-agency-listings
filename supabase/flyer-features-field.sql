-- Run once in the Supabase SQL Editor — additive follow-up to
-- flyer-fields.sql.
--
-- Which of the listing's real features (listings.features) show on the
-- flyer — an opt-OUT list, so a never-configured flyer shows every
-- feature by default and the agent removes the ones that don't fit,
-- rather than starting from nothing. Each entry is "{category}|||{item}"
-- (see FlyerPage.jsx's featureKey helper) so removing one item never
-- has to touch the listing's real features data.

alter table listings add column if not exists flyer_excluded_features text[] not null default '{}';
