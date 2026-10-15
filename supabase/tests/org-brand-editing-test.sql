-- ORG BRAND EDITING TEST (self-contained, rolls itself back; result is the error text ORGBRAND pass=N fail=M ...).
-- Checks multi-tenant-1i-org-brand-editing.sql: organization admins can edit their own organization's brand, but not
-- its identity (slug/type/status), the franchise disclaimer, or a franchise organization's logos and colors; nobody
-- can store a malformed brand; other organizations and plain agents are walled out; the platform owner can do all of it.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  adA uuid := gen_random_uuid(); agA uuid := gen_random_uuid(); adB uuid := gen_random_uuid();
  plat uuid := (select user_id from public.platform_admins limit 1);
  npass int; nfail int; fails text; n int;
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

  insert into public.organizations (id, slug, name, brand, franchise_disclaimer) values
    (oA, 'zz-ob-a', 'The Agency', '{"franchise":"the-agency","logos":{"red":"/images/brokerage-logo.png","white":"/images/brokerage-logo-white.png"},"default_logo":"red","accent_colors":["#ed2127","#000000"],"location_label":"Texas"}', 'FRANCHISE TEXT'),
    (oB, 'zz-ob-b', 'Blue Door Realty', '{"logos":{"main":"/b-main.png"},"default_logo":"main","accent_colors":["#1a5fb4"],"location_label":"Austin"}', '');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-oba@example.invalid', '{}', now(), now()),
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-obg@example.invalid', '{}', now(), now()),
    (adB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-obb@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, role = 'admin' where id = adA;
  update public.profiles set org_id = oA, role = 'agent' where id = agA;
  update public.profiles set org_id = oB, role = 'admin' where id = adB;

  -- franchise organization (A): what its own admin may and may not do
  perform pg_temp.zz_expect('A admin renames display name', adA, 'authenticated', format('update public.organizations set name=%L where id=%L', 'The Agency Austin', oA), array['rows:1']);
  perform pg_temp.zz_expect('A admin changes location label', adA, 'authenticated', format($q$update public.organizations set brand = brand || '{"location_label":"Houston"}' where id=%L$q$, oA), array['rows:1']);
  perform pg_temp.zz_expect('A admin edits address and disclaimer', adA, 'authenticated', format('update public.organizations set city=%L, address_line1=%L, disclaimer=%L where id=%L', 'Houston', '1 Main St', 'EHO', oA), array['rows:1']);
  perform pg_temp.zz_expect('A admin changes slug', adA, 'authenticated', format('update public.organizations set slug=%L where id=%L', 'zz-ob-hijack', oA), array['err']);
  perform pg_temp.zz_expect('A admin changes type', adA, 'authenticated', format('update public.organizations set type=%L where id=%L', 'solo', oA), array['err']);
  perform pg_temp.zz_expect('A admin changes status', adA, 'authenticated', format('update public.organizations set status=%L where id=%L', 'paused', oA), array['err']);
  perform pg_temp.zz_expect('A admin changes franchise disclaimer', adA, 'authenticated', format('update public.organizations set franchise_disclaimer=%L where id=%L', 'x', oA), array['err']);
  perform pg_temp.zz_expect('A admin swaps the franchise logo', adA, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,red}', '"/evil.png"') where id=%L$q$, oA), array['err']);
  perform pg_temp.zz_expect('A admin changes the franchise colors', adA, 'authenticated', format($q$update public.organizations set brand = brand || '{"accent_colors":["#00ff00"]}' where id=%L$q$, oA), array['err']);
  perform pg_temp.zz_expect('A admin removes the franchise flag', adA, 'authenticated', format($q$update public.organizations set brand = brand - 'franchise' where id=%L$q$, oA), array['err']);
  perform pg_temp.zz_expect('A plain agent edits A', agA, 'authenticated', format('update public.organizations set name=%L where id=%L', 'x', oA), array['rows:0']);

  -- custom organization (B): full brand control for its own admin
  perform pg_temp.zz_expect('B admin sets a white logo', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,white}', '"https://example.supabase.co/storage/v1/object/public/brokerage-site-photos/x/brand/white.png"') where id=%L$q$, oB), array['rows:1']);
  perform pg_temp.zz_expect('B admin sets a relative logo', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,black}', '"/images/b-black.png"') where id=%L$q$, oB), array['rows:1']);
  perform pg_temp.zz_expect('B admin sets brand colors', adB, 'authenticated', format($q$update public.organizations set brand = brand || '{"accent_colors":["#1A5FB4","#222222"]}' where id=%L$q$, oB), array['rows:1']);
  perform pg_temp.zz_expect('B logo with javascript:', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,main}', '"javascript:alert(1)"') where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B logo with data:', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,main}', '"data:image/svg+xml,<svg/>"') where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B logo with http:', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,main}', '"http://example.com/a.png"') where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B logo with protocol-relative //', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,main}', '"//evil.example/a.png"') where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B logo key with capitals', adB, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,Bad Key}', '"/a.png"') where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B color not hex', adB, 'authenticated', format($q$update public.organizations set brand = brand || '{"accent_colors":["red"]}' where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B seven colors', adB, 'authenticated', format($q$update public.organizations set brand = brand || '{"accent_colors":["#111111","#222222","#333333","#444444","#555555","#666666","#777777"]}' where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B brand is not an object', adB, 'authenticated', format($q$update public.organizations set brand = '[1]'::jsonb where id=%L$q$, oB), array['err']);
  perform pg_temp.zz_expect('B empty name', adB, 'authenticated', format('update public.organizations set name=%L where id=%L', '  ', oB), array['err']);

  -- walls
  perform pg_temp.zz_expect('A admin edits B', adA, 'authenticated', format('update public.organizations set name=%L where id=%L', 'x', oB), array['rows:0']);
  perform pg_temp.zz_expect('B admin edits A', adB, 'authenticated', format('update public.organizations set name=%L where id=%L', 'x', oA), array['rows:0']);
  perform pg_temp.zz_expect('B admin creates an organization', adB, 'authenticated', format('insert into public.organizations (slug,name) values (%L,%L)', 'zz-ob-new', 'x'), array['err']);
  perform pg_temp.zz_expect('anonymous edits A', null, 'anon', format('update public.organizations set name=%L where id=%L', 'x', oA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('CONTROL anonymous still reads A (public login/site brand)', null, 'anon', format('select count(*) from public.organizations where id=%L', oA), array['1']);

  -- platform owner
  perform pg_temp.zz_expect('platform creates an organization', plat, 'authenticated', format($q$insert into public.organizations (slug,name,brand) values (%L,%L,%L)$q$, 'zz-ob-p', 'P', '{"franchise":"the-agency","location_label":"Dallas"}'), array['rows:1']);
  perform pg_temp.zz_expect('platform: reserved slug', plat, 'authenticated', format('insert into public.organizations (slug,name) values (%L,%L)', 'dashboard', 'x'), array['err']);
  perform pg_temp.zz_expect('platform: bad slug format', plat, 'authenticated', format('insert into public.organizations (slug,name) values (%L,%L)', 'Bad Slug', 'x'), array['err']);
  perform pg_temp.zz_expect('platform: duplicate slug', plat, 'authenticated', format('insert into public.organizations (slug,name) values (%L,%L)', 'zz-ob-a', 'x'), array['err']);
  perform pg_temp.zz_expect('platform changes franchise logo', plat, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,red}', '"/images/new-red.png"') where id=%L$q$, oA), array['rows:1']);
  perform pg_temp.zz_expect('platform changes franchise disclaimer', plat, 'authenticated', format('update public.organizations set franchise_disclaimer=%L where id=%L', 'NEW TEXT', oA), array['rows:1']);
  perform pg_temp.zz_expect('platform pauses B', plat, 'authenticated', format('update public.organizations set status=%L where id=%L', 'paused', oB), array['rows:1']);
  perform pg_temp.zz_expect('platform: malformed logo still rejected', plat, 'authenticated', format($q$update public.organizations set brand = jsonb_set(brand, '{logos,main}', '"javascript:1"') where id=%L$q$, oB), array['err']);

  -- the audit trail recorded the legitimate edits
  select count(*) into n from public.audit_log where org_id = oA and action = 'update_org' and actor_id = adA;
  insert into zz_results values (n >= 3, 'audit log has A admin edits (got ' || n || ')');
  select count(*) into n from public.audit_log where org_id = oB and action = 'update_org' and actor_id = adB;
  insert into zz_results values (n >= 3, 'audit log has B admin edits (got ' || n || ')');

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'ORGBRAND pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
