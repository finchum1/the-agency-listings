-- =====================================================================
-- AI connections: let an agent's AI (Claude, ChatGPT, Grok bots, ...) work in their dashboard.
--
-- Sign-in is OAuth 2.1 with PKCE (api/oauth.js): the AI registers itself as a client, the agent approves it on a consent page, and the AI
-- gets an access token (one hour) and a refresh token (60 days, rotated on every use). Tokens are stored only as SHA-256 hashes.
-- Everything an AI does runs as the agent through the dashboard's own row-level rules; the scopes below only narrow it further.
--
--   profiles.ai_access      switched on per agent by an admin (an admin account always has it). Off = no AI connection works.
--   oauth_clients           the AI apps that registered themselves (public clients: no secret, PKCE instead)
--   oauth_grants            "this agent allowed this app these scopes". The agent sees these under My Profile and can revoke one.
--   oauth_codes             one-time authorization codes (10 minutes)
--   oauth_tokens            the access / refresh token pairs behind a grant
--   mcp_tokens.scopes       personal tokens (for bots that can't do OAuth) now carry scopes too, and any agent with ai_access can make one
--
-- Scopes: read, write_people (people, follow-ups, notes), write_tasks (tasks, contacts), write_deals (deal dates, contacts, deal tasks),
-- write_drafts (drafted messages, blog and listing drafts). Nothing here can send, delete or publish.
-- =====================================================================

alter table public.profiles add column if not exists ai_access boolean not null default false;

-- Only an admin may change it (the same rule as People access and the other switches).
create or replace function public.guard_profile_privileged_columns() returns trigger
language plpgsql security definer set search_path to 'public' as
$$
begin
  if auth.uid() is null then return new; end if;
  if public.is_platform_admin() then return new; end if;
  if new.org_id is distinct from old.org_id then
    raise exception 'Only the platform owner can change which organization an account belongs to.';
  end if;
  if new.role is distinct from old.role
     or new.site_access is distinct from old.site_access
     or new.people_enabled is distinct from old.people_enabled
     or new.ai_access is distinct from old.ai_access
     or new.deals_role is distinct from old.deals_role
     or new.login_enabled is distinct from old.login_enabled then
    if exists (
      select 1 from public.profiles p join public.organizations o on o.id = p.org_id
      where p.id = auth.uid() and p.role = 'admin' and p.org_id = old.org_id and o.type = 'brokerage'
    ) then
      return new;
    end if;
    raise exception 'Only an admin can change role, site access, People access, AI access, Deals role, or login access.';
  end if;
  return new;
end;
$$;

create table if not exists public.oauth_clients (
  client_id text primary key check (client_id ~ '^ac_[0-9a-f]{32}$'),
  client_name text not null check (length(btrim(client_name)) between 1 and 100),
  redirect_uris text[] not null check (cardinality(redirect_uris) between 1 and 10),
  created_at timestamptz not null default now()
);
alter table public.oauth_clients enable row level security;
revoke all on public.oauth_clients from anon, authenticated;

create table if not exists public.oauth_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz,
  constraint oauth_grants_scopes_check check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts']::text[] and 'read' = any(scopes))
);
create index if not exists oauth_grants_user_idx on public.oauth_grants (user_id) where revoked_at is null;
alter table public.oauth_grants enable row level security;
revoke all on public.oauth_grants from anon, authenticated;

create table if not exists public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  redirect_uri text not null,
  code_challenge text not null,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table public.oauth_codes enable row level security;
revoke all on public.oauth_codes from anon, authenticated;

create table if not exists public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid not null references public.oauth_grants(id) on delete cascade,
  access_hash text not null unique,
  refresh_hash text not null unique,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);
create index if not exists oauth_tokens_grant_idx on public.oauth_tokens (grant_id);
alter table public.oauth_tokens enable row level security;
revoke all on public.oauth_tokens from anon, authenticated;

-- What the agent sees under My Profile: the apps they have connected (never a token or hash).
create or replace function public.my_ai_connections() returns table (id uuid, client_name text, scopes text[], created_at timestamptz, last_used_at timestamptz)
language sql stable security definer set search_path = public as
$$
  select g.id, c.client_name, g.scopes, g.created_at, g.last_used_at
  from public.oauth_grants g join public.oauth_clients c on c.client_id = g.client_id
  where g.user_id = auth.uid() and g.revoked_at is null
  order by g.created_at desc;
$$;
revoke all on function public.my_ai_connections() from public, anon;
grant execute on function public.my_ai_connections() to authenticated;

-- Disconnecting an app: its tokens stop working at once (the server checks the grant on every call).
create or replace function public.revoke_ai_connection(p_id uuid) returns void
language plpgsql security definer set search_path = public as
$$
begin
  update public.oauth_grants set revoked_at = coalesce(revoked_at, now()) where id = p_id and user_id = auth.uid();
end;
$$;
revoke all on function public.revoke_ai_connection(uuid) from public, anon;
grant execute on function public.revoke_ai_connection(uuid) to authenticated;

-- Personal tokens now carry scopes and are available to every agent with AI access (not just admins).
alter table public.mcp_tokens add column if not exists scopes text[] not null default array['read']::text[];
alter table public.mcp_tokens drop constraint if exists mcp_tokens_scopes_check;
alter table public.mcp_tokens add constraint mcp_tokens_scopes_check check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts']::text[] and 'read' = any(scopes));
grant select (scopes) on public.mcp_tokens to authenticated;

drop function if exists public.create_mcp_token(text);
create or replace function public.create_mcp_token(p_name text, p_scopes text[] default array['read']::text[]) returns text
language plpgsql security definer set search_path = public as
$$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.ai_access)) then
    raise exception 'AI connections are not turned on for your account. Ask an admin.';
  end if;
  if (select count(*) from public.mcp_tokens where owner_id = auth.uid() and revoked_at is null) >= 10 then
    raise exception 'You already have 10 active tokens. Revoke one first.';
  end if;
  v_token := 'lp_' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  insert into public.mcp_tokens (owner_id, name, token_hash, token_hint, scopes)
  values (auth.uid(), btrim(p_name), encode(sha256(convert_to(v_token, 'utf8')), 'hex'), right(v_token, 4), p_scopes);
  return v_token;
end;
$$;
revoke all on function public.create_mcp_token(text, text[]) from public, anon;
grant execute on function public.create_mcp_token(text, text[]) to authenticated;
