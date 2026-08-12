-- Run once in the Supabase SQL Editor (agent-sites-schema.sql already ran,
-- this is an additive follow-up — same convention as
-- add-custom-domain-index.sql was for listings).
--
-- Adds per-agent-site presentation choices (template/theme, font pairing,
-- a secondary logo shown next to the brokerage logo) and a unique index so
-- an agent site can be reached at its own custom domain, exactly like
-- listings already can (see README.md → "Custom domain").

alter table agent_sites add column if not exists theme text not null default 'classic'
  check (theme in ('classic', 'light', 'dark'));

alter table agent_sites add column if not exists font_pairing text not null default 'playfair-jost'
  check (font_pairing in ('playfair-jost', 'fraunces-inter', 'cormorant-worksans'));

alter table agent_sites add column if not exists secondary_logo_url text;

-- Case-insensitive uniqueness so "TerrenceFinchum.com" and
-- "terrencefinchum.com" can't both be claimed; partial index (WHERE ... IS
-- NOT NULL) so it doesn't block the many sites with no custom domain.
create unique index if not exists agent_sites_custom_domain_idx
  on agent_sites (lower(custom_domain))
  where custom_domain is not null;
