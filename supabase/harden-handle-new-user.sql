-- SECURITY FIX (2026-10-14): stop trusting sign-up metadata for role.
--
-- handle_new_user used to copy `role` and `login_enabled` straight from the
-- new account's user metadata. With public sign-up enabled, anyone holding the
-- (public) project URL and anon key could sign themselves up with
-- {"role": "admin"} and become an admin. Public sign-up has also been turned
-- off in Supabase (Authentication > Sign In / Providers), but the database must
-- not depend on that setting.
--
-- Every new profile is now an agent with login off, no matter what the
-- metadata says. api/admin/agents.js (admin-verified, service role) sets the
-- real role, login_enabled, site access and People access right after creating
-- the account. The first admin is bootstrapped by hand (see schema.sql).
--
-- Run in the Supabase SQL Editor. Safe to re-run.
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
    'agent',
    false
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
