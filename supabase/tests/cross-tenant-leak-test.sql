-- CROSS-TENANT LEAK TEST: the release gate for the multi-tenant platform.
--
-- Builds two competing brokerages (A, B) and a solo agent (C), then tries to read and write across
-- the walls as every kind of user: org admins, agents, a solo agent, the platform owner, and anonymous
-- visitors. Each "deny" check has "control" checks beside it proving legitimate access still works, so a
-- pass cannot simply mean "everything is locked".
--
-- Safe to run anywhere: it ends by raising an exception that rolls back ALL fixtures. The result is the
-- error text:  LEAKTEST pass=N fail=M ... Run it after every change to access rules, on staging first.
-- Run in the Supabase SQL editor or via the MCP execute_sql tool. Needs the platform owner account to exist.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid(); oC uuid := gen_random_uuid();
  adA uuid := gen_random_uuid(); aA uuid := gen_random_uuid();
  adB uuid := gen_random_uuid(); aB uuid := gen_random_uuid();
  sC uuid := gen_random_uuid();
  plat uuid := (select user_id from public.platform_admins limit 1);
  siteA uuid := gen_random_uuid(); siteAd uuid := gen_random_uuid();
  siteB uuid := gen_random_uuid(); siteBd uuid := gen_random_uuid(); siteC uuid := gen_random_uuid();
  lAp uuid := gen_random_uuid(); lAd uuid := gen_random_uuid();
  lBp uuid := gen_random_uuid(); lBd uuid := gen_random_uuid(); lCd uuid := gen_random_uuid();
  nB uuid; stamp uuid;
  npass int; nfail int; fails text;
begin
  create temp table zz_results (ok boolean, name text);

  -- Runs one statement as a given user and role, returns: a count, 'rows:N', or 'err'. Always restores the role.
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

  -- want: allowed results. 'pos' means any count above zero.
  create function pg_temp.zz_expect(label text, actor uuid, r text, q text, want text[]) returns void language plpgsql as $f$
  declare got text := pg_temp.zz_run(actor, r, q);
  begin
    insert into zz_results values (got = any(want) or ('pos' = any(want) and got ~ '^[1-9][0-9]*$'), label || ' -> got ' || got);
  end $f$;

  -- ------------------------------------------------------------------ fixtures
  insert into public.organizations (id, slug, name, type) values
    (oA, 'zz-test-a', 'ZZ Test A', 'brokerage'), (oB, 'zz-test-b', 'ZZ Test B', 'brokerage'), (oC, 'zz-test-c', 'ZZ Test C', 'solo');
  insert into public.org_settings (org_id) values (oA), (oB), (oC);

  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ada@example.invalid', '{}', now(), now()),
    (aA,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-aa@example.invalid',  '{}', now(), now()),
    (adB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-adb@example.invalid', '{}', now(), now()),
    (aB,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ab@example.invalid',  '{}', now(), now()),
    (sC,  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-sc@example.invalid',  '{}', now(), now());
  update public.profiles set org_id = oA, role = 'admin', people_enabled = true where id = adA;
  update public.profiles set org_id = oA, people_enabled = true where id = aA;
  update public.profiles set org_id = oB, role = 'admin', people_enabled = true where id = adB;
  update public.profiles set org_id = oB, people_enabled = true where id = aB;
  update public.profiles set org_id = oC, people_enabled = true where id = sC;

  insert into public.agent_sites (id, agent_id, slug, status) values
    (siteA, aA, 'zz-site-a', 'published'), (siteAd, adA, 'zz-site-a-draft', 'draft'),
    (siteB, aB, 'zz-site-b', 'published'), (siteBd, adB, 'zz-site-b-draft', 'draft'), (siteC, sC, 'zz-site-c-draft', 'draft');
  insert into public.listings (id, slug, agent_id, status, address_line1, city, state, zip) values
    (lAp, 'zz-la-pub', aA, 'for_sale', '1 A St', 'X', 'OK', '1'), (lAd, 'zz-la-draft', aA, 'draft', '2 A St', 'X', 'OK', '1'),
    (lBp, 'zz-lb-pub', aB, 'for_sale', '1 B St', 'X', 'OK', '1'), (lBd, 'zz-lb-draft', aB, 'draft', '2 B St', 'X', 'OK', '1'),
    (lCd, 'zz-lc-draft', sC, 'draft', '1 C St', 'X', 'OK', '1');
  insert into public.upcoming_listings (agent_id) values (aA), (aB);
  insert into public.buyer_needs (agent_id) values (aA), (aB);
  insert into public.leads (target_type, target_id, agent_id, name, email) values
    ('agent_site', siteA, aA, 'Lead A', 'la@example.invalid'), ('agent_site', siteAd, adA, 'Lead Ad', 'lad@example.invalid'),
    ('agent_site', siteB, aB, 'Lead B', 'lb@example.invalid');
  insert into public.page_views (target_type, target_id) values ('agent_site', siteA), ('agent_site', siteB);
  insert into public.brokerage_site (org_id, status, tagline) values (oA, 'published', 'A'), (oB, 'published', 'B');
  insert into public.brokerage_agents (org_id, slug, name) values (oA, 'a1', 'A1'), (oB, 'b1', 'B1');
  insert into public.brokerage_posts (org_id, slug, title, status) values (oA, 'pa', 'PA', 'draft'), (oB, 'pb', 'PB', 'draft');
  insert into public.people (owner_id, name) values (aA, 'Person A'), (aB, 'Person B');
  insert into storage.objects (bucket_id, name) values ('brokerage-site-photos', oA || '/seed.jpg'), ('brokerage-site-photos', oB || '/seed.jpg');

  -- Stamping: rows picked up the right organization with no help from the caller
  insert into zz_results select (select org_id from public.listings where id = lBp) = oB, 'trigger stamped B listing with org B';
  insert into zz_results select (select org_id from public.leads where email = 'lb@example.invalid') = oB, 'trigger stamped B lead with org B';
  insert into zz_results select (select org_id from public.page_views where target_id = siteB) = oB, 'trigger stamped B page view with org B';

  -- ============ ORG ADMIN A: cannot see B's private data ============
  perform pg_temp.zz_expect('adA reads B draft listings', adA, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oB, 'draft'), array['0','err']);
  perform pg_temp.zz_expect('adA reads B draft agent sites', adA, 'authenticated', format('select count(*) from public.agent_sites where org_id=%L and status=%L', oB, 'draft'), array['0','err']);
  perform pg_temp.zz_expect('adA reads B leads', adA, 'authenticated', format('select count(*) from public.leads where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B page views', adA, 'authenticated', format('select count(*) from public.page_views where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B upcoming listings', adA, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B buyer needs', adA, 'authenticated', format('select count(*) from public.buyer_needs where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B draft brokerage posts', adA, 'authenticated', format('select count(*) from public.brokerage_posts where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B agents'' People records', adA, 'authenticated', format('select count(*) from public.people where owner_id=%L', aB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B org settings', adA, 'authenticated', format('select count(*) from public.org_settings where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('adA reads B admin profile (draft site only)', adA, 'authenticated', format('select count(*) from public.profiles where id=%L', adB), array['0','err']);
  perform pg_temp.zz_expect('adA reads platform_admins', adA, 'authenticated', 'select count(*) from public.platform_admins', array['0','err']);
  perform pg_temp.zz_expect('adA reads audit_log', adA, 'authenticated', 'select count(*) from public.audit_log', array['0','err']);
  -- controls: A's own data is visible to A's admin
  perform pg_temp.zz_expect('CONTROL adA reads A leads', adA, 'authenticated', format('select count(*) from public.leads where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads A draft listings', adA, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oA, 'draft'), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads A draft sites', adA, 'authenticated', format('select count(*) from public.agent_sites where org_id=%L and status=%L', oA, 'draft'), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads A upcoming listings', adA, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads A buyer needs', adA, 'authenticated', format('select count(*) from public.buyer_needs where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads A draft brokerage posts', adA, 'authenticated', format('select count(*) from public.brokerage_posts where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads agent profile in own org', adA, 'authenticated', format('select count(*) from public.profiles where id=%L', aA), array['pos']);
  perform pg_temp.zz_expect('CONTROL adA reads own org settings', adA, 'authenticated', format('select count(*) from public.org_settings where org_id=%L', oA), array['1']);
  -- privacy promise: even an admin cannot read an agent's People/CRM
  perform pg_temp.zz_expect('PRIVACY adA reads own agent''s People records', adA, 'authenticated', format('select count(*) from public.people where owner_id=%L', aA), array['0','err']);
  -- public by design: published things of other organizations are visible to everyone
  perform pg_temp.zz_expect('PUBLIC adA sees B published site', adA, 'authenticated', format('select count(*) from public.agent_sites where org_id=%L and status=%L', oB, 'published'), array['1']);
  perform pg_temp.zz_expect('PUBLIC adA sees B published listing', adA, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oB, 'for_sale'), array['1']);

  -- ============ ORG ADMIN A: cannot write into B ============
  perform pg_temp.zz_expect('adA updates B listing', adA, 'authenticated', format('update public.listings set city=%L where id=%L', 'HACK', lBp), array['rows:0','err']);
  perform pg_temp.zz_expect('adA deletes B site', adA, 'authenticated', format('delete from public.agent_sites where id=%L', siteB), array['rows:0','err']);
  perform pg_temp.zz_expect('adA inserts listing owned by B agent', adA, 'authenticated', format('insert into public.listings (slug,agent_id,address_line1,city,state,zip) values (%L,%L,%L,%L,%L,%L)', 'zz-hack-1', aB, 'x', 'x', 'OK', '1'), array['err']);
  perform pg_temp.zz_expect('adA promotes B agent to admin', adA, 'authenticated', format('update public.profiles set role=%L where id=%L', 'admin', aB), array['rows:0','err']);
  perform pg_temp.zz_expect('adA moves self into org B', adA, 'authenticated', format('update public.profiles set org_id=%L where id=%L', oB, adA), array['err']);
  perform pg_temp.zz_expect('adA moves own agent into org B', adA, 'authenticated', format('update public.profiles set org_id=%L where id=%L', oB, aA), array['err']);
  perform pg_temp.zz_expect('adA inserts brokerage agent into org B', adA, 'authenticated', format('insert into public.brokerage_agents (org_id,slug,name) values (%L,%L,%L)', oB, 'zz-hack', 'x'), array['err']);
  perform pg_temp.zz_expect('adA edits B brokerage site', adA, 'authenticated', format('update public.brokerage_site set tagline=%L where org_id=%L', 'HACK', oB), array['rows:0','err']);
  perform pg_temp.zz_expect('adA uploads into B storage folder', adA, 'authenticated', format('insert into storage.objects (bucket_id,name) values (%L,%L)', 'brokerage-site-photos', oB || '/hack.jpg'), array['err']);
  perform pg_temp.zz_expect('adA uploads into B brokerage SITE folder', adA, 'authenticated', format('insert into storage.objects (bucket_id,name) values (%L,%L)', 'brokerage-site-photos', (select id from public.brokerage_site where org_id = oB)::text || '/hack.jpg'), array['err']);
  perform pg_temp.zz_expect('CONTROL adA uploads into own brokerage SITE folder', adA, 'authenticated', format('insert into storage.objects (bucket_id,name) values (%L,%L)', 'brokerage-site-photos', (select id from public.brokerage_site where org_id = oA)::text || '/site.jpg'), array['rows:1']);
  perform pg_temp.zz_expect('adA uploads into an unknown folder', adA, 'authenticated', format('insert into storage.objects (bucket_id,name) values (%L,%L)', 'brokerage-site-photos', 'loose/hack.jpg'), array['err']);
  perform pg_temp.zz_expect('adA deletes B storage file', adA, 'authenticated', format('delete from storage.objects where bucket_id=%L and name=%L', 'brokerage-site-photos', oB || '/seed.jpg'), array['rows:0','err']);
  perform pg_temp.zz_expect('adA edits B org settings', adA, 'authenticated', format('update public.org_settings set features=%L where org_id=%L', '{"hack":true}', oB), array['rows:0','err']);
  perform pg_temp.zz_expect('adA creates an organization', adA, 'authenticated', format('insert into public.organizations (slug,name) values (%L,%L)', 'zz-hack-org', 'x'), array['err']);
  perform pg_temp.zz_expect('adA renames org B', adA, 'authenticated', format('update public.organizations set name=%L where id=%L', 'HACK', oB), array['rows:0','err']);
  perform pg_temp.zz_expect('adA edits solo agent switches', adA, 'authenticated', format('update public.profiles set people_enabled=false where id=%L', sC), array['rows:0','err']);
  -- controls: legitimate admin work inside own organization
  perform pg_temp.zz_expect('CONTROL adA switches own agent People off', adA, 'authenticated', format('update public.profiles set people_enabled=false where id=%L', aA), array['rows:1']);
  update public.profiles set people_enabled = true where id = aA; -- put it back so later checks are order-independent
  perform pg_temp.zz_expect('CONTROL adA uploads into own storage folder', adA, 'authenticated', format('insert into storage.objects (bucket_id,name) values (%L,%L)', 'brokerage-site-photos', oA || '/new.jpg'), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL adA adds listing for own agent', adA, 'authenticated', format('insert into public.listings (slug,agent_id,address_line1,city,state,zip) values (%L,%L,%L,%L,%L,%L)', 'zz-ok-1', aA, 'x', 'x', 'OK', '1'), array['rows:1']);
  insert into zz_results select (select org_id from public.listings where slug = 'zz-ok-1') = oA, 'trigger stamped admin-created listing with the AGENT''s org A';
  perform pg_temp.zz_expect('CONTROL adA edits own brokerage site', adA, 'authenticated', format('update public.brokerage_site set tagline=%L where org_id=%L', 'ok', oA), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL adA adds brokerage agent (stamped to own org)', adA, 'authenticated', format('insert into public.brokerage_agents (slug,name) values (%L,%L)', 'zz-a2', 'A2'), array['rows:1']);
  insert into zz_results select (select org_id from public.brokerage_agents where slug = 'zz-a2') = oA, 'trigger stamped admin-created brokerage agent with own org A';

  -- ============ AGENT A: ordinary agent ============
  perform pg_temp.zz_expect('aA reads B draft listings', aA, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oB, 'draft'), array['0','err']);
  perform pg_temp.zz_expect('aA reads B upcoming listings', aA, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('aA reads B buyer needs', aA, 'authenticated', format('select count(*) from public.buyer_needs where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('aA reads B leads', aA, 'authenticated', format('select count(*) from public.leads where org_id=%L', oB), array['0','err']);
  perform pg_temp.zz_expect('aA reads colleague''s lead', aA, 'authenticated', format('select count(*) from public.leads where agent_id=%L', adA), array['0','err']);
  perform pg_temp.zz_expect('aA reads colleague''s draft site', aA, 'authenticated', format('select count(*) from public.agent_sites where id=%L', siteAd), array['0','err']);
  perform pg_temp.zz_expect('aA reads B agent People records', aA, 'authenticated', format('select count(*) from public.people where owner_id=%L', aB), array['0','err']);
  perform pg_temp.zz_expect('CONTROL aA reads own lead', aA, 'authenticated', format('select count(*) from public.leads where agent_id=%L', aA), array['pos']);
  perform pg_temp.zz_expect('CONTROL aA reads shared upcoming board (own org)', aA, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL aA reads shared buyer board (own org)', aA, 'authenticated', format('select count(*) from public.buyer_needs where org_id=%L', oA), array['pos']);
  perform pg_temp.zz_expect('CONTROL aA reads own People records', aA, 'authenticated', format('select count(*) from public.people where owner_id=%L', aA), array['pos']);
  perform pg_temp.zz_expect('aA makes self admin', aA, 'authenticated', format('update public.profiles set role=%L where id=%L', 'admin', aA), array['err']);
  perform pg_temp.zz_expect('aA changes own site access', aA, 'authenticated', format('update public.profiles set site_access=%L where id=%L', 'none', aA), array['err']);
  perform pg_temp.zz_expect('aA moves self to org B', aA, 'authenticated', format('update public.profiles set org_id=%L where id=%L', oB, aA), array['err']);
  perform pg_temp.zz_expect('aA edits B listing', aA, 'authenticated', format('update public.listings set city=%L where id=%L', 'HACK', lBp), array['rows:0','err']);
  perform pg_temp.zz_expect('aA inserts listing for B agent', aA, 'authenticated', format('insert into public.listings (slug,agent_id,address_line1,city,state,zip) values (%L,%L,%L,%L,%L,%L)', 'zz-hack-2', aB, 'x', 'x', 'OK', '1'), array['err']);
  perform pg_temp.zz_expect('aA inserts upcoming listing for B agent', aA, 'authenticated', format('insert into public.upcoming_listings (agent_id) values (%L)', aB), array['err']);
  perform pg_temp.zz_expect('aA deletes B buyer needs', aA, 'authenticated', format('delete from public.buyer_needs where agent_id=%L', aB), array['rows:0','err']);
  perform pg_temp.zz_expect('CONTROL aA edits own listing', aA, 'authenticated', format('update public.listings set city=%L where id=%L', 'Edmond', lAp), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL aA adds own listing', aA, 'authenticated', format('insert into public.listings (slug,agent_id,address_line1,city,state,zip) values (%L,%L,%L,%L,%L,%L)', 'zz-ok-2', aA, 'x', 'x', 'OK', '1'), array['rows:1']);

  -- ============ SOLO AGENT C ============
  perform pg_temp.zz_expect('sC reads A upcoming listings', sC, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oA), array['0','err']);
  perform pg_temp.zz_expect('sC reads A draft listings', sC, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oA, 'draft'), array['0','err']);
  perform pg_temp.zz_expect('sC reads A leads', sC, 'authenticated', format('select count(*) from public.leads where org_id=%L', oA), array['0','err']);
  perform pg_temp.zz_expect('CONTROL sC reads own draft site', sC, 'authenticated', format('select count(*) from public.agent_sites where id=%L', siteC), array['1']);
  perform pg_temp.zz_expect('sC switches own People off (belongs to platform owner)', sC, 'authenticated', format('update public.profiles set people_enabled=false where id=%L', sC), array['err']);
  perform pg_temp.zz_expect('sC switches own site access (belongs to platform owner)', sC, 'authenticated', format('update public.profiles set site_access=%L where id=%L', 'limited', sC), array['err']);
  perform pg_temp.zz_expect('CONTROL sC edits own site', sC, 'authenticated', format('update public.agent_sites set tagline=%L where id=%L', 'mine', siteC), array['rows:1']);

  -- ============ ANONYMOUS VISITOR ============
  perform pg_temp.zz_expect('anon reads draft listings', null, 'anon', format('select count(*) from public.listings where status=%L', 'draft'), array['0','err']);
  perform pg_temp.zz_expect('anon reads draft sites', null, 'anon', format('select count(*) from public.agent_sites where status=%L', 'draft'), array['0','err']);
  perform pg_temp.zz_expect('anon reads leads', null, 'anon', 'select count(*) from public.leads', array['0','err']);
  perform pg_temp.zz_expect('anon reads page views', null, 'anon', 'select count(*) from public.page_views', array['0','err']);
  perform pg_temp.zz_expect('anon reads upcoming listings', null, 'anon', 'select count(*) from public.upcoming_listings', array['0','err']);
  perform pg_temp.zz_expect('anon reads buyer needs', null, 'anon', 'select count(*) from public.buyer_needs', array['0','err']);
  perform pg_temp.zz_expect('anon reads People', null, 'anon', 'select count(*) from public.people', array['0','err']);
  perform pg_temp.zz_expect('anon reads org settings', null, 'anon', 'select count(*) from public.org_settings', array['0','err']);
  perform pg_temp.zz_expect('anon reads platform_admins', null, 'anon', 'select count(*) from public.platform_admins', array['0','err']);
  perform pg_temp.zz_expect('anon reads audit_log', null, 'anon', 'select count(*) from public.audit_log', array['0','err']);
  perform pg_temp.zz_expect('anon reads profile with only a draft site', null, 'anon', format('select count(*) from public.profiles where id=%L', adA), array['0','err']);
  perform pg_temp.zz_expect('anon reads draft brokerage posts', null, 'anon', 'select count(*) from public.brokerage_posts', array['0','err']);
  perform pg_temp.zz_expect('PUBLIC anon reads profile of agent with published site', null, 'anon', format('select count(*) from public.profiles where id=%L', aA), array['1']);
  perform pg_temp.zz_expect('PUBLIC anon reads published sites', null, 'anon', format('select count(*) from public.agent_sites where org_id in (%L,%L)', oA, oB), array['2']);
  perform pg_temp.zz_expect('PUBLIC anon reads published listings', null, 'anon', format('select count(*) from public.listings where org_id in (%L,%L)', oA, oB), array['pos']);
  perform pg_temp.zz_expect('PUBLIC anon reads published brokerage agents of B', null, 'anon', format('select count(*) from public.brokerage_agents where org_id=%L', oB), array['pos']);
  perform pg_temp.zz_expect('PUBLIC anon reads organizations (brand)', null, 'anon', 'select count(*) from public.organizations', array['pos']);
  perform pg_temp.zz_expect('anon inserts lead directly', null, 'anon', format('insert into public.leads (target_type,target_id,name,email) values (%L,%L,%L,%L)', 'agent_site', siteA, 'x', 'x@example.invalid'), array['err']);
  perform pg_temp.zz_expect('anon inserts page view directly', null, 'anon', format('insert into public.page_views (target_type,target_id) values (%L,%L)', 'agent_site', siteA), array['err']);
  perform pg_temp.zz_expect('anon creates organization', null, 'anon', format('insert into public.organizations (slug,name) values (%L,%L)', 'zz-anon-org', 'x'), array['err']);
  perform pg_temp.zz_expect('anon edits a profile', null, 'anon', format('update public.profiles set role=%L where id=%L', 'admin', aA), array['rows:0','err']);

  -- ============ PLATFORM OWNER ============
  perform pg_temp.zz_expect('CONTROL platform reads B leads', plat, 'authenticated', format('select count(*) from public.leads where org_id=%L', oB), array['pos']);
  perform pg_temp.zz_expect('CONTROL platform reads B draft listings', plat, 'authenticated', format('select count(*) from public.listings where org_id=%L and status=%L', oB, 'draft'), array['pos']);
  perform pg_temp.zz_expect('CONTROL platform reads B org settings', plat, 'authenticated', format('select count(*) from public.org_settings where org_id=%L', oB), array['1']);
  perform pg_temp.zz_expect('CONTROL platform reads B upcoming listings', plat, 'authenticated', format('select count(*) from public.upcoming_listings where org_id=%L', oB), array['pos']);
  perform pg_temp.zz_expect('PRIVACY platform reads B agent People records', plat, 'authenticated', format('select count(*) from public.people where owner_id=%L', aB), array['0','err']);
  perform pg_temp.zz_expect('CONTROL platform edits B listing', plat, 'authenticated', format('update public.listings set city=%L where id=%L', 'Support fix', lBp), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL platform switches solo agent People', plat, 'authenticated', format('update public.profiles set people_enabled=false where id=%L', sC), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL platform adds listing for B agent', plat, 'authenticated', format('insert into public.listings (slug,agent_id,address_line1,city,state,zip) values (%L,%L,%L,%L,%L,%L)', 'zz-plat-1', aB, 'x', 'x', 'OK', '1'), array['rows:1']);
  insert into zz_results select (select org_id from public.listings where slug = 'zz-plat-1') = oB, 'trigger stamped platform-created listing with the AGENT''s org B';
  perform pg_temp.zz_expect('CONTROL platform writes audit log', plat, 'authenticated', format('insert into public.audit_log (actor_id,org_id,action) values (%L,%L,%L)', plat, oB, 'test'), array['rows:1']);
  perform pg_temp.zz_expect('CONTROL platform moves an account between organizations', plat, 'authenticated', format('update public.profiles set org_id=%L where id=%L', oC, aB), array['rows:1']);

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'LEAKTEST pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
