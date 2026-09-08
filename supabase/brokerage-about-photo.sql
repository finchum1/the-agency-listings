-- Optional photo shown beside the About paragraph (see About.jsx). Null
-- by default -- reproduces the existing centered-text-only layout until
-- an admin uploads one.
alter table brokerage_site
  add column if not exists about_photo_url text;
