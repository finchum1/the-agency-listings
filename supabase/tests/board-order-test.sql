-- BOARD ORDER TEST (self-contained, rolls itself back; result is the error text BOARDORDER pass=N fail=M ...).
-- Checks people-module.sql section 21: move_person saves a column's order and moves the person, rejects bad input and
-- other people's cards, and a stage change made any other way clears the old position.
do $outer$
declare
  oA uuid := gen_random_uuid();
  agA uuid := gen_random_uuid(); agB uuid := gen_random_uuid();
  a1 uuid; a2 uuid; a3 uuid; b1 uuid; c1 uuid; other uuid;
  n int; npass int; nfail int; fails text; r int[];
begin
  create temp table zz_results (ok boolean, name text);
  grant all on zz_results to public; -- the checks below run while acting as a signed-in agent
  insert into public.organizations (id, slug, name) values (oA, 'zz-bo-a', 'A');
  insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data, created_at, updated_at) values
    (agA, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-boa@example.invalid', '{}', now(), now()),
    (agB, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'zz-bob@example.invalid', '{}', now(), now());
  update public.profiles set org_id = oA, people_enabled = true where id in (agA, agB);

  insert into public.people (owner_id, name, stage_group, stage) values (agA, 'A1', 'lead', 'New') returning id into a1;
  insert into public.people (owner_id, name, stage_group, stage) values (agA, 'A2', 'lead', 'New') returning id into a2;
  insert into public.people (owner_id, name, stage_group, stage) values (agA, 'A3', 'lead', 'New') returning id into a3;
  insert into public.people (owner_id, name, stage_group, stage) values (agA, 'B1', 'lead', 'Contacted') returning id into b1;
  insert into public.people (owner_id, name, stage_group, stage) values (agA, 'C1', 'pipeline', 'Active') returning id into c1;
  insert into public.people (owner_id, name, stage_group, stage) values (agB, 'Other', 'lead', 'New') returning id into other;
  select count(*) into n from public.people where owner_id = agA and board_position is not null;
  insert into zz_results values (n = 0, 'nobody has a position until someone orders a column');

  perform set_config('request.jwt.claims', json_build_object('sub', agA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- reorder inside a column: A3 to the top
  perform public.move_person(a3, 'New', array[a3, a1, a2]);
  select array_agg(board_position order by id) into r from (select id, board_position from public.people where id in (a3, a1, a2)) q;
  select count(*) into n from public.people where id = a3 and board_position = 1 and stage = 'New';
  insert into zz_results values (n = 1, 'reordering inside a column puts the card first');
  select count(*) into n from public.people where id = a1 and board_position = 2;
  insert into zz_results values (n = 1, 'the others follow in order (1)');
  select count(*) into n from public.people where id = a2 and board_position = 3;
  insert into zz_results values (n = 1, 'the others follow in order (2)');

  -- move to another column, into the middle
  perform public.move_person(a1, 'Contacted', array[a1, b1]);
  select count(*) into n from public.people where id = a1 and stage = 'Contacted' and board_position = 1;
  insert into zz_results values (n = 1, 'moving to another column changes the stage and sets the position');
  select count(*) into n from public.people where id = b1 and board_position = 2;
  insert into zz_results values (n = 1, 'the target column is renumbered');

  -- bad input
  begin perform public.move_person(a1, 'New', array[a2]); insert into zz_results values (false, 'array without the person is rejected');
  exception when others then insert into zz_results values (true, 'array without the person is rejected'); end;
  begin perform public.move_person(a1, 'New', array[a1, a1]); insert into zz_results values (false, 'duplicates are rejected');
  exception when others then insert into zz_results values (true, 'duplicates are rejected'); end;
  begin perform public.move_person(a1, 'New', array[a1, c1]); insert into zz_results values (false, 'someone from another column is rejected');
  exception when others then insert into zz_results values (true, 'someone from another column is rejected'); end;
  begin perform public.move_person(a1, 'New', array[a1, other]); insert into zz_results values (false, 'another agent''s card is rejected');
  exception when others then insert into zz_results values (true, 'another agent''s card is rejected'); end;
  begin perform public.move_person(a1, '  ', array[a1]); insert into zz_results values (false, 'a blank stage is rejected');
  exception when others then insert into zz_results values (true, 'a blank stage is rejected'); end;
  reset role;

  select count(*) into n from public.people where id = other and board_position is null and stage = 'New';
  insert into zz_results values (n = 1, 'the other agent''s card was not touched');

  -- a stage change made any other way clears the position
  update public.people set stage = 'Nurturing' where id = a1;
  select count(*) into n from public.people where id = a1 and board_position is null;
  insert into zz_results values (n = 1, 'changing stage another way clears the position');
  update public.people set stage_group = 'pipeline', stage = 'Active' where id = a3;
  select count(*) into n from public.people where id = a3 and board_position is null;
  insert into zz_results values (n = 1, 'moving to another board clears the position');
  update public.people set name = 'A2 renamed' where id = a2;
  select count(*) into n from public.people where id = a2 and board_position = 3;
  insert into zz_results values (n = 1, 'other edits keep the position');

  -- anonymous cannot call it
  begin
    set local role anon;
    perform public.move_person(a2, 'New', array[a2]);
    reset role;
    insert into zz_results values (false, 'anonymous can call move_person');
  exception when others then
    reset role;
    insert into zz_results values (true, 'anonymous cannot call move_person');
  end;

  select count(*) filter (where ok), count(*) filter (where not ok),
         coalesce(string_agg(name, E'\n  FAIL: ') filter (where not ok), 'none')
    into npass, nfail, fails from zz_results;
  raise exception 'BOARDORDER pass=% fail=% | failures: %', npass, nfail, fails;
end $outer$;
