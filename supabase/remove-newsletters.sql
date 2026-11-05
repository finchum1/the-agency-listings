-- Newsletters were built (2026-11-05) and then removed the same day: sending from an agent's own address needed DNS records the brokerage could not add, so
-- the feature was dropped. The four tables held no sent mail (only a test draft). The social posts and holiday posts in Marketing stay.
drop table if exists public.newsletter_events;
drop table if exists public.newsletter_sends;
drop table if exists public.newsletter_optouts;
drop table if exists public.newsletters;
drop function if exists public.newsletters_touch();
