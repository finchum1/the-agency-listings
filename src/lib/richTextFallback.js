// Converts the OLD plain-text/structured formats (agent_sites.bio text[],
// agent_site_posts.body jsonb) into the same HTML shape the new *_html
// columns store, entirely in JS. This exists only for the pre-migration
// safety window and for any row the SQL backfill (supabase/rich-text-
// fields.sql) hasn't reached yet — once bio_html/body_html is set, these
// are never called for that row. Mirrors the SQL conversion exactly so
// content looks identical whichever path produced it.
function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function paragraphsToHtml(paragraphs) {
  return (paragraphs || [])
    .filter((p) => p && p.trim())
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
}

export function blocksToHtml(blocks) {
  return (blocks || [])
    .filter((b) => b?.text)
    .map((b) => (b.type === "h3" ? `<h3>${escapeHtml(b.text)}</h3>` : `<p>${escapeHtml(b.text)}</p>`))
    .join("");
}
