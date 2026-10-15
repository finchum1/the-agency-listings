-- PART H: an optional second address for an agent's lead alerts. Additive; safe to re-run. Apply to STAGING first.
--
-- Deliberately NOT a column on profiles: profiles are readable by the public for any agent with a published site (that is how
-- their site shows their name and contact info), so a personal address stored there would be scrapeable. This private table is
-- readable and writable only by the agent themself (and readable by the platform owner for support). The lead-email functions
-- read it with the service role. Organization admins cannot read it: it is the agent's own address.

create table if not exists public.agent_notification_settings (
  agent_id uuid primary key references public.profiles(id) on delete cascade,
  lead_alert_email text check (lead_alert_email is null or (length(lead_alert_email) <= 254 and lead_alert_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  updated_at timestamptz not null default now()
);

alter table public.agent_notification_settings enable row level security;
revoke all on public.agent_notification_settings from anon;

drop policy if exists agent_notification_settings_owner on public.agent_notification_settings;
create policy agent_notification_settings_owner on public.agent_notification_settings for all to authenticated
  using (agent_id = auth.uid()) with check (agent_id = auth.uid());

drop policy if exists agent_notification_settings_platform_read on public.agent_notification_settings;
create policy agent_notification_settings_platform_read on public.agent_notification_settings for select to authenticated
  using (public.is_platform_admin());
