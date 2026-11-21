-- Who moved a deal, when the change comes through the Mac app. The Mac app's server writes with the service key, so the database can't tell from the login
-- who is acting; the Mac API stamps `touched_by` with the person using the app on every deal change. The closing triggers (home anniversary, review request)
-- use it: a coordinator moving someone else's deal never touches the agent's contacts, from the app or the Mac. Web changes still go by the login.
alter table public.people add column if not exists touched_by uuid references public.profiles(id) on delete set null;

create or replace function public.people_closed_anniversary() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.touched_by);
begin
  if new.stage_group <> 'transaction' or new.tc_only then
    return new;
  end if;
  if actor is not null and actor is distinct from new.owner_id then
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

create or replace function public.people_closed_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  actor uuid := coalesce(auth.uid(), new.touched_by);
  link text;
  who text;
  due date;
  today date := (now() at time zone 'America/Chicago')::date;
begin
  if new.stage_group <> 'transaction' or new.tc_only or new.contact_id is null then
    return new;
  end if;
  if actor is not null and actor is distinct from new.owner_id then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.stage is not distinct from new.stage and old.tc_only is not distinct from new.tc_only then
    return new;
  end if;
  if new.stage is distinct from public.people_closed_stage(new.owner_id) then
    return new;
  end if;
  select review_url into link from public.profiles where id = new.owner_id;
  if coalesce(link, '') = '' or exists (select 1 from public.contact_reviews where person_id = new.id) then
    return new;
  end if;
  insert into public.contact_reviews (owner_id, contact_id, person_id) values (new.owner_id, new.contact_id, new.id);
  select coalesce(nullif(btrim(first_name), ''), nullif(btrim(company), ''), 'your client') into who from public.contacts where id = new.contact_id;
  due := greatest(coalesce(new.closing_date, today) + 3, today);
  insert into public.agent_tasks (owner_id, title, due_date, contact_id) values (new.owner_id, 'Ask ' || coalesce(who, 'your client') || ' for a review', due, new.contact_id);
  return new;
end;
$$;
