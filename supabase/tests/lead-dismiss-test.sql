-- LEAD DISMISS TEST (self-contained, rolls itself back; result is the error text LEADDISMISS pass=N fail=M ...).
-- Checks people-module.sql section 19: deleting a person dismisses the inquiry that created them, an agent can dismiss
-- only their own inquiries, and dismissing never deletes the inquiry record.
do $outer$
declare
  oA uuid := gen_random_uuid();
  agA uuid := gen_random_uuid(); agB uuid := gen_random_uuid();
  lead1 uuid; lead2 uuid; lead3 uuid; pid uuid;
  n int; npass int; nfail int; fails text;
begin
  create temp table zz_results (ok boolean, name text);
  insert into public.organizations (id, slug, name) values (oA, 'zz-ld-a', 'A');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-lda@example.invalid', '{}', now(), now()),
    (agB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ldb@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, people_enabled = true where id in (agA, agB);

  -- the lead trigger creates a person for each inquiry (agent has People on)
  insert into public.leads (target_type, target_id, agent_id, name, email) values ('agent_site', gen_random_uuid(), agA, 'Lead One', 'one@example.invalid') returning id into lead1;
  insert into public.leads (target_type, target_id, agent_id, name, email) values ('agent_site', gen_random_uuid(), agA, 'Lead Two', 'two@example.invalid') returning id into lead2;
  insert into public.leads (target_type, target_id, agent_id, name, email) values ('agent_site', gen_random_uuid(), agB, 'Lead Three', 'three@example.invalid') returning id into lead3;
  select id into pid from public.people where lead_id = lead1;
  insert into zz_results values (pid is not null, 'inquiry created a person');

  delete from public.people where id = pid;
  select count(*) into n from public.leads where id = lead1 and dismissed_at is not null;
  insert into zz_results values (n = 1, 'deleting the person dismisses the inquiry');
  select count(*) into n from public.leads where id = lead1;
  insert into zz_results values (n = 1, 'the inquiry record itself is kept');
  select count(*) into n from public.leads where id = lead2 and dismissed_at is null;
  insert into zz_results values (n = 1, 'other inquiries are untouched');

  -- dismiss by hand, as the agent
  perform set_config('request.jwt.claims', json_build_object('sub', agA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.dismiss_lead_alert(lead2);
  perform public.dismiss_lead_alert(lead3); -- someone else's: must do nothing
  reset role;
  select count(*) into n from public.leads where id = lead2 and dismissed_at is not null;
  insert into zz_results values (n = 1, 'an agent dismisses their own inquiry');
  select count(*) into n from public.leads where id = lead3 and dismissed_at is null;
  insert into zz_results values (n = 1, 'an agent cannot dismiss someone else''s inquiry');

  -- anonymous cannot call it at all
  begin
    set local role anon;
    perform public.dismiss_lead_alert(lead3);
    reset role;
    insert into zz_results values (false, 'anonymous can call dismiss');
  exception when others then
    reset role;
    insert into zz_results values (true, 'anonymous cannot call dismiss');
  end;

  -- an agent cannot update leads directly
  perform set_config('request.jwt.claims', json_build_object('sub', agB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    update public.leads set dismissed_at = null where id = lead1;
    get diagnostics n = row_count;
    reset role;
    insert into zz_results values (n = 0, 'no direct update of leads by an agent (rows ' || n || ')');
  exception when others then
    reset role;
    insert into zz_results values (true, 'no direct update of leads by an agent (error)');
  end;

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'LEADDISMISS pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
