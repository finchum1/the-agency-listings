-- Adds the fourth logo option (a distinct square composition — mark
-- stacked above the wordmark, both white, on a solid brand-red tile —
-- not just another recolor of the wide lockup) alongside the existing
-- red/white/black.
alter table agent_sites drop constraint if exists agent_sites_logo_variant_check;
alter table agent_sites add constraint agent_sites_logo_variant_check
  check (logo_variant in ('red', 'white', 'black', 'square'));
