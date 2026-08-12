-- Run once in the Supabase SQL Editor — additive follow-up, same
-- convention as the other one-off migration files in this folder.
--
-- Optional per-listing / per-agent-site SEO overrides. Every field is
-- nullable and has a sensible computed fallback in src/lib/seo.js (e.g.
-- an unset seo_title falls back to "{address} | {city}, {state}"), so
-- leaving these blank is completely fine — they only need filling in
-- when the default wording isn't what someone wants search engines or
-- link previews (iMessage/Slack/Facebook/etc.) to show.

alter table listings add column if not exists seo_title text;
alter table listings add column if not exists seo_description text;
alter table listings add column if not exists og_image_url text;

alter table agent_sites add column if not exists seo_title text;
alter table agent_sites add column if not exists seo_description text;
alter table agent_sites add column if not exists og_image_url text;
