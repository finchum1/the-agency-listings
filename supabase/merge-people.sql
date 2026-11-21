-- Merge a repeated lead or pipeline person into the one you keep: notes, drafts, follow-up plans, saved searches and CMAs move over, blanks on the kept
-- person are filled in, the earlier follow-up date wins, and the contact behind them is merged too. The merged person is deleted and a note on the kept one
-- records it. Only your own Leads and Pipeline people (deals are never merged this way).
create or replace function public.merge_people(p_keep uuid, p_remove uuid) returns void
language plpgsql set search_path = public as $$
declare
  k public.people;
  d public.people;
begin
  if p_keep = p_remove then
    raise exception 'Pick two different people.';
  end if;
  select * into k from public.people where id = p_keep and owner_id = auth.uid() and stage_group in ('lead', 'pipeline');
  select * into d from public.people where id = p_remove and owner_id = auth.uid() and stage_group in ('lead', 'pipeline');
  if k.id is null or d.id is null then
    raise exception 'Those people aren''t yours to merge.';
  end if;

  update public.people_notes set person_id = k.id where person_id = d.id;
  update public.people_outreach set person_id = k.id where person_id = d.id;
  update public.client_searches set person_id = k.id where person_id = d.id;
  update public.cmas set person_id = k.id where person_id = d.id;
  -- A plan runs once per person: where both were on the same plan, the kept person's run stands.
  delete from public.plan_enrollments e where e.person_id = d.id and exists (select 1 from public.plan_enrollments x where x.person_id = k.id and x.plan_id = e.plan_id);
  update public.plan_enrollments set person_id = k.id where person_id = d.id;

  if k.contact_id is null then
    update public.people set contact_id = d.contact_id where id = k.id;
  elsif d.contact_id is not null and d.contact_id <> k.contact_id then
    perform public.merge_contacts(k.contact_id, d.contact_id);
  end if;

  update public.people set
    email = coalesce(nullif(k.email, ''), d.email),
    phone = coalesce(nullif(k.phone, ''), d.phone),
    source = coalesce(nullif(k.source, ''), d.source),
    property_address = coalesce(nullif(k.property_address, ''), d.property_address),
    side = coalesce(k.side, d.side),
    price = coalesce(k.price, d.price),
    next_follow_up = least(k.next_follow_up, d.next_follow_up),
    first_response_at = least(k.first_response_at, d.first_response_at),
    lead_id = coalesce(k.lead_id, d.lead_id)
  where id = k.id;

  insert into public.people_notes (person_id, body)
  values (k.id, 'Merged with ' || d.name || coalesce(nullif(' (' || concat_ws(', ', nullif(d.email, ''), nullif(d.phone, '')) || ')', ' ()'), '') || '.');
  delete from public.people where id = d.id;
end;
$$;
revoke all on function public.merge_people(uuid, uuid) from public, anon;
grant execute on function public.merge_people(uuid, uuid) to authenticated;
