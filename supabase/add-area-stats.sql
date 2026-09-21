-- Run once in the Supabase SQL Editor — adds an admin-editable stats
-- field (same [{label, value}] shape as agent_sites.stats /
-- brokerage_site.stats) to both areas-of-expertise tables, for the
-- per-area detail pages (city overview: population, median age,
-- average income, market stats, etc. — whatever the admin wants to
-- feature per area). See AreasManager.jsx / BrokerageAreasManager.jsx's
-- new Stats editor and AgentAreaPage.jsx / BrokerageAreaPage.jsx's
-- rendering.

alter table agent_site_areas add column if not exists stats jsonb not null default '[]';
alter table brokerage_areas add column if not exists stats jsonb not null default '[]';
