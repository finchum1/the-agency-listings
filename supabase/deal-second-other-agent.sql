-- A second agent on the other side of a deal (a co-listing agent, or a second buyer's agent): name and email, next to "other_agent".
-- Same rules as the other deal contact columns: it is on the deal's own row in people, so who can read or change it is unchanged.
alter table public.people
  add column if not exists other_agent2 text not null default '',
  add column if not exists other_agent2_email text not null default '';
