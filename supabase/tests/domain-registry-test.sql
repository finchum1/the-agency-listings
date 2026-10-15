-- DOMAIN REGISTRY TEST (self-contained, rolls itself back; result is the error text DOMAIN REGISTRY pass=N fail=M).
-- Two organizations, each with an admin, an agent site and a brokerage site. Checks that a domain can belong to one site in the
-- whole database, that the registry follows changes, and that organization admins cannot write the registry directly.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  adA uuid := gen_random_uuid(); adB uuid := gen_random_uuid();
  siteA uuid := gen_random_uuid(); siteB uuid := gen_random_uuid();
  npass int := 0; fails text := '';
  r text;
begin
  create function pg_temp.zz_run(actor uuid, q text) returns text language plpgsql as $f$
  declare n bigint; res text;
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
    execute 'set local role authenticated';
    begin execute q; get diagnostics n = row_count; res := 'rows:' || n;
    exception when unique_violation then res := 'UNIQUE'; when others then res := 'err';
    end;
    reset role; return res;
  end $f$;
  create function pg_temp.zz_ok(label text, got text, want text[]) returns text language plpgsql as $f$
  begin return case when got = any(want) then '' else E'\n  FAIL: ' || label || ' -> got ' || got end; end $f$;

  insert into public.organizations (id, slug, name) values (oA, 'zz-d-a', 'A'), (oB, 'zz-d-b', 'B');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-da@example.invalid', '{}', now(), now()),
    (adB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-db@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, role = 'admin' where id = adA;
  update public.profiles set org_id = oB, role = 'admin' where id = adB;
  insert into public.agent_sites (id, agent_id, slug, custom_domain) values (siteA, adA, 'zz-d-site-a', 'a-domain.example'), (siteB, adB, 'zz-d-site-b', null);
  insert into public.brokerage_site (org_id, status) values (oA, 'published'), (oB, 'published');

  fails := fails || pg_temp.zz_ok('registry mirrored A''s agent-site domain', (select count(*)::text from public.org_domains where domain = 'a-domain.example' and org_id = oA and source = 'agent_site'), array['1']);
  r := pg_temp.zz_run(adB, format('update public.agent_sites set custom_domain = %L where id = %L', 'a-domain.example', siteB));
  fails := fails || pg_temp.zz_ok('B claims A''s domain on an agent site', r, array['UNIQUE']);
  r := pg_temp.zz_run(adB, format('update public.brokerage_site set custom_domain = %L where org_id = %L', 'a-domain.example', oB));
  fails := fails || pg_temp.zz_ok('B claims A''s domain on a brokerage site', r, array['UNIQUE']);
  r := pg_temp.zz_run(adA, format('update public.brokerage_site set custom_domain = %L where org_id = %L', 'a-domain.example', oA));
  fails := fails || pg_temp.zz_ok('A reuses its own agent-site domain on its brokerage site (still one owner)', r, array['UNIQUE']);
  r := pg_temp.zz_run(adB, format('update public.brokerage_site set custom_domain = %L where org_id = %L', 'b-domain.example', oB));
  fails := fails || pg_temp.zz_ok('B claims a new domain', r, array['rows:1']);
  fails := fails || pg_temp.zz_ok('registry has B''s new domain', (select count(*)::text from public.org_domains where domain = 'b-domain.example' and org_id = oB), array['1']);
  r := pg_temp.zz_run(adB, format('update public.brokerage_site set custom_domain = %L where org_id = %L', 'B-Domain2.Example ', oB));
  fails := fails || pg_temp.zz_ok('B changes domain (mixed case, trailing space)', r, array['rows:1']);
  fails := fails || pg_temp.zz_ok('registry normalized and moved the row (no leftover)', (select count(*)::text from public.org_domains where domain = 'b-domain2.example' and org_id = oB) || '/' || (select count(*)::text from public.org_domains where domain = 'b-domain.example'), array['1/0']);
  r := pg_temp.zz_run(adB, format('update public.brokerage_site set custom_domain = null where org_id = %L', oB));
  fails := fails || pg_temp.zz_ok('B clears its domain', r, array['rows:1']);
  fails := fails || pg_temp.zz_ok('registry released the cleared domain', (select count(*)::text from public.org_domains where domain = 'b-domain2.example'), array['0']);
  r := pg_temp.zz_run(adB, format('update public.agent_sites set custom_domain = %L where id = %L', 'b-domain2.example', siteB));
  fails := fails || pg_temp.zz_ok('a released domain can be claimed again', r, array['rows:1']);
  delete from public.agent_sites where id = siteB;
  fails := fails || pg_temp.zz_ok('deleting a site frees its domain', (select count(*)::text from public.org_domains where domain = 'b-domain2.example'), array['0']);
  r := pg_temp.zz_run(adA, format('insert into public.org_domains (domain, org_id, kind) values (%L, %L, %L)', 'grab.example', oA, 'app'));
  fails := fails || pg_temp.zz_ok('org admin writes the registry directly', r, array['err']);
  r := pg_temp.zz_run(adA, format('update public.org_domains set google_site_verification = %L where domain = %L', 'HACK', 'a-domain.example'));
  fails := fails || pg_temp.zz_ok('org admin plants a Search Console token on its own domain', r, array['rows:0','err']);
  r := pg_temp.zz_run(adA, format('delete from public.org_domains where domain = %L', 'a-domain.example'));
  fails := fails || pg_temp.zz_ok('org admin deletes a registry row directly', r, array['rows:0','err']);
  fails := fails || pg_temp.zz_ok('registry row still there', (select count(*)::text from public.org_domains where domain = 'a-domain.example'), array['1']);

  raise exception 'DOMAIN REGISTRY failures:%', coalesce(nullif(fails, ''), ' none');
end $outer$;
