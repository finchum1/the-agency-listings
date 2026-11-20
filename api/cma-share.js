// A client's view of a CMA an agent shared (see supabase/cma-module.sql and src/pages/CmaSharePage.jsx).
//   GET /api/cma-share?token=cm...  -> the CMA, the agent and the office, for a valid, unrevoked link
// No sign-in: the long random token in the link is the credential, compared only by its hash. Comps the agent left unticked are not sent.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^cm[0-9a-f]{64}$/;

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
  const { data: cma } = await admin
    .from("cmas")
    .select("id, owner_id, org_id, title, subject, comps, price_low, price_high, suggested_price, notes, shared_at, updated_at, view_count")
    .eq("share_hash", hash)
    .maybeSingle();
  if (!cma) return res.status(404).json({ error: "This link isn't valid anymore." });

  const [{ data: agent }, { data: org }] = await Promise.all([
    admin.from("profiles").select("full_name, title, license, phone, email, photo_url").eq("id", cma.owner_id).maybeSingle(),
    admin.from("organizations").select("id, slug, name, brand, address_line1, city, state, zip, disclaimer").eq("id", cma.org_id).maybeSingle(),
  ]);
  await admin.from("cmas").update({ last_viewed_at: new Date().toISOString(), view_count: (cma.view_count || 0) + 1 }).eq("id", cma.id);
  const comps = (Array.isArray(cma.comps) ? cma.comps : []).filter((c) => c && c.include !== false);
  return res.status(200).json({
    title: cma.title,
    subject: cma.subject,
    comps,
    price_low: cma.price_low,
    price_high: cma.price_high,
    suggested_price: cma.suggested_price,
    notes: cma.notes,
    prepared: cma.updated_at,
    agent: agent || null,
    org: org || null,
  });
}
