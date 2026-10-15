-- LEAD ALERT ADDRESS TEST (self-contained, rolls itself back; result is the error text LEAD ALERT ADDRESS failures: none | list).
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  adA uuid := gen_random_uuid(); aA uuid := gen_random_uuid(); aB uuid := gen_random_uuid(); owner uuid := gen_random_uuid();
  fails text := '';
begin
  create function pg_temp.zz_as(actor uuid, r text, q text) returns text language plpgsql as $f$
  declare n bigint; res text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', r)::text, true);
    execute 'set local role ' || r;
    begin
      if lower(left(ltrim(q), 6)) = 'select' then execute q into n; res := n::text; else execute q; get diagnostics n = row_count; res := 'rows:' || n; end if;
    exception when insufficient_privilege then res := 'DENIED'; when check_violation then res := 'CHECK'; when others then res := 'err';
    end;
    reset role; return res;
  end $f$;
  create function pg_temp.zz_want(label text, got text, want text) returns text language plpgsql as $f$
  begin return case when got = want then '' else E'\n  FAIL: ' || label || ' -> got ' || got || ', wanted ' || want end; end $f$;

  insert into public.organizations (id, slug, name) values (oA, 'zz-n-a', 'A'), (oB, 'zz-n-b', 'B');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-na@example.invalid', '{}', now(), now()),
    (aA,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-naa@example.invalid', '{}', now(), now()),
    (aB,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-nab@example.invalid', '{}', now(), now()),
    (owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-no@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, role = 'admin' where id = adA;
  update public.profiles set org_id = oA where id = aA;
  update public.profiles set org_id = oB where id = aB;
  update public.profiles set org_id = oB where id = owner;
  insert into public.platform_admins (user_id) values (owner);
  insert into public.agent_notification_settings (agent_id, lead_alert_email) values (aA, 'a-personal@example.invalid'), (aB, 'b-personal@example.invalid');

  fails := fails || pg_temp.zz_want('agent reads own address', pg_temp.zz_as(aA, 'authenticated', format('select count(*) from public.agent_notification_settings where agent_id=%L', aA)), '1');
  fails := fails || pg_temp.zz_want('agent cannot read another agent''s address (other org)', pg_temp.zz_as(aA, 'authenticated', format('select count(*) from public.agent_notification_settings where agent_id=%L', aB)), '0');
  fails := fails || pg_temp.zz_want('own org admin cannot read an agent''s address', pg_temp.zz_as(adA, 'authenticated', format('select count(*) from public.agent_notification_settings where agent_id=%L', aA)), '0');
  fails := fails || pg_temp.zz_want('anonymous visitor cannot read the table', pg_temp.zz_as(null, 'anon', 'select count(*) from public.agent_notification_settings'), 'DENIED');
  fails := fails || pg_temp.zz_want('platform owner can read (support)', pg_temp.zz_as(owner, 'authenticated', format('select count(*) from public.agent_notification_settings where agent_id=%L', aA)), '1');
  fails := fails || pg_temp.zz_want('agent changes own address', pg_temp.zz_as(aA, 'authenticated', format('update public.agent_notification_settings set lead_alert_email=%L where agent_id=%L', 'new@example.invalid', aA)), 'rows:1');
  fails := fails || pg_temp.zz_want('agent changes another agent''s address', pg_temp.zz_as(aA, 'authenticated', format('update public.agent_notification_settings set lead_alert_email=%L where agent_id=%L', 'hijack@example.invalid', aB)), 'rows:0');
  fails := fails || pg_temp.zz_want('agent inserts a row for someone else', pg_temp.zz_as(aA, 'authenticated', format('insert into public.agent_notification_settings (agent_id, lead_alert_email) values (%L, %L) on conflict (agent_id) do nothing', gen_random_uuid(), 'x@example.invalid')), 'DENIED');
  fails := fails || pg_temp.zz_want('malformed address rejected', pg_temp.zz_as(aA, 'authenticated', format('update public.agent_notification_settings set lead_alert_email=%L where agent_id=%L', 'not an email', aA)), 'CHECK');
  fails := fails || pg_temp.zz_want('agent clears own address (null)', pg_temp.zz_as(aA, 'authenticated', format('update public.agent_notification_settings set lead_alert_email=null where agent_id=%L', aA)), 'rows:1');
  fails := fails || pg_temp.zz_want('the address is NOT readable through the public profiles table', (select count(*)::text from information_schema.columns where table_schema='public' and table_name='profiles' and column_name ilike '%alert%'), '0');
  raise exception 'LEAD ALERT ADDRESS failures:%', coalesce(nullif(fails, ''), ' none');
end $outer$;
