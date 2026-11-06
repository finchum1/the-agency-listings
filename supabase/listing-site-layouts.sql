-- Three more layouts for a listing's public site, next to "classic" and "luxury":
--   split     the photo pinned on the left while the details scroll on the right
--   mosaic    a grid of photos first, then the details with a contact card that follows you down
--   showcase  a quiet, centered, magazine-style page
-- Only the allowed values change: they all use the listing's existing theme / accent / font / logo choices, so nothing new is stored.
alter table listings drop constraint if exists listings_site_template_check;
alter table listings add constraint listings_site_template_check
  check (site_template in ('classic', 'luxury', 'split', 'mosaic', 'showcase'));
