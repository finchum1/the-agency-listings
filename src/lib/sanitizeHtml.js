import DOMPurify from "dompurify";

// Shared sanitizer for every place rich-text content (bio, testimonials,
// area descriptions, blog posts — all edited via RichTextEditor.jsx)
// gets rendered with dangerouslySetInnerHTML on a PUBLIC page. The editor
// itself only ever produces this exact tag set, but RLS only restricts
// *who* can write to these columns (the owning agent or an admin), not
// *what* — a compromised or malicious agent account could otherwise write
// a <script> tag directly via the Supabase API (bypassing the editor UI
// entirely) that would then run in every visitor's browser. Sanitizing on
// read, not just trusting the editor's output, is what actually closes
// that gap.
// "a"/"href" added for RichTextEditor.jsx's Link extension (internal
// blog-post linking). DOMPurify's default ALLOWED_URI_REGEXP already
// blocks javascript:/data: hrefs even with "href" allowed — no scheme
// allowlist needed here on top of that.
const ALLOWED_TAGS = ["p", "h2", "h3", "strong", "em", "u", "br", "a", "span"];
const ALLOWED_ATTR = ["href", "class"];

// "span"/"class" exist only for RichTextEditor's Agency-red text
// (<span class="brand-red">). `class` is dangerous in general — a
// compromised agent account could write Tailwind utility classes
// (fixed, inset-0, …) to overlay the page — so this hook drops every
// class except that one exact value on a span.
DOMPurify.addHook("uponSanitizeAttribute", (node, data) => {
  if (data.attrName === "class" && !(node.tagName === "SPAN" && data.attrValue === "brand-red")) {
    data.keepAttr = false;
  }
});

export function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
