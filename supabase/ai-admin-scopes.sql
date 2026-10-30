-- Four more AI connection permissions, for the office admin only: manage_agents, manage_sites, manage_blog and manage_listings. They let the admin's AI
-- do what the bot API did (add agents, edit any agent's website, write blog posts, create and edit listings) through the same connection as everything else.
-- The sign-in (api/oauth.js) only offers them to an admin account, and the server drops them for anyone else on every call; this file makes the
-- database refuse them for a non-admin too.
alter table public.oauth_grants drop constraint if exists oauth_grants_scopes_check;
alter table public.oauth_grants add constraint oauth_grants_scopes_check
  check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts', 'manage_blog', 'manage_listings', 'manage_agents', 'manage_sites']::text[] and 'read' = any(scopes));

alter table public.mcp_tokens drop constraint if exists mcp_tokens_scopes_check;
alter table public.mcp_tokens add constraint mcp_tokens_scopes_check
  check (scopes <@ array['read', 'write_people', 'write_tasks', 'write_deals', 'write_drafts', 'manage_blog', 'manage_listings', 'manage_agents', 'manage_sites']::text[] and 'read' = any(scopes));

create or replace function public.create_mcp_token(p_name text, p_scopes text[] default array['read']::text[]) returns text
language plpgsql security definer set search_path = public as
$$
declare
  v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and (p.role = 'admin' or p.ai_access)) then
    raise exception 'AI connections are not turned on for your account. Ask an admin.';
  end if;
  if exists (select 1 from unnest(p_scopes) s where s like 'manage\_%')
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Only an admin can allow managing agents, websites, blog posts and listings.';
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
