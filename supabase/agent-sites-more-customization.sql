-- Run once in the Supabase SQL Editor — additive follow-up to
-- agent-sites-theming-and-domain.sql.
--
-- Three additions to per-agent-site customization:
--   1. accent_color — an optional hex override for --as-accent (see
--      src/index.css), independent of the template. Templates still ship
--      a sensible default accent; this just lets an agent override it
--      with any color instead of only the ~6 baked into the templates.
--   2. theme / font_pairing check constraints widened from 3 options each
--      to 6 (see src/index.css and SiteForm.jsx's THEMES/FONT_PAIRINGS).
--   3. home_sections — which of the optional sections appear on the site's
--      home page, and in what order (see components/agent-site/HomeSections.jsx).
--      Hero and Contact are not in this list — Hero always leads, Contact
--      always closes, neither is optional. Default is every section, in
--      the original order, matching current behavior exactly for every
--      site that hasn't touched this yet.

alter table agent_sites add column if not exists accent_color text;

alter table agent_sites drop constraint if exists agent_sites_theme_check;
alter table agent_sites add constraint agent_sites_theme_check
  check (theme in ('classic', 'light', 'dark', 'sand', 'midnight', 'ivory'));

alter table agent_sites drop constraint if exists agent_sites_font_pairing_check;
alter table agent_sites add constraint agent_sites_font_pairing_check
  check (font_pairing in (
    'playfair-jost', 'fraunces-inter', 'cormorant-worksans',
    'libre-karla', 'bodoni-manrope', 'dmserif-dmsans'
  ));

alter table agent_sites add column if not exists home_sections text[] not null
  default '{bio,testimonials,listings,areas,blog}';
