-- CMAs (comparative market analyses). One row per analysis: the subject home, the comparable homes the agent entered (a jsonb list, each with its own
-- price adjustments), optional price overrides, and the agent's notes. Private to the agent who made it. An agent can turn one into a private link for
-- a client (share_hash): the link page is served by api/cma-share.js with the service role, so the client never signs in. The token is shown once,
-- only its hash is stored, and the link can be revoked.
create table if not exists public.cmas (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  org_id uuid not null default public.current_org_id() references public.organizations(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  title text not null default '' check (length(title) <= 160),
  subject jsonb not null default '{}'::jsonb check (jsonb_typeof(subject) = 'object'),
  comps jsonb not null default '[]'::jsonb check (jsonb_typeof(comps) = 'array' and jsonb_array_length(comps) <= 40),
  price_low numeric check (price_low is null or price_low >= 0),
  price_high numeric check (price_high is null or price_high >= 0),
  suggested_price numeric check (suggested_price is null or suggested_price >= 0),
  notes text not null default '' check (length(notes) <= 5000),
  share_hash text unique,
  share_hint text,
  shared_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists cmas_owner_idx on public.cmas (owner_id, updated_at desc);
create index if not exists cmas_person_idx on public.cmas (person_id) where person_id is not null;
alter table public.cmas enable row level security;
revoke all on public.cmas from anon, authenticated;
grant select (id, owner_id, org_id, person_id, title, subject, comps, price_low, price_high, suggested_price, notes, share_hint, shared_at, last_viewed_at, view_count, created_at, updated_at) on public.cmas to authenticated;
grant insert (person_id, title, subject, comps, price_low, price_high, suggested_price, notes) on public.cmas to authenticated;
grant update (person_id, title, subject, comps, price_low, price_high, suggested_price, notes, updated_at) on public.cmas to authenticated;
grant delete on public.cmas to authenticated;
drop policy if exists cmas_owner on public.cmas;
create policy cmas_owner on public.cmas for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop trigger if exists cmas_touch on public.cmas;
create trigger cmas_touch before update on public.cmas for each row execute function public.set_updated_at();

create or replace function public.create_cma_share(p_id uuid) returns text
language plpgsql security definer set search_path = public as $$
declare v_token text;
begin
  if auth.uid() is null then raise exception 'Sign in to share a CMA.'; end if;
  v_token := 'cm' || replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  update public.cmas set share_hash = encode(sha256(convert_to(v_token, 'utf8')), 'hex'), share_hint = right(v_token, 4), shared_at = now()
   where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'That CMA was not found.'; end if;
  return v_token;
end;
$$;
revoke all on function public.create_cma_share(uuid) from public, anon;
grant execute on function public.create_cma_share(uuid) to authenticated;

create or replace function public.revoke_cma_share(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.cmas set share_hash = null, share_hint = null, shared_at = null where id = p_id and owner_id = auth.uid();
end;
$$;
revoke all on function public.revoke_cma_share(uuid) from public, anon;
grant execute on function public.revoke_cma_share(uuid) to authenticated;
