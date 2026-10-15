-- AGENT TASKS TEST (self-contained, rolls itself back; result is the error text AGENTTASKS pass=N fail=M ...).
-- Checks the private to-do table behind the dashboard home page (people-module.sql section 16): an agent can manage
-- only their own tasks; nobody else (same-organization admin, other organization, platform owner, anonymous) can read
-- or change them; bad values are rejected.
do $outer$
declare
  oA uuid := gen_random_uuid(); oB uuid := gen_random_uuid();
  agA uuid := gen_random_uuid(); adA uuid := gen_random_uuid(); agB uuid := gen_random_uuid();
  plat uuid := (select user_id from public.platform_admins limit 1);
  tA uuid := gen_random_uuid();
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

  insert into public.organizations (id, slug, name) values (oA, 'zz-at-a', 'A'), (oB, 'zz-at-b', 'B');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-ata@example.invalid', '{}', now(), now()),
    (adA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-atd@example.invalid', '{}', now(), now()),
    (agB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-atb@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA where id = agA;
  update public.profiles set org_id = oA, role = 'admin' where id = adA;
  update public.profiles set org_id = oB where id = agB;

  perform pg_temp.zz_expect('owner adds a task', agA, 'authenticated', format('insert into public.agent_tasks (id, title, due_date) values (%L, %L, current_date)', tA, 'Call the title company'), array['rows:1']);
  perform pg_temp.zz_expect('owner adds a recurring task', agA, 'authenticated', format('insert into public.agent_tasks (title, due_date, recurrence, series_start) values (%L, current_date, %L, current_date)', 'Weekly market report', 'weekly'), array['rows:1']);
  perform pg_temp.zz_expect('owner adds a task with no date', agA, 'authenticated', format('insert into public.agent_tasks (title) values (%L)', 'Someday'), array['rows:1']);
  perform pg_temp.zz_expect('owner reads own tasks', agA, 'authenticated', 'select count(*) from public.agent_tasks', array['3']);
  perform pg_temp.zz_expect('owner completes a task', agA, 'authenticated', format('update public.agent_tasks set done = true, done_at = now() where id = %L', tA), array['rows:1']);
  perform pg_temp.zz_expect('owner deletes a task', agA, 'authenticated', format('delete from public.agent_tasks where title = %L', 'Someday'), array['rows:1']);

  perform pg_temp.zz_expect('recurring task without a date refused', agA, 'authenticated', format('insert into public.agent_tasks (title, recurrence) values (%L, %L)', 'x', 'daily'), array['err']);
  perform pg_temp.zz_expect('unknown repeat refused', agA, 'authenticated', format('insert into public.agent_tasks (title, due_date, recurrence) values (%L, current_date, %L)', 'x', 'hourly'), array['err']);
  perform pg_temp.zz_expect('empty title refused', agA, 'authenticated', format('insert into public.agent_tasks (title) values (%L)', '   '), array['err']);
  perform pg_temp.zz_expect('over-long title refused', agA, 'authenticated', format('insert into public.agent_tasks (title) values (%L)', repeat('x', 301)), array['err']);
  perform pg_temp.zz_expect('owner creates a task for someone else', agA, 'authenticated', format('insert into public.agent_tasks (owner_id, title) values (%L, %L)', agB, 'planted'), array['err']);
  perform pg_temp.zz_expect('owner hands own task to someone else', agA, 'authenticated', format('update public.agent_tasks set owner_id = %L where id = %L', agB, tA), array['err', 'rows:0']);

  perform pg_temp.zz_expect('PRIVACY same-organization admin reads tasks', adA, 'authenticated', format('select count(*) from public.agent_tasks where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY same-organization admin edits a task', adA, 'authenticated', format('update public.agent_tasks set title = %L where id = %L', 'HACK', tA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY same-organization admin deletes a task', adA, 'authenticated', format('delete from public.agent_tasks where id = %L', tA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY other organization reads tasks', agB, 'authenticated', format('select count(*) from public.agent_tasks where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY other organization edits a task', agB, 'authenticated', format('update public.agent_tasks set title = %L where id = %L', 'HACK', tA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY platform owner reads tasks', plat, 'authenticated', format('select count(*) from public.agent_tasks where owner_id = %L', agA), array['0']);
  perform pg_temp.zz_expect('PRIVACY platform owner edits a task', plat, 'authenticated', format('update public.agent_tasks set title = %L where id = %L', 'HACK', tA), array['rows:0', 'err']);
  perform pg_temp.zz_expect('PRIVACY anonymous reads tasks', null, 'anon', 'select count(*) from public.agent_tasks', array['0', 'err']);
  perform pg_temp.zz_expect('PRIVACY anonymous inserts a task', null, 'anon', format('insert into public.agent_tasks (owner_id, title) values (%L, %L)', agA, 'x'), array['err']);
  perform pg_temp.zz_expect('CONTROL other agent sees only their own (none yet)', agB, 'authenticated', 'select count(*) from public.agent_tasks', array['0']);

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'AGENTTASKS pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
