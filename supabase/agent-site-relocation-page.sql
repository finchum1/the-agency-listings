-- The optional Relocation ("Moving to Oklahoma") page on an agent site (src/components/agent-site/landing/RelocationPage.jsx). Its form posts to
-- api/agent-site-contact.js with page = 'relocation', so a lead can now carry that page, and the person made from it is tagged
-- "Website: Relocation page". Whether a site shows the page is agent_sites.landing.relocation.on (off until the agent turns it on), so nothing
-- changes for any existing site by running this.
alter table public.leads drop constraint if exists leads_page_check;
alter table public.leads add constraint leads_page_check check (page in ('sellers', 'buyers', 'home_value', 'relocation'));

-- create_person_from_lead: the same function as before, with a Relocation arm in the two source/label lookups.
create or replace function public.create_person_from_lead()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  new_person_id uuid;
  existing_id uuid;
  v_source text;
  v_label text;
  v_contact uuid;
  v_comps boolean := true;
begin
  if new.agent_id is null then
    return new;
  end if;
  if not exists (select 1 from public.profiles p where p.id = new.agent_id and p.people_enabled) then
    return new;
  end if;

  v_source := case new.page
    when 'sellers' then 'Website: Sellers page'
    when 'buyers' then 'Website: Buyers page'
    when 'home_value' then 'Website: Home value'
    when 'relocation' then 'Website: Relocation page'
    else 'Website inquiry'
  end;
  v_label := case new.page
    when 'sellers' then 'Sellers page request'
    when 'buyers' then 'Buyers page wish list'
    when 'home_value' then 'Home value request'
    when 'relocation' then 'Relocation inquiry'
    else 'Website inquiry'
  end;

  if coalesce(new.email, '') <> '' then
    select pe.id into existing_id
    from public.people pe
    where pe.owner_id = new.agent_id and lower(pe.email) = lower(new.email)
    order by pe.archived, pe.created_at
    limit 1;
  end if;

  if existing_id is not null then
    update public.people
    set next_follow_up = current_date,
        phone = case when phone = '' then coalesce(new.phone, '') else phone end,
        archived = false,
        archived_reason = '',
        archived_at = null
    where id = existing_id;

    insert into public.people_notes (person_id, owner_id, body)
    values (existing_id, new.agent_id,
            case when coalesce(new.message, '') <> ''
                 then v_label || ' (repeat): ' || new.message
                 else v_label || ' (repeat), no message' end);
    new_person_id := existing_id;
  else
    insert into public.people (owner_id, name, email, phone, stage_group, stage, source, next_follow_up, lead_id)
    values (new.agent_id, new.name, coalesce(new.email, ''), coalesce(new.phone, ''), 'lead', 'New',
            v_source, current_date, new.id)
    returning id into new_person_id;

    if coalesce(new.message, '') <> '' then
      insert into public.people_notes (person_id, owner_id, body)
      values (new_person_id, new.agent_id, v_label || ': ' || new.message);
    end if;
  end if;

  if new.page = 'home_value' then
    if new.target_type = 'agent_site' then
      select coalesce((s.landing ->> 'comps_task')::boolean, true) into v_comps from public.agent_sites s where s.id = new.target_id;
    end if;
    if coalesce(v_comps, true) then
      select pe.contact_id into v_contact from public.people pe where pe.id = new_person_id;
      insert into public.agent_tasks (owner_id, title, due_date, contact_id)
      values (new.agent_id, 'Pull comps for ' || coalesce(nullif(btrim(new.address), ''), new.name), current_date + 1, v_contact);
    end if;
  end if;
  return new;
end;
$function$;
