-- AGENT CALENDARS TEST (self-contained, rolls itself back; result is the error text AGENTCAL pass=N fail=M ...).
-- Checks people-module.sql section 18: linked-calendar addresses are private to the agent who added them (a credential),
-- only https addresses are accepted, an agent is capped at 10, and the yearly goals column works.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  agA uuid := gen_random_uuid(); adA uuid := gen_random_uuid(); agB uuid := gen_random_uuid();
  plat uuid := (select user_id from public.platform_admins limit 1);
  cA uuid := gen_random_uuid(); i int; got text;
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

  insert into public.organizations (id, slug, name) values (oA, 'zz-ac-a', 'A'), (oB, 'zz-ac-b', 'B');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-aca@example.invalid', '{}', now(), now()),
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-acd@example.invalid', '{}', now(), now()),
    (agB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-acb@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, people_enabled = true where id = agA;
  update public.profiles set org_id = oA, role = 'admin' where id = adA;
  update public.profiles set org_id = oB, people_enabled = true where id = agB;

  perform pg_temp.zz_expect('owner links a calendar', agA, 'authenticated', format('insert into public.agent_calendars (id, name, ics_url) values (%L, %L, %L)', cA, 'Work', 'https://calendar.google.com/calendar/ical/x%40y.com/private-abc/basic.ics'), array['rows:1']);
  perform pg_temp.zz_expect('owner reads own calendar', agA, 'authenticated', 'select count(*) from public.agent_calendars', array['1']);
  perform pg_temp.zz_expect('owner turns it off', agA, 'authenticated', format('update public.agent_calendars set enabled = false where id = %L', cA), array['rows:1']);
  perform pg_temp.zz_expect('http address refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'x', 'http://example.com/a.ics'), array['err']);
  perform pg_temp.zz_expect('webcal address refused (the app converts it)', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'x', 'webcal://example.com/a.ics'), array['err']);
  perform pg_temp.zz_expect('javascript address refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'x', 'javascript:alert(1)'), array['err']);
  perform pg_temp.zz_expect('address with a space refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'x', 'https://example.com/a b.ics'), array['err']);
  perform pg_temp.zz_expect('empty name refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', '  ', 'https://example.com/a.ics'), array['err']);
  perform pg_temp.zz_expect('bad color refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url, color) values (%L, %L, %L)', 'x', 'https://example.com/a.ics', 'red'), array['err']);
  perform pg_temp.zz_expect('link a calendar for someone else', agA, 'authenticated', format('insert into public.agent_calendars (owner_id, name, ics_url) values (%L, %L, %L)', agB, 'planted', 'https://example.com/a.ics'), array['err']);

  perform pg_temp.zz_expect('PRIVACY same-organization admin reads calendars', adA, 'authenticated', format('select count(*) from public.agent_calendars where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY same-organization admin edits a calendar', adA, 'authenticated', format('update public.agent_calendars set name = %L where id = %L', 'HACK', cA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY other organization reads calendars', agB, 'authenticated', format('select count(*) from public.agent_calendars where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY other organization deletes a calendar', agB, 'authenticated', format('delete from public.agent_calendars where id = %L', cA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY platform owner reads calendars', plat, 'authenticated', format('select count(*) from public.agent_calendars where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY anonymous reads calendars', null, 'anon', 'select count(*) from public.agent_calendars', array['0', 'err']);

  -- the cap: 1 already linked, 9 more allowed, the 11th refused
  for i in 1..9 loop
    insert into public.agent_calendars (owner_id, name, ics_url) values (agA, 'cal ' || i, 'https://example.com/' || i || '.ics');
  end loop;
  perform pg_temp.zz_expect('11th calendar refused', agA, 'authenticated', format('insert into public.agent_calendars (name, ics_url) values (%L, %L)', 'one too many', 'https://example.com/11.ics'), array['err']);

  -- goals
  perform pg_temp.zz_expect('owner saves goals', agA, 'authenticated', format($q$insert into public.people_settings (owner_id, goals) values (%L, '{"2026":{"commission":150000,"deals":20}}')$q$, agA), array['rows:1']);
  perform pg_temp.zz_expect('owner reads goals', agA, 'authenticated', $q$select count(*) from public.people_settings where goals -> '2026' ->> 'deals' = '20'$q$, array['1']);
  perform pg_temp.zz_expect('PRIVACY other agent reads goals', agB, 'authenticated', format('select count(*) from public.people_settings where owner_id = %L', agA), array['0']);

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'AGENTCAL pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
