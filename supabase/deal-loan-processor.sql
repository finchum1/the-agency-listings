-- A loan processor on a deal: name and email, beside the lender. On the deal's own row in people, so who may read or change them is unchanged.
alter table public.people
  add column if not exists loan_processor_name text not null default '',
  add column if not exists loan_processor_email text not null default '';
