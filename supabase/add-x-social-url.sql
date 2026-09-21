-- Run once in the Supabase SQL Editor — additive, same convention as
-- add-tiktok-youtube-social.sql. Adds X (formerly Twitter) alongside the
-- existing Instagram/Facebook/LinkedIn/TikTok/YouTube URL fields on both
-- agent_sites and brokerage_site (see SiteForm.jsx/BrokerageSiteForm.jsx's
-- "Social Media" section, adaptAgentSite.js/adaptBrokerageSite.js's
-- site.social mapping, and agent-site/Footer.jsx +
-- brokerage-site/Footer.jsx's social icon row).

alter table agent_sites add column if not exists x_url text default '';
alter table brokerage_site add column if not exists x_url text not null default '';
