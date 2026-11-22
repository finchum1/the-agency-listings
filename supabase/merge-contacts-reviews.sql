-- Merging two contacts keeps their review requests (they used to be deleted along with the removed contact). Same function as before plus one line.
create or replace function public.merge_contacts(p_keep uuid, p_remove uuid) returns void
language plpgsql set search_path = public as $$
declare
  k public.contacts;
  d public.contacts;
begin
  if p_keep = p_remove then
    raise exception 'Pick two different contacts.';
  end if;
  select * into k from public.contacts where id = p_keep and owner_id = auth.uid();
  select * into d from public.contacts where id = p_remove and owner_id = auth.uid();
  if k.id is null or d.id is null then
    raise exception 'Those contacts aren''t yours to merge.';
  end if;
  update public.contact_notes set contact_id = k.id where contact_id = d.id;
  -- Review requests go with them (without this the removed contact's request would be deleted with it).
  update public.contact_reviews set contact_id = k.id where contact_id = d.id;
  insert into public.contact_tag_links (contact_id, tag_id) select k.id, tag_id from public.contact_tag_links where contact_id = d.id on conflict do nothing;
  update public.agent_tasks set contact_id = k.id where contact_id = d.id;
  update public.people set contact_id = k.id where contact_id = d.id;
  update public.contacts set
    company = case when k.company = '' then d.company else k.company end,
    email = case when k.email = '' then d.email else k.email end,
    phone = case when k.phone = '' then d.phone else k.phone end,
    other_emails = (select coalesce(array_agg(distinct x), '{}') from unnest(k.other_emails || d.other_emails || case when k.email <> '' and d.email <> '' and lower(k.email) <> lower(d.email) then array[d.email] else '{}'::text[] end) x where x <> '' and lower(x) <> lower(case when k.email = '' then d.email else k.email end)),
    other_phones = (select coalesce(array_agg(distinct x), '{}') from unnest(k.other_phones || d.other_phones || case when k.phone <> '' and d.phone <> '' and k.phone <> d.phone then array[d.phone] else '{}'::text[] end) x where x <> '' and x <> case when k.phone = '' then d.phone else k.phone end),
    address_line1 = case when k.address_line1 = '' then d.address_line1 else k.address_line1 end,
    city = case when k.address_line1 = '' and k.city = '' then d.city else k.city end,
    state = case when k.address_line1 = '' and k.state = '' then d.state else k.state end,
    zip = case when k.address_line1 = '' and k.zip = '' then d.zip else k.zip end,
    birthday = coalesce(k.birthday, d.birthday),
    home_anniversary = coalesce(k.home_anniversary, d.home_anniversary),
    source = case when k.source = '' then d.source else k.source end,
    about = case when k.about = '' then d.about when d.about = '' then k.about else k.about || E'\n\n' || d.about end,
    touch_every_days = coalesce(k.touch_every_days, d.touch_every_days),
    last_contacted_at = greatest(k.last_contacted_at, d.last_contacted_at),
    do_not_contact = k.do_not_contact or d.do_not_contact
  where id = k.id;
  -- Their household comes along when the kept contact has none; a household left with one person is dissolved.
  if k.household_id is null and d.household_id is not null then
    update public.contacts set household_id = d.household_id where id = k.id;
  end if;
  delete from public.contacts where id = d.id;
  perform public.household_tidy(d.household_id);
end;
$$;
revoke all on function public.merge_contacts(uuid, uuid) from public, anon;
grant execute on function public.merge_contacts(uuid, uuid) to authenticated;
