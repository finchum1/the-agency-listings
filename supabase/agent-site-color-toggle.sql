-- The light / dark switch on an agent site. When on, the header gets a sun / moon button that lets a visitor swap the site between the agent's own
-- color theme and the Dark theme (src/hooks/useColorMode.js). Off by default, so no site changes by running this.
alter table public.agent_sites add column if not exists color_toggle boolean not null default false;
