-- MULTI-TENANT PHASE 1, PART D: brand fields added while moving hardcoded Agency copy into the database.
-- Run after part A. Safe to re-run. Apply to STAGING first.
update public.organizations
set brand = brand || '{"service_area": "Oklahoma City, Edmond, and the surrounding metro"}'::jsonb
where slug = 'the-agency-oklahoma';
