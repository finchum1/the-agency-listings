-- Newsletters, sent from the app to an agent's own contacts (Dashboard > Marketing > Newsletters).
--   newsletters         what an agent writes: subject, the blocks of the email, who it goes to, when. status: draft > scheduled > sending > sent.
--   newsletter_sends    one row per recipient of one newsletter: the address, a private token (for the open pixel, the link wrapper and the unsubscribe
--                       link), how the send went and the open / click counts.
--   newsletter_events   each open and click, for the results.
--   newsletter_optouts  addresses that have unsubscribed from ONE agent's newsletters. Checked every time that agent sends; survives the contact being
--                       edited or re-imported.
-- Writes to sends, events and optouts happen only on the server (the service role). An agent can read their own, and write their own newsletters.

create table if not exists public.newsletters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  subject text not null default '' check (length(subject) <= 200),
  preheader text not null default '' check (length(preheader) <= 200),
  blocks jsonb not null default '[]',
  audience jsonb not null default '{"relationships": ["client", "past_client", "sphere"], "tag_id": null}',
  greeting boolean not null default true,
  track boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent')),
  scheduled_at timestamptz,
  started_at timestamptz,
  sent_at timestamptz,
  recipient_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists newsletters_owner_idx on public.newsletters (owner_id, created_at desc);
create index if not exists newsletters_due_idx on public.newsletters (status, scheduled_at) where status in ('scheduled', 'sending');

create or replace function public.newsletters_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists newsletters_touch on public.newsletters;
create trigger newsletters_touch before update on public.newsletters for each row execute function public.newsletters_touch();

create table if not exists public.newsletter_sends (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  email text not null,
  first_name text not null default '',
  token text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed')),
  error text not null default '',
  provider_id text,
  sent_at timestamptz,
  opened_at timestamptz,
  open_count integer not null default 0,
  clicked_at timestamptz,
  click_count integer not null default 0,
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists newsletter_sends_newsletter_idx on public.newsletter_sends (newsletter_id, status);

create table if not exists public.newsletter_events (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.newsletter_sends(id) on delete cascade,
  newsletter_id uuid not null references public.newsletters(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('open', 'click')),
  url text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists newsletter_events_newsletter_idx on public.newsletter_events (newsletter_id, kind);

create table if not exists public.newsletter_optouts (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  email text not null check (email = lower(email)),
  source text not null default 'unsubscribe link',
  created_at timestamptz not null default now(),
  primary key (owner_id, email)
);

alter table public.newsletters enable row level security;
alter table public.newsletter_sends enable row level security;
alter table public.newsletter_events enable row level security;
alter table public.newsletter_optouts enable row level security;

-- An agent works with their own newsletters. An office admin can read them (not change them).
create policy newsletters_owner_all on public.newsletters for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy newsletters_admin_read on public.newsletters for select
  using (exists (select 1 from public.profiles p where p.id = newsletters.owner_id and public.can_manage_org(p.org_id)));

-- Results are readable by their owner; only the server writes them.
create policy newsletter_sends_owner_read on public.newsletter_sends for select using (owner_id = auth.uid());
create policy newsletter_events_owner_read on public.newsletter_events for select using (owner_id = auth.uid());
create policy newsletter_optouts_owner_read on public.newsletter_optouts for select using (owner_id = auth.uid());
