-- Run once in the Supabase SQL Editor — additive, same convention as the
-- other one-off migration files in this folder.
--
-- Lets an agent pick a punchier headline/blurb and a curated, ordered
-- subset of photos for the printable flyer (see FlyerPage.jsx) without
-- touching the listing's real web copy/description. All nullable —
-- FlyerPage falls back to the address / first description paragraph /
-- first few photos when unset.

alter table listings add column if not exists flyer_headline text;
alter table listings add column if not exists flyer_blurb text;
alter table listings add column if not exists flyer_photo_ids uuid[] not null default '{}';
