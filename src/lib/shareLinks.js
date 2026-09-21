// Plain share-intent URLs — no app registration, OAuth, or API keys
// needed. Facebook and LinkedIn both scrape the target URL's own Open
// Graph tags for the shared preview (title/description/image), which
// every post page already sets via lib/pageMeta.js + lib/seo.js, so
// there's nothing else to configure for the preview to look right.
export function facebookShareUrl(url) {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
}

export function linkedinShareUrl(url) {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
}

// X (formerly Twitter) still serves its share intent at this path — same
// no-API-key, scrapes-the-page's-own-OG-tags deal as the two above.
// `text` is optional and pre-fills the post text (the post's title).
export function xShareUrl(url, text) {
  const params = new URLSearchParams({ url });
  if (text) params.set("text", text);
  return `https://x.com/intent/tweet?${params.toString()}`;
}
