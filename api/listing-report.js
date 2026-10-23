// A seller's private activity report for one listing (see supabase/people-module.sql section 32 and
// src/pages/ListingReportPage.jsx).
//   GET /api/listing-report?token=lr...&days=30  -> the listing's headline facts, its agent, and its analytics
// No sign-in: the long random token in the link is the credential, compared only by its hash. The report never includes
// inquiry names or contact details, only counts.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^lr[0-9a-f]{64}$/;
const DAYS = [7, 30, 90, 365];

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const token = String(req.query?.token || "");
  if (!TOKEN.test(token)) return res.status(404).json({ error: "This link isn't valid anymore." });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: link } = await admin.from("listing_report_links").select("id, listing_id, expires_at, revoked_at, view_count").eq("token_hash", hash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return res.status(404).json({ error: "This link isn't valid anymore." });

  const asked = Number(req.query?.days);
  const days = DAYS.includes(asked) ? asked : 30;
  const { data: listing } = await admin
    .from("listings")
    .select("id, slug, custom_domain, address_line1, city, state, zip, price, status, created_at, agent:profiles(full_name, title, license, phone, email, photo_url), org:organizations(id, slug, name, brand, address_line1, city, state, zip, disclaimer), listing_photos(url, is_hero, sort_order)")
    .eq("id", link.listing_id)
    .maybeSingle();
  if (!listing) return res.status(404).json({ error: "This link isn't valid anymore." });
  const { data: analytics, error } = await admin.rpc("listing_analytics", { p_listing_id: link.listing_id, p_days: days });
  if (error) return res.status(500).json({ error: "Couldn't load the report." });

  // Count the view only when the page is first opened, not every time they switch the period.
  if (req.query?.first === "1") {
    await admin.from("listing_report_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count || 0) + 1 }).eq("id", link.id);
  }

  const photos = [...(listing.listing_photos || [])].sort((a, b) => Number(b.is_hero) - Number(a.is_hero) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const { listing_photos: _drop, ...rest } = listing;
  return res.status(200).json({ listing: { ...rest, photo: photos[0]?.url || null }, analytics, expires_at: link.expires_at, days });
}
