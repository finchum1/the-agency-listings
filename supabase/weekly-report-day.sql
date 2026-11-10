-- The day of the week an agent gets their weekly listing report email (api/weekly-reports.js, run by a daily cron).
-- 0 = Sunday ... 6 = Saturday, Central time. Monday unless the agent changes it; it applies to all of that agent's listings.
-- Agents can change their own (profiles_update_own_or_admin); an admin can change anyone's.
alter table public.profiles add column if not exists weekly_report_day smallint not null default 1 check (weekly_report_day between 0 and 6);
