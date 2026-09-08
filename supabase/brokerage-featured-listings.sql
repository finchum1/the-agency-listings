-- Ordered list of pinned MLS numbers for the Brokerage Site's home page
-- IDX preview (see BrokerageFeaturedListingsPicker.jsx / IdxListings.jsx).
-- Empty by default -- reproduces existing behavior (falls back to
-- Repliers' own default search order) until an admin pins something.
alter table brokerage_site
  add column if not exists featured_listing_mls_numbers text[] not null default '{}';
