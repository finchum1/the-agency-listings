-- Home anniversaries from closed deals. When a buyer-side (or both-sides) deal reaches the Closed column, the client's contact gets that closing date as their
-- home anniversary, and so does everyone in their household (the couple bought the home together). It only moves forward: a contact who already has a later
-- date keeps it. A lead / sphere / "other" contact becomes a past client, since that is what a closed buyer is (and the "Home anniversary" plan runs on
-- clients and past clients). Each change leaves a note on the contact. Seller-only deals don't count: selling a home isn't a home anniversary.
-- Done in the database so it holds wherever the deal is closed: the web app, the Mac app, the AI connection.
--
-- Deals the agent is only coordinating (the client isn't theirs) never do this: a deal can be marked `tc_only`, and nothing happens if somebody other than
-- the deal's agent (a coordinator) is the one moving it. There is no catch-up for deals that already closed: the agent decides which of those are theirs.
alter table public.people add column if not exists tc_only boolean not null default false;

-- Applies one deal. `p_today` false = only use the deal's own closing date. Returns how many contacts changed.
create or replace function public.apply_closed_anniversary(p public.people, p_today boolean default true) returns integer
language plpgsql security definer set search_path = public as $$
declare
  st jsonb;
  list jsonb;
  named text;
  closed text;
  day date;
  hid uuid;
  c record;
  changed integer := 0;
begin
  if p.stage_group <> 'transaction' or p.tc_only or p.contact_id is null or p.side is null or p.side not in ('buyer', 'both') then
    return 0;
  end if;
  select stages into st from public.people_settings where owner_id = p.owner_id;
  list := coalesce(st -> 'transaction', '["Listings","Pending","Closing Soon","Closed"]'::jsonb);
  named := st ->> 'transaction_closed';
  closed := case when named is not null and list ? named then named when list ? 'Closed' then 'Closed' else list ->> (jsonb_array_length(list) - 1) end;
  if p.stage is distinct from closed then
    return 0;
  end if;
  day := coalesce(p.closing_date, case when p_today then (now() at time zone 'America/Chicago')::date end);
  if day is null then
    return 0;
  end if;
  select household_id into hid from public.contacts where id = p.contact_id and owner_id = p.owner_id;
  for c in
    select id, relationship, home_anniversary from public.contacts
    where owner_id = p.owner_id and (id = p.contact_id or (hid is not null and household_id = hid)) and (home_anniversary is null or home_anniversary < day)
  loop
    update public.contacts
       set home_anniversary = day, relationship = case when c.relationship in ('lead', 'sphere', 'other') then 'past_client' else c.relationship end
     where id = c.id;
    insert into public.contact_notes (contact_id, owner_id, kind, body)
    values (c.id, p.owner_id, 'other', 'Home anniversary set to ' || to_char(day, 'Mon FMDD, YYYY') || ' from the closing of ' || coalesce(nullif(btrim(p.property_address), ''), 'a deal') || '.');
    changed := changed + 1;
  end loop;
  return changed;
end;
$$;
revoke all on function public.apply_closed_anniversary(public.people, boolean) from public, anon, authenticated;

create or replace function public.people_closed_anniversary() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.stage_group <> 'transaction' or new.tc_only then
    return new;
  end if;
  -- A coordinator (or anyone but the deal's agent) moving the deal doesn't touch the agent's contacts.
  if auth.uid() is not null and auth.uid() is distinct from new.owner_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage and old.closing_date is not distinct from new.closing_date
     and old.contact_id is not distinct from new.contact_id and old.side is not distinct from new.side and old.tc_only is not distinct from new.tc_only then
    return new;
  end if;
  perform public.apply_closed_anniversary(new, true);
  return new;
end;
$$;
revoke all on function public.people_closed_anniversary() from public, anon, authenticated;
drop trigger if exists people_closed_anniversary on public.people;
create trigger people_closed_anniversary after insert or update on public.people for each row execute function public.people_closed_anniversary();
