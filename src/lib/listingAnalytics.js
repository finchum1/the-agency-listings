// Labels and helpers for the property-site analytics screens (the dashboard page and the seller report).
export const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 365, label: "1 year" },
];

const SOURCE_LABELS = {
  direct: "Direct / unknown",
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  bing: "Bing",
  duckduckgo: "DuckDuckGo",
  yahoo: "Yahoo",
  zillow: "Zillow",
  "realtor.com": "Realtor.com",
  redfin: "Redfin",
  trulia: "Trulia",
  x: "X (Twitter)",
  linkedin: "LinkedIn",
  pinterest: "Pinterest",
  youtube: "YouTube",
  tiktok: "TikTok",
  nextdoor: "Nextdoor",
  email: "Email",
  text: "Text message",
  sms: "Text message",
  mls: "MLS",
  flyer: "Flyer / QR code",
  qr: "Flyer / QR code",
  referral: "Other websites",
  "google-profile": "Google Business Profile",
};
export const sourceLabel = (s) => SOURCE_LABELS[s] || s.charAt(0).toUpperCase() + s.slice(1);

/** The links an agent can hand out, one per place, so every visit says where it came from. */
export const SHARE_CHANNELS = [
  { src: "facebook", label: "Facebook" },
  { src: "instagram", label: "Instagram" },
  { src: "email", label: "Email" },
  { src: "text", label: "Text message" },
  { src: "mls", label: "MLS" },
  { src: "flyer", label: "Flyer / QR code" },
  { src: "zillow", label: "Zillow" },
];

/** The same idea for an agent's website: the places an agent hands out their address. */
export const SITE_SHARE_CHANNELS = [
  { src: "facebook", label: "Facebook" },
  { src: "instagram", label: "Instagram" },
  { src: "linkedin", label: "LinkedIn" },
  { src: "email", label: "Email signature" },
  { src: "text", label: "Text message" },
  { src: "qr", label: "Business card / QR code" },
  { src: "google-profile", label: "Google Business Profile" },
];

/** An agent site's public address: its own domain if it has one, otherwise the app's /sites/<slug> page. */
export function siteUrl(site, origin = window.location.origin) {
  const domain = String(site?.custom_domain || "").trim();
  return domain ? `https://${domain}` : `${origin}/sites/${site.slug}`;
}

/** The listing's public address: its own domain if it has one, otherwise the app's /listings/<slug> page. */
export function listingUrl(listing, origin = window.location.origin) {
  const domain = String(listing?.custom_domain || "").trim();
  return domain ? `https://${domain}` : `${origin}/listings/${listing.slug}`;
}
export const taggedUrl = (base, src) => `${base}${base.includes("?") ? "&" : "?"}src=${encodeURIComponent(src)}`;

export const formatDuration = (sec) => (sec == null ? "—" : sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`);
export const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);

export const placeLabel = (l) => [l.city, l.region].filter(Boolean).join(", ") + (l.country && l.country !== "US" ? ` (${l.country})` : "");
