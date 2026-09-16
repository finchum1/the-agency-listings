-- Run once in the Supabase SQL Editor — adds a custom_domain field to the
-- brokerage_site singleton, mirroring agent_sites.custom_domain /
-- listings.custom_domain (see normalizeDomain.js, BrokerageSiteForm.jsx's
-- new Custom Domain section, useBrokerageSite.js's optional customDomain
-- param, and CustomDomainSitePage.jsx's brokerage-site fallback routes).

alter table brokerage_site add column if not exists custom_domain text;
create unique index if not exists brokerage_site_custom_domain_idx on brokerage_site (lower(custom_domain)) where custom_domain is not null;
