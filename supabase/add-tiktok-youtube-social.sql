-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder. Adds TikTok/YouTube
-- alongside the existing Instagram/Facebook/LinkedIn URL fields on both
-- agent_sites and brokerage_site (see SiteForm.jsx/BrokerageSiteForm.jsx's
-- "social media" section, adaptAgentSite.js/adaptBrokerageSite.js's
-- site.social mapping, and agent-site/Footer.jsx +
-- brokerage-site/Footer.jsx's social icon row).

alter table agent_sites add column if not exists tiktok_url text default '';
alter table agent_sites add column if not exists youtube_url text default '';

alter table brokerage_site add column if not exists tiktok_url text not null default '';
alter table brokerage_site add column if not exists youtube_url text not null default '';
