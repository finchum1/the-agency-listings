-- MULTI-TENANT PHASE 1, PART G: per-organization IDX (Repliers) settings. Run after part A. Safe to re-run. Apply to STAGING first.
--
-- Each organization brings its own Repliers account. The secret lives in org_settings.idx_config:
--   { "api_key": "...", "board_id": "...", "office_name": "The exact brokerage name the MLS has on file" }
-- and is read only by the server (api/_lib/idxConfig.js, service role). Organization members can read their own org_settings
-- row (feature switches), so the idx_config column is closed to the app's logged-in users entirely: set it from the SQL editor
-- or a server script. Code that reads org_settings from the browser must therefore name its columns (no select *).
-- The Agency's idx_config stays empty: it keeps using the REPLIERS_* environment variables.
--
-- The Home Search map's starting point is not secret and lives in organizations.brand.map_center ([lat, lng]).

revoke select on public.org_settings from authenticated;
grant select (org_id, features, hq_client_id, updated_at) on public.org_settings to authenticated;

update public.organizations
set brand = brand || '{"map_center": [35.4676, -97.5164]}'::jsonb
where slug = 'the-agency-oklahoma' and not (brand ? 'map_center');
