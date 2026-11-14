-- The TRR negotiation window on a deal: the day the TRR report was received (from either side) and how many days there are to negotiate it.
-- The standard is 7 days but a contract can differ, so the number is kept per deal. The deadline itself is worked out in the app
-- (received + days, see src/lib/trr.js), not stored.
alter table public.people
  add column if not exists trr_received_date date,
  add column if not exists trr_days integer default 7 check (trr_days is null or (trr_days between 1 and 120));
