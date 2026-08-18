// Browser-only DOM helper — applies a {title, description, image, url}
// object (built by lib/seo.js) to the live document: title + meta
// description + Open Graph + Twitter Card tags. This is the "real browser
// / Googlebot" half of SEO coverage; crawlers that don't execute JS
// (social-link unfurlers) never see this — they hit the server-rendered
// snapshots in api/meta-*.js instead (see vercel.json).
function upsertMeta(attr, key, content) {
  if (!content) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function upsertLink(rel, href) {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

export function applyPageMeta({ title, description, image, url }) {
  if (title) document.title = title;
  upsertMeta("name", "description", description);
  upsertMeta("property", "og:type", "website");
  upsertMeta("property", "og:title", title);
  upsertMeta("property", "og:description", description);
  upsertMeta("property", "og:image", image);
  upsertMeta("property", "og:url", url || window.location.href);
  upsertMeta("name", "twitter:card", image ? "summary_large_image" : "summary");
  upsertMeta("name", "twitter:title", title);
  upsertMeta("name", "twitter:description", description);
  upsertMeta("name", "twitter:image", image);
  upsertLink("canonical", url || window.location.href);
}

// Injects one or more schema.org objects (lib/structuredData.js builders)
// as a single <script type="application/ld+json"> in <head>, replacing
// whatever this page set previously — same upsert idea as the meta tags
// above, so navigating between pages in the SPA never leaves a stale
// schema from the last page behind. A bare object is wrapped in an array;
// Google's parser accepts either a single object or an array of them in
// one script tag.
export function applyStructuredData(schema) {
  const id = "ld-json";
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(Array.isArray(schema) ? schema : [schema]);
}
