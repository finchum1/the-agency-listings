-- Plans added from the starter set remember which starter they came from, so renaming one doesn't make the starter look missing.
alter table public.plans add column if not exists starter_key text;
create unique index if not exists plans_starter_key_one on public.plans (owner_id, starter_key) where starter_key is not null;

-- Starter plans already added (matched by their original names) get their key.
update public.plans set starter_key = case name
  when 'Birthday wishes' then 'birthday'
  when 'Home anniversary' then 'housiversary'
  when 'New web lead' then 'new-web-lead'
  when 'Open house follow-up' then 'open-house'
  when 'Slow-burn check-in' then 'check-in'
end
where starter_key is null and name in ('Birthday wishes', 'Home anniversary', 'New web lead', 'Open house follow-up', 'Slow-burn check-in');
