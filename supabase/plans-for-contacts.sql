-- =====================================================================
-- Plans on contacts. A plan can now be started for a contact that has no Leads / Pipeline card (a past client, someone in your sphere). Such an
-- enrollment has contact_id and no person_id; its steps become to-dos on the contact (a drafted message rides inside the to-do) and it can't move
-- anyone between columns. A contact that does have a card is put on the plan through the card, as before.
-- It stops by itself when the contact is archived or marked do not contact.
-- =====================================================================

alter table public.plan_enrollments alter column person_id drop not null;
alter table public.plan_enrollments add column if not exists contact_id uuid references public.contacts(id) on delete cascade;
alter table public.plan_enrollments drop constraint if exists plan_enrollments_who;
alter table public.plan_enrollments add constraint plan_enrollments_who check ((person_id is null) <> (contact_id is null));
create unique index if not exists plan_enrollments_contact_one on public.plan_enrollments (plan_id, contact_id) where contact_id is not null;
create index if not exists plan_enrollments_contact_idx on public.plan_enrollments (contact_id) where contact_id is not null;

create or replace function public.plan_enrollment_check() returns trigger
language plpgsql security definer set search_path = public as
$$
begin
  if new.person_id is not null then
    if not exists (select 1 from public.people pe join public.plans pl on pl.id = new.plan_id where pe.id = new.person_id and pe.owner_id = new.owner_id and pl.owner_id = new.owner_id) then
      raise exception 'That person or plan isn''t yours.';
    end if;
  else
    if not exists (select 1 from public.contacts c join public.plans pl on pl.id = new.plan_id where c.id = new.contact_id and c.owner_id = new.owner_id and pl.owner_id = new.owner_id) then
      raise exception 'That contact or plan isn''t yours.';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- A contact who is archived or marked do not contact comes off their plans (their card's too).
create or replace function public.plan_stop_on_contact_change() returns trigger
language plpgsql security definer set search_path = public as
$$
declare
  why text := case when new.archived and not old.archived then 'Archived' else 'Marked do not contact' end;
begin
  update public.plan_enrollments set status = 'stopped', stop_reason = why
   where status in ('active', 'paused')
     and (contact_id = new.id or person_id in (select id from public.people where contact_id = new.id));
  return new;
end;
$$;
drop trigger if exists plan_stop_contact on public.contacts;
create trigger plan_stop_contact after update of archived, do_not_contact on public.contacts for each row
  when ((new.archived and not old.archived) or (new.do_not_contact and not old.do_not_contact)) execute function public.plan_stop_on_contact_change();
