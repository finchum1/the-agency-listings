-- The title company's street address on a deal, for the contact card and the email templates ("where to bring the earnest money / sign at closing").
-- On the deal's own row in people, so who can read or change it is unchanged.
alter table public.people add column if not exists title_address text not null default '' check (length(title_address) <= 300);
