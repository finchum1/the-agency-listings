-- The agent's own wording for two footers: the call to action band ("Thinking of making a move?", the line under it, and the button) and a short
-- blurb in the four-column footer. Empty means the default wording.
alter table public.agent_sites
  add column if not exists footer_cta_heading text not null default '',
  add column if not exists footer_cta_text text not null default '',
  add column if not exists footer_cta_button text not null default '',
  add column if not exists footer_blurb text not null default '';
