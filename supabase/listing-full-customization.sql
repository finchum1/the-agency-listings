-- Extends listings.theme (supabase/listing-themes.sql) to full parity
-- with agent_sites' customization suite: font pairing, accent color, and
-- logo color, each the listing-site counterpart of the identically-named
-- agent_sites columns. Same brand-locked rules apply — accent_color is
-- restricted to The Agency's own red or black, never a free color.

alter table listings add column if not exists font_pairing text not null default 'playfair-jost';
alter table listings drop constraint if exists listings_font_pairing_check;
alter table listings add constraint listings_font_pairing_check
  check (font_pairing in (
    'playfair-jost', 'fraunces-inter', 'cormorant-worksans',
    'libre-karla', 'bodoni-manrope', 'dmserif-dmsans'
  ));

alter table listings add column if not exists accent_color text;
alter table listings drop constraint if exists listings_accent_color_check;
alter table listings add constraint listings_accent_color_check
  check (accent_color is null or lower(accent_color) in ('#ed2127', '#000000'));

alter table listings add column if not exists logo_variant text not null default 'red';
alter table listings drop constraint if exists listings_logo_variant_check;
alter table listings add constraint listings_logo_variant_check
  check (logo_variant in ('red', 'white', 'black'));
