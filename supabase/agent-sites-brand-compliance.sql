-- Follow-up to agent-sites-more-customization.sql: keeps per-agent site
-- customization on-brand with corporate (theagencyre.com) now that its
-- actual colors/fonts/logo are known.
--
-- 1. logo_variant: which official-color logo (red/white/black — all the
--    same mark, see public/images/brokerage-logo*.png) shows in the
--    agent's Navbar/Footer.
alter table agent_sites add column if not exists logo_variant text not null default 'red';

alter table agent_sites drop constraint if exists agent_sites_logo_variant_check;
alter table agent_sites add constraint agent_sites_logo_variant_check
  check (logo_variant in ('red', 'white', 'black'));

-- 2. accent_color: previously free-form text (any hex). Now restricted to
--    The Agency's own brand red or black — matches the two options the
--    site editor offers. Null/empty still means "use the template's own
--    accent" (see index.css). Clears out anything off-brand that may have
--    been saved already (harmless no-op if nothing was).
update agent_sites set accent_color = null
  where accent_color is not null
    and lower(accent_color) not in ('#ed2127', '#000000');

alter table agent_sites drop constraint if exists agent_sites_accent_color_check;
alter table agent_sites add constraint agent_sites_accent_color_check
  check (accent_color is null or lower(accent_color) in ('#ed2127', '#000000'));
