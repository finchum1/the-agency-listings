-- Adds HTML-storing columns for the new WYSIWYG editor (RichTextEditor.jsx)
-- used on Bio, Testimonials, Areas of Expertise, and Blog posts. Old
-- columns are left in place, untouched and unused going forward — this is
-- a non-destructive, zero-visual-change migration: every existing row is
-- converted to HTML that renders identically to how it renders today, and
-- nothing changes on any public site until an agent edits and re-saves
-- through the new editor.
--
-- Testimonials.quote and agent_site_areas.description need NO new column:
-- both are already single, non-array plain-text fields, and plain text
-- with no angle brackets renders identically whether shown as {text} or
-- as sanitized dangerouslySetInnerHTML. Only their editor/renderer wiring
-- changes (separate from this file).
--
-- HTML-escaping is done manually via nested replace() (Postgres has no
-- built-in html-escape function) so old plain-text content that happens
-- to contain a literal "<", ">" or "&" isn't misread as markup once it's
-- rendered through dangerouslySetInnerHTML.

-- ---------------------------------------------------------------------
-- agent_sites.bio_html — converted from bio text[] (one paragraph per
-- array element) by wrapping each escaped paragraph in <p>...</p> and
-- concatenating.
-- ---------------------------------------------------------------------
alter table agent_sites add column if not exists bio_html text;

update agent_sites
set bio_html = coalesce((
  select string_agg(
    '<p>' || replace(replace(replace(p, '&', '&amp;'), '<', '&lt;'), '>', '&gt;') || '</p>',
    ''
  )
  from unnest(bio) as p
  where p is not null and length(trim(p)) > 0
), '')
where bio_html is null;

-- ---------------------------------------------------------------------
-- agent_site_posts.body_html — converted from body jsonb
-- ([{ "type": "p" | "h3", "text": "…" }]) by mapping each block to
-- <h3>...</h3> or <p>...</p> and concatenating.
-- ---------------------------------------------------------------------
alter table agent_site_posts add column if not exists body_html text;

update agent_site_posts
set body_html = coalesce((
  select string_agg(
    case when block->>'type' = 'h3' then '<h3>' else '<p>' end
      || replace(replace(replace(block->>'text', '&', '&amp;'), '<', '&lt;'), '>', '&gt;')
      || (case when block->>'type' = 'h3' then '</h3>' else '</p>' end),
    ''
  )
  from jsonb_array_elements(body) as block
  where coalesce(block->>'text', '') <> ''
), '')
where body_html is null;
