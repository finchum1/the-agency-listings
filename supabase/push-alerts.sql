-- Phone (web push) alerts. A signed-in browser or installed phone app subscribes (api/push.js) and the daily deadline run (api/deadline-nudges.js) sends it a
-- short notification of what is due. push_config holds the one VAPID key pair the server signs pushes with (made on first use, readable only by the
-- service role). push_subscriptions are one row per browser; a person sees and removes only their own. Sending is logged per channel so the email and the push
-- each go once a day.
create table if not exists public.push_config (
  id integer primary key default 1 check (id = 1),
  public_key text not null,
  private_key text not null,
  created_at timestamptz not null default now()
);
alter table public.push_config enable row level security;
revoke all on public.push_config from anon, authenticated;

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, delete on public.push_subscriptions to authenticated;
drop policy if exists push_subscriptions_own on public.push_subscriptions;
create policy push_subscriptions_own on public.push_subscriptions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.deadline_nudge_log add column if not exists channel text not null default 'email' check (channel in ('email', 'push'));
alter table public.deadline_nudge_log drop constraint if exists deadline_nudge_log_pkey;
alter table public.deadline_nudge_log add primary key (agent_id, day, channel);
