-- =====================================================================
-- Deal details: more people to reach, and earnest money.
--
-- A second client (name and email), email addresses for the other agent and the title company, the other agent's transaction coordinator
-- and the title processor (name and email each), and the earnest money: how much, and whether it has been delivered to the title company
-- (with when it was ticked). All on the deal's own row in people, so who may read or change them is unchanged (the owner, the deal's
-- coordinator, and compliance can read).
-- =====================================================================
alter table public.people
  add column if not exists client2_name text not null default '',
  add column if not exists client2_email text not null default '',
  add column if not exists other_agent_email text not null default '',
  add column if not exists other_agent_tc_name text not null default '',
  add column if not exists other_agent_tc_email text not null default '',
  add column if not exists title_company_email text not null default '',
  add column if not exists title_processor_name text not null default '',
  add column if not exists title_processor_email text not null default '',
  add column if not exists earnest_money numeric check (earnest_money is null or earnest_money >= 0),
  add column if not exists earnest_money_delivered boolean not null default false,
  add column if not exists earnest_money_delivered_at timestamptz;
