-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder (see
-- brokerage-valuation-leads.sql for the equivalent leads.target_type
-- widening).
--
-- Widens page_views.target_type to allow the brokerage site's own page
-- loads and blog post views alongside the existing listing/agent_site/
-- agent_post ones (see analytics.sql). No RLS policy change needed: the
-- existing "page_views_owner_admin_read" policy already grants admins a
-- blanket read, and the Brokerage Site editor is admin-only (App.jsx's
-- adminOnly route), so that clause alone covers these two new types.
alter table page_views drop constraint if exists page_views_target_type_check;
alter table page_views add constraint page_views_target_type_check
  check (target_type in ('listing', 'agent_site', 'agent_post', 'brokerage_site', 'brokerage_post'));
