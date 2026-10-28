-- A spot for the lender's email on a deal, next to the lender's name.
alter table public.people
  add column if not exists lender_email text not null default '';
