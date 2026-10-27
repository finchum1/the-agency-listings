-- =====================================================================
-- Agent sites: the Sellers, Home Value and Buyers pages and the three cards on the home page.
--
-- agent_sites.landing (jsonb): the agent's settings for them. Anything missing falls back to the defaults in src/lib/landingPages.js.
--   { "order": ["sellers","value","buyers"], "menu": true, "comps_task": true,
--     "sellers": { "on": true, "title": "", "blurb": "", "photo_url": "" }, "value": {...}, "buyers": {...} }
-- leads.page ('sellers' | 'buyers' | 'home_value') says which page a lead came from; leads.address is the property a Home Value or
--   seller request is about. The People trigger tags the new lead's source by page ("Website: Sellers page") and, for a home value
--   request, adds a "Pull comps for <address>" task for tomorrow (unless the agent turned that off in landing.comps_task).
-- home_sections: the new "cards" section goes in the default, and into every existing site right after Testimonials (else About).
-- =====================================================================
alter table public.agent_sites add column if not exists landing jsonb not null default '{}'::jsonb;
alter table public.leads add column if not exists page text check (page in ('sellers', 'buyers', 'home_value'));
alter table public.leads add column if not exists address text not null default '';

alter table public.agent_sites alter column home_sections set default '{bio,testimonials,cards,listings,areas,blog}';

update public.agent_sites s
set home_sections = case
  when 'testimonials' = any (s.home_sections) then
    s.home_sections[1:array_position(s.home_sections, 'testimonials')] || array['cards'] || s.home_sections[array_position(s.home_sections, 'testimonials') + 1:]
  when 'bio' = any (s.home_sections) then
    s.home_sections[1:array_position(s.home_sections, 'bio')] || array['cards'] || s.home_sections[array_position(s.home_sections, 'bio') + 1:]
  else array['cards'] || s.home_sections
end
where cardinality(s.home_sections) > 0 and not ('cards' = any (s.home_sections));

create or replace function public.create_person_from_lead()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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
    else 'Website inquiry'
  end;
  v_label := case new.page
    when 'sellers' then 'Sellers page request'
    when 'buyers' then 'Buyers page wish list'
    when 'home_value' then 'Home value request'
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

  -- A home value request: a task to pull the comparables, due tomorrow, on that person (unless the agent turned it off).
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
$$;
