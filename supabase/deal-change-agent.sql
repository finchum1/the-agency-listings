-- Hand a deal to a different agent in the same office.
--
-- A deal belongs to one agent (people.owner_id): it sits on their Deals board and its checklist, documents and notes are theirs. Sometimes a
-- deal is started under the wrong person (a coordinator or an AI started it as themselves), or the agent changes. deal_change_agent() moves it:
--   * who can: the deal's agent, or a coordinator on the deal (they stay on it as the coordinator).
--   * to whom: another agent in the same office who uses Deals.
--   * what moves: the deal, its tasks, documents, notes and any waiting message drafts. The deal keeps its column if the new agent has one with
--     that name, otherwise it lands in their first column. It is no longer tied to the old agent's private contact card.
--   * what doesn't: nobody is emailed; coordinators picked for the deal stay; automatic follow-up plans for the deal are stopped.
-- A coordinator still can't reassign a deal any other way (people_deal_guard), so the guard is told when this function is the one doing it.

create or replace function public.people_deal_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare acc text;
begin
  if auth.uid() is null then return new; end if;
  if (new.compliance_status, new.compliance_updated_at, new.compliance_by) is distinct from (old.compliance_status, old.compliance_updated_at, old.compliance_by)
     and coalesce(current_setting('app.deal_rpc', true), '') <> '1' then
    raise exception 'Use Submit for review (or the compliance actions) to change a deal''s review status.';
  end if;
  acc := public.deal_access(old.owner_id, old.id);
  if acc = 'tc' and (new.owner_id is distinct from old.owner_id or new.stage_group is distinct from old.stage_group
                     or new.contact_id is distinct from old.contact_id or new.lead_id is distinct from old.lead_id)
     and coalesce(current_setting('app.deal_agent_change', true), '') <> '1' then
    raise exception 'A transaction coordinator can edit a deal but not move it or reassign it.';
  end if;
  return new;
end;
$$;

create or replace function public.deal_change_agent(p_person uuid, p_agent uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me record;
  d record;
  old_owner record;
  target record;
  v_stages jsonb;
  v_names text[];
  v_stage text;
begin
  select id, full_name into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'Sign in first.'; end if;

  select id, owner_id, stage, stage_group into d from public.people where id = p_person;
  if d.id is null or d.stage_group is distinct from 'transaction' then raise exception 'That isn''t a deal.'; end if;
  if coalesce(public.deal_access(d.owner_id, d.id), '') not in ('owner', 'tc') then
    raise exception 'Only the deal''s agent or its coordinator can change the agent.';
  end if;

  select id, full_name, org_id into old_owner from public.profiles where id = d.owner_id;
  select id, full_name, org_id, people_enabled into target from public.profiles where id = p_agent;
  if target.id is null or target.org_id is null or target.org_id is distinct from old_owner.org_id or not coalesce(target.people_enabled, false) then
    raise exception 'Pick an agent in your office who uses Deals.';
  end if;
  if target.id = d.owner_id then raise exception '% already has this deal.', coalesce(target.full_name, 'That agent'); end if;

  -- Keep the column when the new agent has one by that name; otherwise their first.
  select stages -> 'transaction' into v_stages from public.people_settings where owner_id = p_agent;
  if v_stages is null or jsonb_typeof(v_stages) <> 'array' or jsonb_array_length(v_stages) = 0 then
    v_names := array['Pending', 'Closing Soon', 'Closed'];
  else
    v_names := array(select jsonb_array_elements_text(v_stages));
  end if;
  v_stage := case when d.stage = any (v_names) then d.stage else v_names[1] end;

  perform set_config('app.deal_agent_change', '1', true);
  update public.people set owner_id = p_agent, stage = v_stage, contact_id = null, board_position = null where id = p_person;
  update public.transaction_tasks set owner_id = p_agent where person_id = p_person;
  update public.transaction_documents set owner_id = p_agent where person_id = p_person;
  update public.people_notes set owner_id = p_agent where person_id = p_person;
  update public.people_outreach set owner_id = p_agent where person_id = p_person;
  update public.plan_enrollments set status = 'stopped', stop_reason = 'The deal moved to another agent.', updated_at = now()
   where person_id = p_person and status in ('active', 'paused');

  insert into public.deal_messages (person_id, author_id, kind, body)
  values (p_person, me.id, 'message', coalesce(me.full_name, 'Someone') || ' moved this deal from ' || coalesce(old_owner.full_name, 'the previous agent') || ' to ' || coalesce(target.full_name, 'a new agent') || '.');

  return jsonb_build_object('id', p_person, 'from', old_owner.full_name, 'to', target.full_name, 'agent_id', target.id, 'stage', v_stage, 'column_changed', v_stage is distinct from d.stage);
end;
$$;
revoke all on function public.deal_change_agent(uuid, uuid) from public, anon;
grant execute on function public.deal_change_agent(uuid, uuid) to authenticated;
