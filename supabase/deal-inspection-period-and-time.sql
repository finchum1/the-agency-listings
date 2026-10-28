-- Two more inspection dates on a deal: when the inspection period ends (the timeframe the buyer has to get inspections done, which starts at
-- the contract date), and the time of day of the actual home inspection (the inspection date itself is the existing inspection_date).
alter table public.people
  add column if not exists inspection_period_end date,
  add column if not exists inspection_time time;
