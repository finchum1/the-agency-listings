-- =====================================================================
-- Brokerage Site — theming/customization, mirroring agent_sites' own
-- theme/font_pairing/accent_color/logo_variant/home_sections columns
-- (agent-sites-schema.sql + agent-sites-more-customization.sql +
-- agent-sites-theming-and-domain.sql) so the brokerage site can be
-- customized the same way an agent's own site is. Defaults reproduce
-- the fixed look this module shipped with (dark theme, The Agency's own
-- font pairing, white logo, About->Agents->Blog on Home) exactly, so
-- this is a zero-visual-change migration for the already-in-progress
-- draft site. Applied via the Supabase MCP.
-- =====================================================================

alter table brokerage_site
  add column if not exists theme text not null default 'dark',
  add column if not exists font_pairing text not null default 'playfair-jost',
  add column if not exists accent_color text,
  add column if not exists logo_variant text not null default 'white',
  add column if not exists home_sections text[] not null default '{about,agents,blog}';

alter table brokerage_site drop constraint if exists brokerage_site_theme_check;
alter table brokerage_site add constraint brokerage_site_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand', 'midnight', 'ivory'));

alter table brokerage_site drop constraint if exists brokerage_site_font_pairing_check;
alter table brokerage_site add constraint brokerage_site_font_pairing_check
  check (font_pairing in ('playfair-jost', 'fraunces-inter', 'cormorant-worksans', 'libre-karla', 'bodoni-manrope', 'dmserif-dmsans'));

alter table brokerage_site drop constraint if exists brokerage_site_accent_color_check;
alter table brokerage_site add constraint brokerage_site_accent_color_check
  check (accent_color is null or accent_color in ('#ed2127', '#000000'));

alter table brokerage_site drop constraint if exists brokerage_site_logo_variant_check;
alter table brokerage_site add constraint brokerage_site_logo_variant_check
  check (logo_variant in ('red', 'white', 'black'));
