-- Compare Templates can now include the header and footer: what an agent picks from a share link is saved with the layout and colors.
alter table public.site_preview_links
  add column if not exists picked_header text,
  add column if not exists picked_footer text;
