// GET /api/deadline-nudges: run by the Vercel cron every morning (vercel.json). For each agent with open deals, emails ONE digest of what is
// due today, tomorrow or the day after (key dates and tasks) plus anything overdue; nothing is sent on a day with nothing to report. Goes out once
// per agent per day (deadline_nudge_log). An agent can turn it off in My Profile (deadline_nudges). ?dryRun=1 lists what would be sent without
// sending or logging; ?to=<agent id> limits a run to one agent. If CRON_SECRET is set, the call must carry it.
import { serviceClient } from "./_lib/authUser.js";
import { fromAs, sendNotification, viaOrg } from "./_lib/inquiry.js";
import { daysBetween, gatherDeal, summarize, todayKey } from "./_lib/dealUpdate.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const WINDOW = 2; // days ahead that count as "due soon"
const MAX_PER_DEAL = 6;
const when = (d) => (d === 0 ? "today" : d === 1 ? "tomorrow" : `in ${d} days`);
const nice = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** What is due for one deal: { overdue: [...], soon: [{ text, days }] } as plain strings, or null when there is nothing. */
export function nudgeItems(data, today) {
  const s = summarize(data, today);
  const soon = [
    ...s.upcomingDates.filter((d) => d.days <= WINDOW).map((d) => ({ text: d.label, days: d.days })),
    ...s.soon.filter((t) => daysBetween(today, t.due) <= WINDOW).map((t) => ({ text: t.text, days: daysBetween(today, t.due) })),
  ].sort((a, b) => a.days - b.days);
  const overdue = s.overdue.map((t) => ({ text: t.text, due: t.due }));
  if (!soon.length && !overdue.length) return null;
  return { soon, overdue };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(200).json({ ok: true, skipped: "email isn't set up" });
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  const today = todayKey();
  const dryRun = req.query?.dryRun === "1";
  const only = typeof req.query?.to === "string" ? req.query.to : "";
  let q = admin.from("people").select("id, owner_id").eq("stage_group", "transaction").eq("archived", false);
  if (only) q = q.eq("owner_id", only);
  const { data: deals } = await q.limit(2000);
  const byAgent = new Map();
  for (const d of deals || []) byAgent.set(d.owner_id, [...(byAgent.get(d.owner_id) || []), d.id]);

  const sent = [];
  for (const [agentId, ids] of byAgent) {
    try {
      const [{ data: settings }, { data: logged }] = await Promise.all([
        admin.from("agent_notification_settings").select("deadline_nudges").eq("agent_id", agentId).maybeSingle(),
        admin.from("deadline_nudge_log").select("day").eq("agent_id", agentId).eq("day", today).maybeSingle(),
      ]);
      if (settings?.deadline_nudges === false || logged) continue;
      const { data: ps } = await admin.from("people_settings").select("stages").eq("owner_id", agentId).maybeSingle();
      const closedName = String(ps?.stages?.transaction_closed || "Closed").toLowerCase();

      const sections = [];
      let owner = null;
      for (const id of ids.slice(0, 60)) {
        const data = await gatherDeal(admin, id);
        if (!data || data.deal.archived || String(data.deal.stage).toLowerCase() === closedName) continue;
        owner = data.owner;
        const items = nudgeItems(data, today);
        if (items) sections.push({ id, where: data.deal.property_address || data.deal.name, ...items });
      }
      if (!owner?.email || !sections.length) continue;
      sections.sort((a, b) => (b.overdue.length ? 1 : 0) - (a.overdue.length ? 1 : 0) || (a.soon[0]?.days ?? 9) - (b.soon[0]?.days ?? 9));

      const count = sections.reduce((n, s) => n + s.soon.length + s.overdue.length, 0);
      const first = owner.full_name?.split(" ")[0] || "there";
      const subject = `${count} deadline${count === 1 ? "" : "s"} on your deals ${sections.some((s) => s.soon.some((i) => i.days === 0)) ? "today" : "this week"}`;
      const lines = (s) => [
        ...s.overdue.slice(0, MAX_PER_DEAL).map((t) => ({ text: `${t.text} (overdue since ${nice(t.due)})`, alert: true })),
        ...s.soon.slice(0, MAX_PER_DEAL).map((i) => ({ text: `${i.text}: ${when(i.days)}`, alert: i.days === 0 })),
      ];
      const url = (id) => `${SITE_ORIGIN}/dashboard/deals?deal=${id}`;
      const text = [
        `Good morning ${first},`,
        "",
        "Here's what's due on your deals:",
        ...sections.flatMap((s) => ["", s.where, ...lines(s).map((l) => `  - ${l.text}`), `  ${url(s.id)}`]),
        "",
        "You can turn this email off in My Profile.",
      ].join("\n");
      const block = (s) =>
        `<tr><td style="padding:0 6px 10px"><div style="background:#ffffff;border:1px solid ${s.overdue.length ? "#f1c9c6" : "#e4dfd3"};border-radius:14px;padding:14px 18px"><a href="${esc(url(s.id))}" style="font:600 16px Georgia,serif;color:#1c1a17;text-decoration:none">${esc(s.where)}</a>${lines(s).map((l) => `<div style="font:14px/1.6 Arial,sans-serif;color:${l.alert ? "#b3261e" : "#1c1a17"};padding:2px 0">${esc(l.text)}</div>`).join("")}</div></td></tr>`;
      const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="max-width:600px;width:100%"><tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Deadlines</div><div style="margin-top:6px;font:600 24px Georgia,serif;color:#1c1a17">${esc(subject)}</div></td></tr>${sections.map(block).join("")}<tr><td style="padding:8px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(owner.org?.name || "")} · You can turn this email off in My Profile.</td></tr></table></td></tr></table></body></html>`;

      if (dryRun) {
        sent.push({ agent: owner.full_name, deals: sections.length, items: count, subject });
        continue;
      }
      // Claim the day first, so an overlapping run can't send it twice; give it back if the email fails.
      const { error } = await admin.from("deadline_nudge_log").insert({ agent_id: agentId, day: today });
      if (error) continue;
      const ok = await sendNotification(apiKey, { from: fromAs(viaOrg("", owner.org?.name), "Deals", "deals"), to: [owner.email], subject, text, html });
      if (!ok) await admin.from("deadline_nudge_log").delete().eq("agent_id", agentId).eq("day", today);
      else sent.push({ agent: owner.full_name, deals: sections.length, items: count });
    } catch (err) {
      console.error("deadline nudge failed for", agentId, err);
    }
  }
  return res.status(200).json({ ok: true, today, agents: byAgent.size, sent });
}
