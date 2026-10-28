-- Three more home page layouts for the agent sites, the heroes of the starter templates (see src/lib/siteTemplates.js):
--   luxury  a photo hero with a centered headline and three outlined action buttons
--   warm    a photo hero with a centered headline (one word in color) and two pill buttons
--   guide   a light, photo-free hero with a "your guide to buying / selling" pair of buttons, leading into the buyer and seller cards
alter table public.agent_sites drop constraint if exists agent_sites_layout_check;
alter table public.agent_sites add constraint agent_sites_layout_check
  check (layout in ('classic', 'editorial', 'bold', 'portrait', 'listings', 'luxury', 'warm', 'guide'));
