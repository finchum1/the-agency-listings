-- Adds a per-listing template picker, the property-site counterpart to
-- agent_sites.theme. Same six template names, same neutral-only variation
-- — listings keep the dashboard's own gold-brown accent (#8a7a5c) across
-- every template, never red (that's the Agent Sites world's brand color,
-- a deliberately separate visual system — see DESIGN.md).
alter table listings add column if not exists theme text not null default 'classic';

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand', 'midnight', 'ivory'));
