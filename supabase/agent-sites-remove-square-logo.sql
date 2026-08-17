-- Reverts the square logo variant — tried, looked wrong at nav/footer
-- size (a heavy, illegible block next to the thin secondary-logo mark),
-- removed. Resets anyone currently on 'square' (there's likely exactly
-- one: the site used to test it) back to the 'red' default, then
-- tightens the check constraint back to just red/white/black so
-- 'square' can't be saved again.
update agent_sites set logo_variant = 'red' where logo_variant = 'square';

alter table agent_sites drop constraint if exists agent_sites_logo_variant_check;
alter table agent_sites add constraint agent_sites_logo_variant_check
  check (logo_variant in ('red', 'white', 'black'));
