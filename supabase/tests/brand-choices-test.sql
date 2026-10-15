-- BRAND CHOICES TEST (self-contained, rolls itself back; result is the error text BRAND CHOICES failures: none | list).
-- Three organizations with different brands. Checks that accent and logo choices follow each organization's own brand
-- list (multi-tenant-1f-brand-choices.sql), not The Agency's hardcoded red/black.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid(); oC uuid := gen_random_uuid();
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uC uuid := gen_random_uuid();
  fails text := '';
  res text;
  v text;
begin
  create function pg_temp.zz_try(q text) returns text language plpgsql as $f$
  begin
    begin execute q; return 'ok';
    exception when check_violation then return 'CHECK'; when others then return 'err:' || sqlerrm;
    end;
  end $f$;
  create function pg_temp.zz_want(label text, got text, want text) returns text language plpgsql as $f$
  begin return case when got = want then '' else E'\n  FAIL: ' || label || ' -> got ' || got || ', wanted ' || want end; end $f$;

  insert into public.organizations (id, slug, name, brand) values
    (oA, 'zz-b-a', 'A', '{"logos":{"red":"/a-red.png","white":"/a-white.png","black":"/a-black.png"},"default_logo":"red","accent_colors":["#ed2127","#000000"]}'),
    (oB, 'zz-b-b', 'B', '{"logos":{"main":"/b-main.png","mono":"/b-mono.png"},"default_logo":"main","accent_colors":["#1a5fb4"]}'),
    (oC, 'zz-b-c', 'C', '{}');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (uA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ba@example.invalid', '{}', now(), now()),
    (uB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-bb@example.invalid', '{}', now(), now()),
    (uC, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-bc@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA where id = uA;
  update public.profiles set org_id = oB where id = uB;
  update public.profiles set org_id = oC where id = uC;
  insert into public.agent_sites (agent_id, slug) values (uA, 'zz-b-site-a'), (uB, 'zz-b-site-b'), (uC, 'zz-b-site-c');
  insert into public.brokerage_site (org_id) values (oA), (oB);

  -- accent colors
  fails := fails || pg_temp.zz_want('A uses its red', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#ed2127', uA)), 'ok');
  fails := fails || pg_temp.zz_want('A uses red in capitals', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#ED2127', uA)), 'ok');
  fails := fails || pg_temp.zz_want('A uses B''s blue', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#1a5fb4', uA)), 'CHECK');
  fails := fails || pg_temp.zz_want('B uses its blue (capitals)', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#1A5FB4', uB)), 'ok');
  fails := fails || pg_temp.zz_want('B uses The Agency red', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#ed2127', uB)), 'CHECK');
  fails := fails || pg_temp.zz_want('C (no brand colors) uses a color', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', '#ed2127', uC)), 'CHECK');
  fails := fails || pg_temp.zz_want('C clears to template default', pg_temp.zz_try(format('update public.agent_sites set accent_color = null where agent_id = %L', uC)), 'ok');
  fails := fails || pg_temp.zz_want('not a hex color', pg_temp.zz_try(format('update public.agent_sites set accent_color = %L where agent_id = %L', 'red', uA)), 'CHECK');
  fails := fails || pg_temp.zz_want('brokerage site: B blue', pg_temp.zz_try(format('update public.brokerage_site set accent_color = %L where org_id = %L', '#1a5fb4', oB)), 'ok');
  fails := fails || pg_temp.zz_want('brokerage site: B uses A''s black', pg_temp.zz_try(format('update public.brokerage_site set accent_color = %L where org_id = %L', '#000000', oB)), 'CHECK');

  -- logo variants
  select logo_variant into v from public.agent_sites where agent_id = uB;
  fails := fails || pg_temp.zz_want('B''s new site (column default red) was moved to its default logo', v, 'main');
  select logo_variant into v from public.agent_sites where agent_id = uA;
  fails := fails || pg_temp.zz_want('A''s new site keeps red', v, 'red');
  update public.agent_sites set logo_variant = 'black' where agent_id = uA;
  select logo_variant into v from public.agent_sites where agent_id = uA;
  fails := fails || pg_temp.zz_want('A picks black', v, 'black');
  update public.agent_sites set logo_variant = 'mono' where agent_id = uB;
  select logo_variant into v from public.agent_sites where agent_id = uB;
  fails := fails || pg_temp.zz_want('B picks its mono logo', v, 'mono');
  update public.agent_sites set logo_variant = 'white' where agent_id = uB;
  select logo_variant into v from public.agent_sites where agent_id = uB;
  fails := fails || pg_temp.zz_want('B asks for a logo it does not have: back to its default', v, 'main');
  select logo_variant into v from public.agent_sites where agent_id = uC;
  fails := fails || pg_temp.zz_want('C has no logos: value left alone', v, 'red');
  fails := fails || pg_temp.zz_want('malformed logo key, org without logos', pg_temp.zz_try(format('update public.agent_sites set logo_variant = %L where agent_id = %L', 'Bad Value!', uC)), 'CHECK');
  update public.agent_sites set logo_variant = 'Bad Value!' where agent_id = uA;
  select logo_variant into v from public.agent_sites where agent_id = uA;
  fails := fails || pg_temp.zz_want('malformed logo key, org with logos: replaced by its default', v, 'red');
  select logo_variant into v from public.brokerage_site where org_id = oB;
  fails := fails || pg_temp.zz_want('brokerage site B (column default white) moved to its default logo', v, 'main');

  -- the trigger is on all three tables
  fails := fails || pg_temp.zz_want('trigger on listings, agent_sites, brokerage_site',
    (select count(*)::text from pg_trigger where tgname = 'validate_brand_choices' and not tgisinternal), '3');

  raise exception 'BRAND CHOICES failures:%', coalesce(nullif(fails, ''), ' none');
end $outer$;
