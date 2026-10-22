// A client's view of the vendors an agent picked (see supabase/people-module.sql section 31 and src/pages/VendorSharePage.jsx).
//   GET /api/vendor-share?token=vs...  -> who recommends them, and the vendors, for a valid, unexpired, unrevoked link
// No sign-in: the long random token in the link is the credential, compared only by its hash. The link shows exactly the vendors
// that were picked (their current details, so a corrected phone number shows up), nothing else about the office.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^vs[0-9a-f]{64}$/;

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
  const { data: link } = await admin.from("vendor_share_links").select("id, org_id, created_by, title, vendor_ids, expires_at, revoked_at, view_count").eq("token_hash", hash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return res.status(404).json({ error: "This link isn't valid anymore." });

  const [{ data: vendors }, { data: agent }, { data: org }] = await Promise.all([
    admin.from("vendors").select("id, category, name, contact_name, phone, email, website, notes").in("id", link.vendor_ids).eq("org_id", link.org_id),
    admin.from("profiles").select("full_name, title, license, phone, email, photo_url").eq("id", link.created_by).maybeSingle(),
    admin.from("organizations").select("id, slug, name, brand, address_line1, city, state, zip").eq("id", link.org_id).maybeSingle(),
  ]);
  await admin.from("vendor_share_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count || 0) + 1 }).eq("id", link.id);
  return res.status(200).json({ title: link.title, expires_at: link.expires_at, agent: agent || null, org: org || null, vendors: vendors || [] });
}
