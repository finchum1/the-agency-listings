-- Title company and escrow officer are two things on a deal.
--   title_company          the company only (no email of its own)
--   escrow_officer / escrow_officer_email   the person at the title company who handles the file (their phone is title_phone)
-- Until now the officer's name and email lived in the title company fields ("Chicago Title - Karla Lopez" with her email). This moves them: where a
-- deal has a title company email, the part after " - " becomes the escrow officer (a name with no dash is all officer, with no company yet), and the
-- email moves with it. A deal with no title email is left alone ("OCA - Edmond" is a company and a place, not a person). The old
-- title_company_email column is kept as it was, just no longer shown or used.
alter table public.people
  add column if not exists escrow_officer text not null default '',
  add column if not exists escrow_officer_email text not null default '';

update public.people set
  escrow_officer = case when position(' - ' in title_company) > 0 then btrim(substr(title_company, position(' - ' in title_company) + 3)) else btrim(title_company) end,
  title_company = case when position(' - ' in title_company) > 0 then btrim(substr(title_company, 1, position(' - ' in title_company) - 1)) else '' end,
  escrow_officer_email = btrim(title_company_email)
where stage_group = 'transaction' and btrim(title_company_email) <> '' and escrow_officer = '' and escrow_officer_email = '';
