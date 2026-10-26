-- Where a property site's video plays: 'hero' (the top of the page, as before), 'gallery' (a player right above the photo
-- gallery) or 'both'. The video itself is still listings.hero_video_url. Existing listings keep 'hero'.
alter table public.listings
  add column if not exists video_placement text not null default 'hero' check (video_placement in ('hero', 'gallery', 'both'));
