-- agent_sites.header_style has a check constraint (classic | floating) that the new header styles (centered, centered_pill, stacked, minimal) violated:
-- saving one failed with "violates check constraint agent_sites_header_style_check". Widen it to the styles Navbar.jsx draws.
alter table public.agent_sites drop constraint if exists agent_sites_header_style_check;
alter table public.agent_sites add constraint agent_sites_header_style_check
  check (header_style in ('classic', 'floating', 'centered', 'centered_pill', 'stacked', 'minimal'));
