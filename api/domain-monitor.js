// GET /api/domain-monitor: run by the Vercel cron (vercel.json) every morning. Checks every property site's custom domain and
// emails the admins who turned on domain alerts if one that was working has stopped responding (or has come back). If CRON_SECRET
// is set, the call must carry it.
import { serviceClient } from "./_lib/authUser.js";
import { checkMany, recordHealth } from "./_lib/domainCheck.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const { data: rows } = await admin.from("listings").select("id, org_id, custom_domain").not("custom_domain", "is", null).neq("custom_domain", "").limit(500);
  const checked = await checkMany((rows || []).map((r) => ({ id: r.id, org_id: r.org_id, domain: r.custom_domain })), 10);
  const { down, back } = await recordHealth(admin, checked);
  return res.status(200).json({ checked: checked.length, notAnswering: checked.filter((c) => c.status !== "ok").length, newlyDown: down, backUp: back });
}
