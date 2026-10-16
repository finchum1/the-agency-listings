-- GOOGLE CONNECTIONS TEST (self-contained, rolls itself back; result is the error text GOOGLECONN pass=N fail=M ...).
-- Checks people-module.sql section 20: refresh tokens are unreadable by every signed-in role, an agent sees only their own
-- connections, only the server creates connections, an agent can only link calendars from their own connection, and the
-- old iCal-address calendars still work.
do $outer$
declare
  oA uuid := gen_random_uuid();
  agA uuid := gen_random_uuid(); adA uuid := gen_random_uuid(); agB uuid := gen_random_uuid();
  plat uuid := (select user_id from public.platform_admins limit 1);
  connA uuid := gen_random_uuid(); connB uuid := gen_random_uuid();
  npass int; nfail int; fails text;
begin
  create temp table zz_results (ok boolean, name text);
  create function pg_temp.zz_run(actor uuid, r text, q text) returns text language plpgsql as $f$
  declare n bigint; res text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', r)::text, true);
    execute 'set local role ' || r;
    begin
      if lower(left(ltrim(q), 6)) = 'select' then execute q into n; res := n::text;
      else execute q; get diagnostics n = row_count; res := 'rows:' || n; end if;
    exception when others then res := 'err';
    end;
    reset role;
    return res;
  end $f$;
  create function pg_temp.zz_expect(label text, actor uuid, r text, q text, want text[]) returns void language plpgsql as $f$
  declare got text := pg_temp.zz_run(actor, r, q);
  begin insert into zz_results values (got = any(want), label || ' -> got ' || got); end $f$;

  insert into public.organizations (id, slug, name) values (oA, 'zz-gc-a', 'A');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-gca@example.invalid', '{}', now(), now()),
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-gcd@example.invalid', '{}', now(), now()),
    (agB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-gcb@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA where id in (agA, adA, agB);
  update public.profiles set role = 'admin' where id = adA;

  -- the server (this block runs as the table owner, like the service key) creates the connections and tokens
  insert into public.google_connections (id, owner_id, email) values (connA, agA, 'a@gmail.example'), (connB, agB, 'b@gmail.example');
  insert into public.google_tokens (connection_id, refresh_token_enc) values (connA, 'ENCRYPTED-A'), (connB, 'ENCRYPTED-B');

  perform pg_temp.zz_expect('owner reads own connection', agA, 'authenticated', 'select count(*) from public.google_connections', array['1']);
  perform pg_temp.zz_expect('PRIVACY same-organization admin reads connections', adA, 'authenticated', format('select count(*) from public.google_connections where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY other agent reads connections', agB, 'authenticated', format('select count(*) from public.google_connections where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY platform owner reads connections', plat, 'authenticated', format('select count(*) from public.google_connections where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY anonymous reads connections', null, 'anon', 'select count(*) from public.google_connections', array['0', 'err']);

  perform pg_temp.zz_expect('TOKENS owner cannot read refresh tokens', agA, 'authenticated', 'select count(*) from public.google_tokens', array['err']);
  perform pg_temp.zz_expect('TOKENS admin cannot read refresh tokens', adA, 'authenticated', 'select count(*) from public.google_tokens', array['err']);
  perform pg_temp.zz_expect('TOKENS platform owner cannot read refresh tokens', plat, 'authenticated', 'select count(*) from public.google_tokens', array['err']);
  perform pg_temp.zz_expect('TOKENS anonymous cannot read refresh tokens', null, 'anon', 'select count(*) from public.google_tokens', array['err']);
  perform pg_temp.zz_expect('TOKENS owner cannot write refresh tokens', agA, 'authenticated', format('insert into public.google_tokens (connection_id, refresh_token_enc) values (%L, %L)', connA, 'x'), array['err']);

  perform pg_temp.zz_expect('agent cannot create a connection', agA, 'authenticated', format('insert into public.google_connections (owner_id, email) values (%L, %L)', agA, 'fake@gmail.example'), array['err']);
  perform pg_temp.zz_expect('agent cannot edit a connection', agA, 'authenticated', format('update public.google_connections set status = %L where id = %L', 'active', connA), array['err', 'rows:0']);
  perform pg_temp.zz_expect('agent cannot delete a connection directly', agA, 'authenticated', format('delete from public.google_connections where id = %L', connA), array['err', 'rows:0']);

  perform pg_temp.zz_expect('owner links a Google calendar from their own connection', agA, 'authenticated', format('insert into public.agent_calendars (name, source, connection_id, google_calendar_id, can_write) values (%L, %L, %L, %L, true)', 'Primary', 'google', connA, 'a@gmail.example'), array['rows:1']);
  perform pg_temp.zz_expect('the same Google calendar twice is refused', agA, 'authenticated', format('insert into public.agent_calendars (name, source, connection_id, google_calendar_id) values (%L, %L, %L, %L)', 'Dup', 'google', connA, 'a@gmail.example'), array['err']);
  perform pg_temp.zz_expect('cannot link a calendar from someone else''s connection', agA, 'authenticated', format('insert into public.agent_calendars (name, source, connection_id, google_calendar_id) values (%L, %L, %L, %L)', 'Stolen', 'google', connB, 'b@gmail.example'), array['err']);
  perform pg_temp.zz_expect('a Google calendar needs a connection', agA, 'authenticated', format('insert into public.agent_calendars (name, source, google_calendar_id) values (%L, %L, %L)', 'x', 'google', 'z@x'), array['err']);
  perform pg_temp.zz_expect('a Google calendar cannot also carry an iCal address', agA, 'authenticated', format('insert into public.agent_calendars (name, source, connection_id, google_calendar_id, ics_url) values (%L, %L, %L, %L, %L)', 'x', 'google', connA, 'other', 'https://example.com/a.ics'), array['err']);
  perform pg_temp.zz_expect('an iCal calendar still works', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'Work', 'https://example.com/work.ics'), array['rows:1']);
  perform pg_temp.zz_expect('an iCal calendar still needs an https address', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'Bad', 'http://example.com/work.ics'), array['err']);
  perform pg_temp.zz_expect('an iCal calendar cannot point at a connection', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url, connection_id) values (%L, %L, %L)', 'x', 'https://example.com/y.ics', connA), array['err']);
  perform pg_temp.zz_expect('PRIVACY other agent reads the Google calendar rows', agB, 'authenticated', format('select count(*) from public.agent_calendars where owner_id = %L', agA), array['0']);

  -- disconnecting (the server deletes the connection) removes its calendars and tokens
  delete from public.google_connections where id = connA;
  perform pg_temp.zz_expect('removing a connection removes its calendars', agA, 'authenticated', $q$select count(*) from public.agent_calendars where source = 'google'$q$, array['0']);
  insert into zz_results values ((select count(*) from public.google_tokens where connection_id = connA) = 0, 'removing a connection removes its tokens');

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'GOOGLECONN pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
