-- IDX SETTINGS TEST (self-contained, rolls itself back; result is the error text IDX SETTINGS pass=N fail: ...).
-- Logged-in users must not be able to read org_settings.idx_config (it holds an API key), must still read their own
-- feature switches, and the platform owner must still be able to write settings.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  uA uuid := gen_random_uuid(); owner uuid := gen_random_uuid();
  fails text := '';
begin
  create function pg_temp.zz_as(actor uuid, q text) returns text language plpgsql as $f$
  declare n bigint; res text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin execute q; get diagnostics n = row_count; res := 'rows:' || n;
    exception when insufficient_privilege then res := 'DENIED'; when others then res := 'err:' || sqlerrm;
    end;
    reset role; return res;
  end $f$;
  create function pg_temp.zz_want(label text, got text, want text) returns text language plpgsql as $f$
  begin return case when got = want then '' else E'\n  FAIL: ' || label || ' -> got ' || got || ', wanted ' || want end; end $f$;

  insert into public.organizations (id, slug, name) values (oA, 'zz-i-a', 'A'), (oB, 'zz-i-b', 'B');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (uA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ia@example.invalid', '{}', now(), now()),
    (owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-io@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, role = 'admin' where id = uA;
  update public.profiles set org_id = oB where id = owner;
  insert into public.platform_admins (user_id) values (owner);
  insert into public.org_settings (org_id, features, idx_config) values
    (oA, '{"idx_allowed": true}', '{"api_key": "SECRET-A"}'), (oB, '{"idx_allowed": true}', '{"api_key": "SECRET-B"}');

  fails := fails || pg_temp.zz_want('org admin reads idx_config', pg_temp.zz_as(uA, 'select idx_config from public.org_settings'), 'DENIED');
  fails := fails || pg_temp.zz_want('org admin select *', pg_temp.zz_as(uA, 'select * from public.org_settings'), 'DENIED');
  fails := fails || pg_temp.zz_want('org admin reads own feature switches', pg_temp.zz_as(uA, 'select features from public.org_settings'), 'rows:1');
  fails := fails || pg_temp.zz_want('org admin writes settings', pg_temp.zz_as(uA, 'update public.org_settings set features = ''{}''::jsonb'), 'rows:0');
  fails := fails || pg_temp.zz_want('platform owner sets IDX settings', pg_temp.zz_as(owner, format('update public.org_settings set idx_config = %L where org_id = %L', '{"api_key":"NEW"}', oB)), 'rows:1');
  fails := fails || pg_temp.zz_want('platform owner reads feature switches of every org', pg_temp.zz_as(owner, format('select features from public.org_settings where org_id in (%L, %L)', oA, oB)), 'rows:2');
  fails := fails || pg_temp.zz_want('platform owner cannot read idx_config in the app either', pg_temp.zz_as(owner, 'select idx_config from public.org_settings'), 'DENIED');
  fails := fails || pg_temp.zz_want('stored value was changed', (select idx_config->>'api_key' from public.org_settings where org_id = oB), 'NEW');

  raise exception 'IDX SETTINGS failures:%', coalesce(nullif(fails, ''), ' none');
end $outer$;
