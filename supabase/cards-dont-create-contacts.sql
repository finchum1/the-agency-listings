-- New Leads / Pipeline / Deals cards no longer create a person in Contacts. A card links to a contact that already matches (same email, else same phone, else
-- the same first and last name when exactly one contact has it); otherwise it stays on its board with no contact. The agent can still add any card to
-- Contacts from the card's menu ("Add to Contacts"), and Contacts keeps showing the L / P / T badge for people who are on a board.
-- Replaces the people_ensure_contact trigger function from people-module.sql section 41. Nothing existing is changed: current cards and contacts stay as they are.
create or replace function public.people_ensure_contact() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cid uuid;
  nm record;
  digits text;
  n integer;
begin
  if new.contact_id is not null then
    return new;
  end if;
  -- the same email
  if btrim(coalesce(new.email, '')) <> '' then
    select id into cid from public.contacts
     where owner_id = new.owner_id and lower(email) = lower(btrim(new.email)) order by created_at limit 1;
  end if;
  -- the same phone (last ten digits), on the main number or another one
  digits := right(regexp_replace(coalesce(new.phone, ''), '\D', '', 'g'), 10);
  if cid is null and length(digits) = 10 then
    select id into cid from public.contacts
     where owner_id = new.owner_id
       and (right(regexp_replace(phone, '\D', '', 'g'), 10) = digits
            or exists (select 1 from unnest(other_phones) p where right(regexp_replace(p, '\D', '', 'g'), 10) = digits))
     order by created_at limit 1;
  end if;
  -- the same first and last name, only when it is unambiguous
  if cid is null then
    select * into nm from public.split_person_name(new.name);
    if btrim(nm.first_name) <> '' and btrim(nm.last_name) <> '' then
      select count(*), min(id::text)::uuid into n, cid from public.contacts
       where owner_id = new.owner_id and lower(first_name) = lower(btrim(nm.first_name)) and lower(last_name) = lower(btrim(nm.last_name));
      if n <> 1 then
        cid := null;
      end if;
    end if;
  end if;
  new.contact_id := cid; -- null when nobody matches: the card stays on its board and out of Contacts
  return new;
end;
$$;
