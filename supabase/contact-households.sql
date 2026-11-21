-- Households: a couple or family linked as one relationship. Each person stays their own contact (own phone, email, birthday, tags); a household ties them
-- together so the Activity tab shows everyone's history in one scroll and being in touch with one counts for all. Private to the agent, like the rest of
-- Contacts. See src/components/dashboard/people/contacts/ContactPanel.jsx.
create table if not exists public.contact_households (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name text not null default '' check (length(name) <= 80),
  created_at timestamptz not null default now()
);
alter table public.contacts add column if not exists household_id uuid references public.contact_households(id) on delete set null;
create index if not exists contacts_household_idx on public.contacts (household_id) where household_id is not null;
alter table public.contact_households enable row level security;
drop policy if exists contact_households_owner_all on public.contact_households;
create policy contact_households_owner_all on public.contact_households for all
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled));

-- A household with fewer than two people isn't one: dissolve it.
create or replace function public.household_tidy(p_household uuid) returns void
language plpgsql set search_path = public as $$
begin
  if p_household is null then return; end if;
  if (select count(*) from public.contacts where household_id = p_household) < 2 then
    update public.contacts set household_id = null where household_id = p_household;
    delete from public.contact_households where id = p_household and owner_id = auth.uid();
  end if;
end;
$$;
revoke all on function public.household_tidy(uuid) from public, anon;
grant execute on function public.household_tidy(uuid) to authenticated;

-- Put two contacts in one household. If one already has a household the other joins it; if both do, the second household's people move into the first.
-- Otherwise a new household is made, named after the shared last name ("Rivera household") or the two first names ("Sam & Jo"). Returns the household's id.
create or replace function public.link_household(p_a uuid, p_b uuid) returns uuid
language plpgsql set search_path = public as $$
declare
  a public.contacts;
  b public.contacts;
  hid uuid;
  nm text;
begin
  if p_a = p_b then
    raise exception 'Pick two different people.';
  end if;
  select * into a from public.contacts where id = p_a and owner_id = auth.uid();
  select * into b from public.contacts where id = p_b and owner_id = auth.uid();
  if a.id is null or b.id is null then
    raise exception 'Those contacts aren''t yours to link.';
  end if;
  if a.household_id is not null then
    hid := a.household_id;
    if b.household_id is not null and b.household_id <> hid then
      update public.contacts set household_id = hid where household_id = b.household_id;
      delete from public.contact_households where id = b.household_id and owner_id = auth.uid();
    end if;
  elsif b.household_id is not null then
    hid := b.household_id;
  else
    nm := case
      when btrim(a.last_name) <> '' and lower(btrim(a.last_name)) = lower(btrim(b.last_name)) then btrim(a.last_name) || ' household'
      else btrim(concat_ws(' & ', nullif(btrim(coalesce(nullif(a.first_name, ''), a.company)), ''), nullif(btrim(coalesce(nullif(b.first_name, ''), b.company)), '')))
    end;
    insert into public.contact_households (name) values (left(coalesce(nm, ''), 80)) returning id into hid;
  end if;
  update public.contacts set household_id = hid where id in (a.id, b.id);
  return hid;
end;
$$;
revoke all on function public.link_household(uuid, uuid) from public, anon;
grant execute on function public.link_household(uuid, uuid) to authenticated;

-- Take one contact out of their household (and dissolve it if only one person is left).
create or replace function public.leave_household(p_contact uuid) returns void
language plpgsql set search_path = public as $$
declare
  hid uuid;
begin
  select household_id into hid from public.contacts where id = p_contact and owner_id = auth.uid();
  update public.contacts set household_id = null where id = p_contact and owner_id = auth.uid();
  perform public.household_tidy(hid);
end;
$$;
revoke all on function public.leave_household(uuid) from public, anon;
grant execute on function public.leave_household(uuid) to authenticated;

-- Merging two contacts keeps the household (see above).
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

-- Being in touch with one person in a household counts for everyone in it (a call, text, email, meeting or showing logged on one of them).
create or replace function public.contact_note_touch() returns trigger
language plpgsql as $$
begin
  if new.kind in ('call', 'text', 'email', 'meeting', 'showing') then
    update public.contacts set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
    where id = new.contact_id
       or (household_id is not null and household_id = (select household_id from public.contacts where id = new.contact_id));
  end if;
  return new;
end;
$$;

-- The same for a text or answered call that came in from the Mac app.
create or replace function public.contact_message_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.direction <> 'missed' then
    update public.contacts set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
    where id = new.contact_id
       or (household_id is not null and household_id = (select household_id from public.contacts where id = new.contact_id));
  end if;
  return new;
end;
$$;
