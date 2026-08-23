-- Adds a second listing-site template ("luxury": a cinematic scroll-
-- scrubbed video hero) alongside the existing one, now called "classic".
-- Deliberately just ONE new column, not a parallel set of theme/font/
-- accent columns -- luxury is a fixed, non-customizable look (its own
-- dark/editorial palette + font pairing, hardcoded in the app, not
-- offered through the regular theme picker), so it doesn't need its own
-- storage beyond "which template is this listing using."
--
-- Reuses the *existing* listing_photos/hero_video_url columns for its
-- hero content -- no new upload plumbing needed, the luxury hero just
-- reads the same hero video/photo every listing already has a place to
-- set.
alter table listings add column if not exists site_template text not null default 'classic';
alter table listings drop constraint if exists listings_site_template_check;
alter table listings add constraint listings_site_template_check
  check (site_template in ('classic', 'luxury'));
