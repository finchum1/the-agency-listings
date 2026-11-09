-- More detail on the people and terms of a deal, for the email templates and the contact cards.
--   other_party_name        the other side's client: the seller on a buyer deal, the buyer on a seller deal
--   financing_type          the loan type (Conventional, FHA, VA...) for a deal that isn't cash
--   other_agent_company / other_agent_phone, other_agent2_company / other_agent2_phone   the agent(s) on the other side
--   title_phone, lender_phone   a number for the title contact and for the lender contact
-- All on the deal's own row in people, so who can read or change them is unchanged.
alter table public.people
  add column if not exists other_party_name text not null default '',
  add column if not exists financing_type text not null default '',
  add column if not exists other_agent_company text not null default '',
  add column if not exists other_agent_phone text not null default '',
  add column if not exists other_agent2_company text not null default '',
  add column if not exists other_agent2_phone text not null default '',
  add column if not exists title_phone text not null default '',
  add column if not exists lender_phone text not null default '';
