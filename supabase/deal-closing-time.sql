-- A time of day for the closing, next to the closing date (the same way the home inspection has one: inspection_time).
-- Shown on the Deals overview, the deal's dates, the calendar and the client timeline once it is set.
alter table public.people add column if not exists closing_time time;
