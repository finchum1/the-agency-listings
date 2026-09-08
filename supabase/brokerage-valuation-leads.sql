-- Widens leads.target_type to allow a brokerage-level lead (the Home
-- Valuation form — see api/contact.js) alongside the existing per-listing
-- and per-agent-site ones. target_id for this type is brokerage_site.id
-- (a real row, so the FK-shaped convention holds even though there's no
-- actual foreign key constraint on this polymorphic column).
alter table leads drop constraint if exists leads_target_type_check;
alter table leads add constraint leads_target_type_check
  check (target_type in ('listing', 'agent_site', 'brokerage_valuation'));
