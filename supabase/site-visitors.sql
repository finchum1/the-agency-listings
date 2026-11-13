-- Visitor accounts for the public Home Search (IDX): a visitor signs in with an emailed 6-digit code (no password), and can save homes, save searches
-- and get a daily email of new matches. A visitor belongs to ONE site, either an agent's website or the brokerage's, and is filed with that site's owner
-- as a lead the first time they sign in (see api/visitor.js).
--
-- These are NOT Supabase auth users. Public sign-up on the Supabase project stays OFF (see the 2026-10-14 sign-up hardening): visitors are rows in
-- site_visitors, signed in by tokens this server issues. Nothing here is readable from the browser: row level security is on with no policies and
-- the roles are revoked, so only api/visitor.js (the service role) can read or write these tables. Codes and session tokens are stored hashed.
--
-- Run once in the Supabase SQL Editor (or apply as a migration).

create table if not exists public.site_visitors (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid references public.agent_sites (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  email text not null,
  name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now(),
  last_login_at timestamptz,
  unsubscribed_at timestamptz,
  -- exactly one of the two: an agent's site, or the brokerage (organization) site
  constraint site_visitors_one_site check ((agent_site_id is not null) <> (org_id is not null))
);
create unique index if not exists site_visitors_agent_email on public.site_visitors (agent_site_id, lower(email)) where agent_site_id is not null;
create unique index if not exists site_visitors_org_email on public.site_visitors (org_id, lower(email)) where org_id is not null;

-- The code emailed to someone signing in. Hash only; expires in 10 minutes; a handful of tries.
create table if not exists public.visitor_login_codes (
  id uuid primary key default gen_random_uuid(),
  agent_site_id uuid references public.agent_sites (id) on delete cascade,
  org_id uuid references public.organizations (id) on delete cascade,
  email text not null,
  code_hash text not null,
  ip_hash text not null default '',
  attempts integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists visitor_login_codes_email_idx on public.visitor_login_codes (lower(email), created_at desc);
create index if not exists visitor_login_codes_ip_idx on public.visitor_login_codes (ip_hash, created_at desc);

-- A signed-in browser. The token itself lives only in that browser; this table keeps its hash.
create table if not exists public.visitor_sessions (
  token_hash text primary key,
  visitor_id uuid not null references public.site_visitors (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists visitor_sessions_visitor_idx on public.visitor_sessions (visitor_id);

-- Saved homes. `snapshot` keeps what the card needs (address, price, photo) so the list still reads after the listing leaves the market.
create table if not exists public.visitor_favorites (
  visitor_id uuid not null references public.site_visitors (id) on delete cascade,
  mls_number text not null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (visitor_id, mls_number)
);

-- Saved searches. `params` holds the filters (city, price, beds, baths, sort, a drawn boundary); `page_url` is the page of the site where it was saved
-- (built by the server from the host the visitor was on), which the alert email links back to. `seen_mls` is what the last alert already covered, so each digest only carries homes that are new.
create table if not exists public.visitor_saved_searches (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid not null references public.site_visitors (id) on delete cascade,
  name text not null,
  params jsonb not null default '{}'::jsonb,
  page_url text not null default '',
  alerts boolean not null default true,
  seen_mls text[] not null default '{}',
  last_alert_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists visitor_saved_searches_visitor_idx on public.visitor_saved_searches (visitor_id);
create index if not exists visitor_saved_searches_alerts_idx on public.visitor_saved_searches (alerts) where alerts;

alter table public.site_visitors enable row level security;
alter table public.visitor_login_codes enable row level security;
alter table public.visitor_sessions enable row level security;
alter table public.visitor_favorites enable row level security;
alter table public.visitor_saved_searches enable row level security;
revoke all on public.site_visitors, public.visitor_login_codes, public.visitor_sessions, public.visitor_favorites, public.visitor_saved_searches from anon, authenticated;

-- A visitor's first sign-in files them as a lead (leads.page = 'home_search'): in People they are "Website: Home Search sign-up". This is the existing
-- create_person_from_lead function with those two cases added; everything else in it is unchanged.
create or replace function public.create_person_from_lead() returns trigger
language plpgsql security definer set search_path to 'public' as $function$
declare
  new_person_id uuid;
  existing_id uuid;
  v_source text;
  v_label text;
  v_contact uuid;
  v_comps boolean := true;
begin
  if new.agent_id is null then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.agent_id and p.people_enabled) then
    return new;
  end if;

  v_source := case new.page
    when 'sellers' then 'Website: Sellers page'
    when 'buyers' then 'Website: Buyers page'
    when 'home_value' then 'Website: Home value'
    when 'relocation' then 'Website: Relocation page'
    when 'home_search' then 'Website: Home Search sign-up'
    else 'Website inquiry'
  end;
  v_label := case new.page
    when 'sellers' then 'Sellers page request'
    when 'buyers' then 'Buyers page wish list'
    when 'home_value' then 'Home value request'
    when 'relocation' then 'Relocation inquiry'
    when 'home_search' then 'Home Search sign-up'
    else 'Website inquiry'
  end;

  if coalesce(new.email, '') <> '' then
    select pe.id into existing_id
    from public.people pe
    where pe.owner_id = new.agent_id and lower(pe.email) = lower(new.email)
    order by pe.archived, pe.created_at
    limit 1;
  end if;

  if existing_id is not null then
    update public.people
    set next_follow_up = current_date,
        phone = case when phone = '' then coalesce(new.phone, '') else phone end,
        archived = false,
        archived_reason = '',
        archived_at = null
    where id = existing_id;

    insert into public.people_notes (person_id, owner_id, body)
    values (existing_id, new.agent_id,
            case when coalesce(new.message, '') <> ''
                 then v_label || ' (repeat): ' || new.message
                 else v_label || ' (repeat), no message' end);
    new_person_id := existing_id;
  else
    insert into public.people (owner_id, name, email, phone, stage_group, stage, source, next_follow_up, lead_id)
    values (new.agent_id, new.name, coalesce(new.email, ''), coalesce(new.phone, ''), 'lead', 'New',
            v_source, current_date, new.id)
    returning id into new_person_id;

    if coalesce(new.message, '') <> '' then
      insert into public.people_notes (person_id, owner_id, body)
      values (new_person_id, new.agent_id, v_label || ': ' || new.message);
    end if;
  end if;

  if new.page = 'home_value' then
    if new.target_type = 'agent_site' then
      select coalesce((s.landing ->> 'comps_task')::boolean, true) into v_comps from public.agent_sites s where s.id = new.target_id;
    end if;
    if coalesce(v_comps, true) then
      select pe.contact_id into v_contact from public.people pe where pe.id = new_person_id;
      insert into public.agent_tasks (owner_id, title, due_date, contact_id)
      values (new.agent_id, 'Pull comps for ' || coalesce(nullif(btrim(new.address), ''), new.name), current_date + 1, v_contact);
    end if;
  end if;
  return new;
end;
$function$;

-- A lead's `page` is limited to the landing pages that make leads; a Home Search sign-up is one more. (Found by the first run against the real database.)
alter table public.leads drop constraint if exists leads_page_check;
alter table public.leads add constraint leads_page_check check (page = any (array['sellers'::text, 'buyers'::text, 'home_value'::text, 'relocation'::text, 'home_search'::text]));
