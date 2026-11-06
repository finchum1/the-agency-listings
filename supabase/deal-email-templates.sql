-- Email templates for deals.
--
-- Everyone gets a built-in starter set (src/lib/dealEmails.js) with no setup. This table holds a person's OWN templates: ones they add, and copies
-- of a starter they have customised (base_key = the starter's key, so the copy replaces the starter in their list; deleting the copy brings the
-- original back). Templates are private to their owner, an agent or a coordinator, and never change anyone else's.
--
-- A template is a subject and body with {merge_fields} that fill in from the deal, plus which people on the deal it goes to and copies:
-- to_roles / cc_roles hold role keys (client, client2, agent, tc, other_agent, other_agent2, other_agent_tc, title, title_processor, lender,
-- loan_processor). Nothing is sent by the platform: the deal's "Email" button opens the filled-in email in the person's own email app.

create table if not exists public.deal_email_templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  subject text not null default '',
  body text not null default '',
  to_roles text[] not null default '{}',
  cc_roles text[] not null default '{}',
  side text not null default 'both' check (side in ('buyer', 'seller', 'both')),
  base_key text,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deal_email_templates_owner_idx on public.deal_email_templates (owner_id, position);
create unique index if not exists deal_email_templates_owner_base_uidx on public.deal_email_templates (owner_id, base_key) where base_key is not null;

alter table public.deal_email_templates enable row level security;
revoke all on public.deal_email_templates from anon;
drop policy if exists deal_email_templates_owner_all on public.deal_email_templates;
create policy deal_email_templates_owner_all on public.deal_email_templates for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
