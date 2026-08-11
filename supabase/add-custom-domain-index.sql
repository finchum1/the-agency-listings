-- Run once in the Supabase SQL Editor (schema.sql already ran, this is an
-- additive follow-up for the custom-domain-per-listing feature).
--
-- Case-insensitive uniqueness so "1645SaratogaWay.com" and
-- "1645saratogaway.com" can't both be claimed; partial index (WHERE ... IS
-- NOT NULL) so it doesn't block the many listings with no custom domain.
create unique index if not exists listings_custom_domain_idx
  on listings (lower(custom_domain))
  where custom_domain is not null;
