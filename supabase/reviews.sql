-- Reviews: after a closing, ask the client for a Google review, keep track of who was asked and who answered, and turn a review into a website testimonial in one click.
-- Nothing is ever sent for the agent: the request is a message waiting for them to text or email. See src/components/dashboard/people/ReviewsPage.jsx.
--   * the agent's own Google review link and wording live on their profile (review_url, review_message)
--   * contact_reviews is the list: to_ask -> asked -> received (or skipped); a received review can be put on their website as a testimonial
--   * when a deal closes (any side, the agent's own client: not a deal they only coordinate, not moved by a coordinator) a to_ask row and a to-do are made, if they have a link

alter table public.profiles add column if not exists review_url text not null default '' check (review_url = '' or (review_url ~* '^https://[^[:space:]]+$' and length(review_url) <= 500));
alter table public.profiles add column if not exists review_message text not null default '' check (length(review_message) <= 1000);

create table if not exists public.contact_reviews (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  person_id uuid references public.people(id) on delete set null,
  status text not null default 'to_ask' check (status in ('to_ask', 'asked', 'received', 'skipped')),
  asked_at timestamptz,
  received_at timestamptz,
  rating smallint check (rating is null or rating between 1 and 5),
  body text not null default '' check (length(body) <= 3000),
  reviewer text not null default '' check (length(reviewer) <= 120),
  source text not null default 'Google' check (length(source) <= 40),
  testimonial_id uuid references public.agent_site_testimonials(id) on delete set null,
  created_at timestamptz not null default now()
);
create unique index if not exists contact_reviews_one_per_deal on public.contact_reviews (person_id) where person_id is not null;
create index if not exists contact_reviews_owner_idx on public.contact_reviews (owner_id, status, created_at desc);
create index if not exists contact_reviews_contact_idx on public.contact_reviews (contact_id);
alter table public.contact_reviews enable row level security;
revoke all on public.contact_reviews from anon;
drop policy if exists contact_reviews_owner_all on public.contact_reviews;
create policy contact_reviews_owner_all on public.contact_reviews for all to authenticated
  using (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled))
  with check (owner_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.people_enabled)
    and exists (select 1 from public.contacts c where c.id = contact_id and c.owner_id = auth.uid()));

-- The name of the agent's "closed" column (the one they picked, else "Closed", else the last).
create or replace function public.people_closed_stage(p_owner uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  st jsonb;
  list jsonb;
  named text;
begin
  select stages into st from public.people_settings where owner_id = p_owner;
  list := coalesce(st -> 'transaction', '["Listings","Pending","Closing Soon","Closed"]'::jsonb);
  named := st ->> 'transaction_closed';
  return case when named is not null and list ? named then named when list ? 'Closed' then 'Closed' else list ->> (jsonb_array_length(list) - 1) end;
end;
$$;
revoke all on function public.people_closed_stage(uuid) from public, anon, authenticated;

create or replace function public.people_closed_review() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  link text;
  who text;
  due date;
  today date := (now() at time zone 'America/Chicago')::date;
begin
  if new.stage_group <> 'transaction' or new.tc_only or new.contact_id is null then
    return new;
  end if;
  if auth.uid() is not null and auth.uid() is distinct from new.owner_id then
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
revoke all on function public.people_closed_review() from public, anon, authenticated;
drop trigger if exists people_closed_review on public.people;
create trigger people_closed_review after insert or update on public.people for each row execute function public.people_closed_review();
