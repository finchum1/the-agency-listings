// Helpers for the Vendors module: the office's category order, and the plain-text messages an agent sends to a client.
// The order here is the order of the office's original vendor spreadsheet; categories not listed sort after, A to Z.
export const DEFAULT_VENDOR_CATEGORIES = [
  "Inspectors",
  "Pest/Termite",
  "Painters",
  "Flooring",
  "Handyman",
  "Plumbers",
  "HVAC",
  "Landscaping",
  "Electrician",
  "Roofing/TRR",
  "Concrete",
  "Pools",
  "Powerwashing",
  "Title Locations/Closers",
  "Structural Engineers",
  "Stagers",
  "Media",
  "Carpentry",
  "Appliance Repair",
  "Window Covering",
  "Remodels",
  "Networking/Alarm/Security",
  "Housekeeping",
];

const rank = (c) => {
  const i = DEFAULT_VENDOR_CATEGORIES.findIndex((d) => d.toLowerCase() === String(c).toLowerCase());
  return i === -1 ? 1000 : i;
};
export const compareCategories = (a, b) => rank(a) - rank(b) || a.localeCompare(b);

/** [{ category, vendors }] in category order, vendors A to Z inside each. */
export function groupByCategory(vendors) {
  const map = new Map();
  for (const v of vendors) {
    const key = v.category.trim();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(v);
  }
  return [...map.keys()]
    .sort(compareCategories)
    .map((category) => ({ category, vendors: map.get(category).sort((a, b) => a.name.localeCompare(b.name)) }));
}

/** A bare address becomes a clickable one. */
export const websiteHref = (w) => (/^https?:\/\//i.test(w) ? w : `https://${w}`);
export const telHref = (p) => `tel:+1${String(p).replace(/\D/g, "").replace(/^1/, "")}`;

const details = (v) => [v.phone, v.email, v.website].filter(Boolean).join(" · ");

/** The message for one vendor. */
export function vendorText(v, { from } = {}) {
  const lines = [`${from ? `Here's a ${v.category.toLowerCase()} contact I recommend:` : v.category}`, "", `${v.name}${v.contact_name ? ` (${v.contact_name})` : ""}`];
  if (v.phone) lines.push(v.phone);
  if (v.email) lines.push(v.email);
  if (v.website) lines.push(v.website);
  if (v.notes) lines.push("", v.notes);
  if (from) lines.push("", `— ${from}`);
  return lines.join("\n");
}

/** The message for a hand-picked set, grouped by category. */
export function listText(vendors, { from, orgName, link } = {}) {
  const lines = [`Vendors I recommend${from ? ` — ${from}${orgName ? `, ${orgName}` : ""}` : ""}`, ""];
  for (const g of groupByCategory(vendors)) {
    lines.push(g.category.toUpperCase());
    for (const v of g.vendors) lines.push(`• ${v.name}${v.contact_name ? ` (${v.contact_name})` : ""}${details(v) ? ` — ${details(v)}` : ""}`);
    lines.push("");
  }
  if (link) lines.push(`Tap to see them all: ${link}`);
  return lines.join("\n").trim();
}

export const smsHref = (body) => `sms:?&body=${encodeURIComponent(body)}`;
export const mailHref = (subject, body) => `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
