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
const ALLOWED_TAGS = ["p", "h3", "strong", "em", "u", "br"];

export function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: [] });
}
