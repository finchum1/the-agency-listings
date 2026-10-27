// POST /api/domain-check {ids?: [listingId]}: is each property site's custom domain actually serving this app? Signed in; the
// domains come from the listings the caller can read (never from the request), so this can't be pointed at an arbitrary address.
// What the results mean, and who is emailed when a working domain stops responding, is in api/_lib/domainCheck.js.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { LABELS, checkMany, recordHealth } from "./_lib/domainCheck.js";

const MAX_DOMAINS = 80;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 500) : null;
  let query = auth.supabase.from("listings").select("id, org_id, custom_domain").not("custom_domain", "is", null).neq("custom_domain", "").limit(MAX_DOMAINS);
  if (ids) query = query.in("id", ids);
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: "Couldn't read the listings." });

  const checked = await checkMany((rows || []).map((r) => ({ id: r.id, org_id: r.org_id, domain: r.custom_domain })));
  // Keep the monitor's memory current (and send the alert if this check is what noticed). Never lets a failure here break the page.
  try {
    await recordHealth(serviceClient(), checked);
  } catch (err) {
    console.error("domain health update failed:", err);
  }
  const checkedAt = new Date().toISOString();
  const results = Object.fromEntries(checked.map((c) => [c.id, { domain: c.domain, status: c.status, label: LABELS[c.status], checked_at: checkedAt }]));
  return res.status(200).json({ results });
}
