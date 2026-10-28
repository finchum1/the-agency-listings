-- A cash deal has no loan, so no appraisal or financing deadline. The flag hides those on the deal's key dates, client timeline, schedule and
-- updates; any dates already entered are kept in case the flag is switched back.
alter table public.people
  add column if not exists is_cash boolean not null default false;
