-- Adds a per-listing template picker, the property-site counterpart to
-- agent_sites.theme. Same six template names, same neutral-only variation
-- — listings keep the dashboard's own brand-red accent (#ed2127) across
-- every template (corrected from an off-brand gold-brown shortly after
-- this shipped — see DESIGN.md's Colors section).
alter table listings add column if not exists theme text not null default 'classic';

alter table listings drop constraint if exists listings_theme_check;
alter table listings add constraint listings_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand', 'midnight', 'ivory'));
