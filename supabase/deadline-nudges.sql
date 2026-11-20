-- Deadline nudges: each morning an agent with deals gets one email listing what is due today, tomorrow or the day after (key dates and tasks) plus
-- anything overdue. Sent by api/deadline-nudges.js (Vercel cron); deadline_nudge_log makes sure it goes out once per agent per day.
-- An agent can turn it off in My Profile (agent_notification_settings.deadline_nudges).
alter table public.agent_notification_settings add column if not exists deadline_nudges boolean not null default true;

create table if not exists public.deadline_nudge_log (
  agent_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  sent_at timestamptz not null default now(),
  primary key (agent_id, day)
);
alter table public.deadline_nudge_log enable row level security;
revoke all on public.deadline_nudge_log from anon, authenticated;
