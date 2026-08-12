-- Run once in the Supabase SQL Editor (schema.sql already ran, this is an
-- additive follow-up for "admin creates a profile-only agent, login
-- optional" — see api/admin/add-agent.js).
--
-- Tracks whether an agent has ever been given the ability to log in
-- (invited at creation, or enabled later) vs. exists purely as a profile
-- an admin manages on their behalf. Every profile still has a real
-- auth.users row either way (that FK doesn't change) — this column is
-- just what the Agents UI uses to show "No login" vs "Can log in" and to
-- decide whether to offer an "Enable Login" action.
alter table profiles
  add column if not exists login_enabled boolean not null default false;

-- Backfill: every agent that already exists today was created through the
-- old invite-only flow, so they already have real login access.
update profiles set login_enabled = true where login_enabled = false;

-- The trigger now reads login_enabled out of the new auth user's metadata
-- (set by api/admin/add-agent.js — true when it invited them, false when
-- it created a profile-only account) instead of always defaulting.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, login_enabled)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'agent'),
    coalesce((new.raw_user_meta_data->>'login_enabled')::boolean, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
