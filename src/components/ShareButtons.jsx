import { facebookShareUrl, linkedinShareUrl, xShareUrl } from "../lib/shareLinks";

// Same icon paths as agent-site/Footer.jsx and brokerage-site/Footer.jsx
// use for their own social links — kept visually consistent.
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <path d="M15 3h-2a4 4 0 0 0-4 4v3H6v4h3v7h4v-7h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="7" cy="6.7" r="0.6" fill="currentColor" stroke="none" />
      <line x1="7" y1="10" x2="7" y2="17" />
      <path d="M11 17v-4.2a2.3 2.3 0 0 1 4.6 0V17" />
      <line x1="11" y1="10" x2="11" y2="17" />
    </svg>
  );
}
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

// Opens the share dialog in a small popup instead of a full new tab —
// standard share-button UX. Falls back gracefully to a real new-tab
// navigation (the plain href) if a popup blocker eats window.open.
const openPopup = (href) => (e) => {
  const win = window.open(href, "share", "width=600,height=520,noopener,noreferrer");
  if (win) e.preventDefault();
};

// "Share" row for a blog post — Facebook, LinkedIn, and X, no API keys
// or login required. Shared between agent-site and brokerage-site post
// pages, both of which use the same --as-* theme tokens. `url` must be
// the post's own absolute, canonical URL. `title` is optional — passed
// through as X's pre-filled tweet text; Facebook/LinkedIn don't take one
// since they scrape the URL's own Open Graph tags instead.
export default function ShareButtons({ url, title, className = "" }) {
  if (!url) return null;
  const fb = facebookShareUrl(url);
  const li = linkedinShareUrl(url);
  const x = xShareUrl(url, title);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <span className="text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/40">Share</span>
      <a
        href={fb}
        onClick={openPopup(fb)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on Facebook"
        className="h-8 w-8 rounded-full border border-[var(--as-text)]/15 flex items-center justify-center text-[var(--as-text)]/60 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]/40"
      >
        <FacebookIcon />
      </a>
      <a
        href={li}
        onClick={openPopup(li)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on LinkedIn"
        className="h-8 w-8 rounded-full border border-[var(--as-text)]/15 flex items-center justify-center text-[var(--as-text)]/60 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]/40"
      >
        <LinkedInIcon />
      </a>
      <a
        href={x}
        onClick={openPopup(x)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Share on X"
        className="h-8 w-8 rounded-full border border-[var(--as-text)]/15 flex items-center justify-center text-[var(--as-text)]/60 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]/40"
      >
        <XIcon />
      </a>
    </div>
  );
}
