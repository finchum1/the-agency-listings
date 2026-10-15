import defaultBrokerage from "./brokerage.js";
import { bareHost, isAppHost } from "./appHosts.js";

// Brand now lives in the database (organizations.brand + address/disclaimer
// columns), one set per organization. The old src/lib/brokerage.js constant
// stays only as the fallback for places that render before an organization is
// known (login, 404, marketing pages, a page still loading).
//
// brandFromOrg() turns an organizations row into exactly the shape the rest of
// the app already expects from that constant, so components change very little.

/** The organization the app host's public brokerage pages show when nothing else says otherwise. */
export const DEFAULT_ORG_SLUG = "the-agency-oklahoma";

export function brandFromOrg(org) {
  if (!org) return defaultBrokerage;
  const brand = org.brand || {};
  const logos = brand.logos || {};
  const logo = logos[brand.default_logo] || logos.red || Object.values(logos)[0] || "";
  return {
    id: org.id,
    slug: org.slug,
    name: org.name,
    logo,
    logos,
    address: { line1: org.address_line1 || "", city: org.city || "", state: org.state || "", zip: org.zip || "" },
    disclaimer: org.disclaimer || "",
    franchiseDisclaimer: org.franchise_disclaimer || "",
    // "Oklahoma" for The Agency; shown next to the logo and in SEO text
    locationLabel: brand.location_label || org.state || "",
    // "Oklahoma City, Edmond, and the surrounding metro": the roster blurb; falls back to the location label
    serviceArea: brand.service_area || "",
    accentColors: brand.accent_colors || [],
  };
}

/**
 * The public brokerage_site row for the current visitor, with its organization embedded.
 * Which brokerage? On a brokerage's own domain, the one that owns that domain; on the app
 * host, The Agency (the default organization). Phase 3 adds per-organization paths.
 */
export function brokerageSiteQuery(supabase, { customDomain } = {}) {
  const domain =
    customDomain ||
    (typeof window !== "undefined" && !isAppHost(window.location.hostname) ? bareHost(window.location.hostname) : null);
  const query = supabase.from("brokerage_site").select("*, org:organizations!inner(*)");
  return domain ? query.ilike("custom_domain", domain) : query.eq("org.slug", DEFAULT_ORG_SLUG);
}
