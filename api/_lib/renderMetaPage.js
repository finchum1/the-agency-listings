// Shared HTML skeleton for the crawler-facing "snapshot" pages served by
// api/meta-listing.js / meta-agent-site.js / meta-agent-post.js. Pass
// already-escaped strings (see lib/seo.js's escapeHtml) — this file does
// no escaping of its own except for structuredData (below). A leading
// underscore keeps Vercel from treating this directory as its own set of
// API routes.
//
// structuredData: a plain object or array of objects (see
// lib/structuredData.js) to embed as JSON-LD. `</` is escaped so a stray
// "</script>" inside a string value (e.g. a listing description) can't
// break out of the script tag.
export function renderMetaPage({ title, description, image, url, heading, bodyHtml, noindex, structuredData }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
${noindex ? '<meta name="robots" content="noindex" />' : ""}
<link rel="canonical" href="${url}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
${image ? `<meta property="og:image" content="${image}" />` : ""}
<meta property="og:url" content="${url}" />
<meta name="twitter:card" content="${image ? "summary_large_image" : "summary"}" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
${image ? `<meta name="twitter:image" content="${image}" />` : ""}
${
  structuredData
    ? `<script type="application/ld+json">${JSON.stringify(
        Array.isArray(structuredData) ? structuredData : [structuredData],
      ).replace(/<\//g, "<\\/")}</script>`
    : ""
}
</head>
<body>
<h1>${heading}</h1>
${bodyHtml}
</body>
</html>
`;
}
