// A client's private view of their own deal (see supabase/people-module.sql section 40 and src/pages/TransactionTimelinePage.jsx).
//   GET /api/transaction-timeline?token=tl...  -> the deal's key dates and who is helping, with the agent's branding
// No sign-in: the long random token in the link is the credential, compared only by its hash. It carries what a client needs and
// nothing internal: no price, commission, notes or the agent's checklist.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^tl[0-9a-f]{64}$/;
const todayInChicago = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

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
  const { data: link } = await admin.from("transaction_timeline_links").select("id, person_id, message, expires_at, revoked_at, view_count").eq("token_hash", hash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return res.status(404).json({ error: "This link isn't valid anymore." });

  const { data: person } = await admin
    .from("people")
    .select("name, side, stage, stage_group, property_address, other_agent, title_company, lender, contract_date, inspection_date, appraisal_date, financing_deadline, closing_date, owner:profiles!people_owner_id_fkey(full_name, title, license, phone, email, photo_url, org:organizations(id, slug, name, brand, address_line1, city, state, zip, disclaimer))")
    .eq("id", link.person_id)
    .maybeSingle();
  if (!person) return res.status(404).json({ error: "This link isn't valid anymore." });

  await admin.from("transaction_timeline_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count || 0) + 1 }).eq("id", link.id);
  const { owner, ...deal } = person;
  return res.status(200).json({ deal, agent: owner ? { full_name: owner.full_name, title: owner.title, license: owner.license, phone: owner.phone, email: owner.email, photo_url: owner.photo_url } : null, org: owner?.org || null, message: link.message, today: todayInChicago(), expires_at: link.expires_at });
}
