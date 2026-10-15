import { supabase } from "./supabaseClient";

// Helpers for the Organizations page (create) and the Brand settings page (edit).
// The database enforces the real rules (supabase/multi-tenant-1i-org-brand-editing.sql); these keep the forms in step with it.

export const LOGO_BUCKET = "brokerage-site-photos";
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/svg+xml": "svg" };

/** Address-safe name: "Austin, TX" -> "austin-tx". */
export function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** "austin" -> "Austin", "NEW YORK" -> "New York": typed locations come out looking like a label. */
export function tidyLocation(text) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  // Leave short all-caps entries like "TX" or "NYC" alone; title-case everything else.
  if (t === t.toUpperCase() && t.length <= 3) return t;
  return t.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, a, b) => a + b.toUpperCase());
}

export const AGENCY_FRANCHISE = "the-agency";
export const AGENCY_DISCLAIMER = "This office is independently owned and operated. Equal Housing Opportunity.";
export const AGENCY_FRANCHISE_DISCLAIMER =
  "THIS OFFICE IS AN INDEPENDENTLY OWNED AND OPERATED FRANCHISEE OF THE AGENCY REAL ESTATE FRANCHISING, LLC.";
export const AGENCY_LOGOS = {
  red: "/images/brokerage-logo.png",
  white: "/images/brokerage-logo-white.png",
  black: "/images/brokerage-logo-black.png",
};
export const AGENCY_COLORS = ["#ed2127", "#000000"];

/** Everything a new Agency office needs from just its location, so it reads like "The Agency | OKLAHOMA". */
export function agencyOfficeRow(location) {
  const label = tidyLocation(location);
  return {
    slug: `the-agency-${slugify(label)}`,
    name: "The Agency",
    type: "brokerage",
    disclaimer: AGENCY_DISCLAIMER,
    franchise_disclaimer: AGENCY_FRANCHISE_DISCLAIMER,
    brand: {
      franchise: AGENCY_FRANCHISE,
      logos: { ...AGENCY_LOGOS },
      default_logo: "red",
      accent_colors: [...AGENCY_COLORS],
      location_label: label,
      admin_name: `The Agency ${label}`,
    },
  };
}

// Slots shown on the Brand page, in this order. An organization that already has logos keeps its own key names
// (The Agency uses red / white / black; new organizations use main / white / black).
export function logoSlots(brand) {
  const have = Object.keys(brand?.logos || {});
  const main = brand?.default_logo && have.includes(brand.default_logo) ? brand.default_logo : have[0] || "main";
  const keys = [main, ...have.filter((k) => k !== main), ...["white", "black"].filter((k) => k !== main && !have.includes(k))];
  return keys.map((key) => ({
    key,
    isMain: key === main,
    label: key === main ? "Main logo" : key === "white" ? "White logo" : key === "black" ? "Black logo" : key.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    hint:
      key === main
        ? "Shown in the dashboard menu, on the sign-in page and on your sites. Use your normal full-color logo."
        : key === "white"
          ? "Optional. Used on dark backgrounds, like a photo header or the dark theme."
          : key === "black"
            ? "Optional. A one-color black version for light backgrounds."
            : "",
    previewBg: key === "white" ? "#14130f" : "#ffffff",
  }));
}

export function checkLogoFile(file) {
  if (!file) return "Choose an image first.";
  if (!LOGO_TYPES[file.type]) return "Use a PNG, JPG, WebP or SVG image.";
  if (file.size > MAX_LOGO_BYTES) return "That image is over 2 MB. Please use a smaller file.";
  return "";
}

/** Uploads into this organization's own folder (the storage rules only allow its admins and the platform owner there). */
export async function uploadOrgLogo(orgId, key, file) {
  const problem = checkLogoFile(file);
  if (problem) throw new Error(problem);
  const path = `${orgId}/brand/${key}-${Date.now()}.${LOGO_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(LOGO_BUCKET).upload(path, file, { contentType: file.type, cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return supabase.storage.from(LOGO_BUCKET).getPublicUrl(path).data.publicUrl;
}

/** Best-effort cleanup of a replaced logo, only ever inside this organization's own folder. */
export async function removeOldLogo(orgId, url) {
  const marker = `/${LOGO_BUCKET}/${orgId}/brand/`;
  const at = typeof url === "string" ? url.indexOf(marker) : -1;
  if (at < 0) return;
  const path = url.slice(at + `/${LOGO_BUCKET}/`.length);
  await supabase.storage.from(LOGO_BUCKET).remove([path]).catch(() => {});
}

export const HEX = /^#[0-9a-f]{6}$/i;

export const RESERVED_SLUGS = ["dashboard", "login", "api", "sites", "listings", "brokerage", "admin", "app", "www", "accept-invite", "assets", "images"];

export function slugProblem(slug) {
  if (!/^[a-z0-9][a-z0-9-]{1,60}$/.test(slug)) return "Use 2 to 61 lowercase letters, numbers or hyphens.";
  if (RESERVED_SLUGS.includes(slug)) return "That address name is reserved.";
  return "";
}
