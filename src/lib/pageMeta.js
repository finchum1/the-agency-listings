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
