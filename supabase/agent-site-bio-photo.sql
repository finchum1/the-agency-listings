-- A photo just for the About / bio section of an agent's website. When it is empty the section keeps using the agent's profile photo,
-- so nothing changes for existing sites. (The profile photo is still what the contact area, team and menus use.)
alter table public.agent_sites
  add column if not exists bio_photo_url text;
