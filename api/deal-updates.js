// GET /api/deal-updates: run by the Vercel cron every morning (vercel.json). For every deal a transaction coordinator works on, emails the agent
// when a milestone comes up (closing in 7 and 2 days, inspection / appraisal / financing deadline in 2 days, every document collected, compliance
// approved), and on Mondays one weekly summary per agent of their coordinated deals that have something overdue or coming up. Each milestone goes
// out once per deal (deal_update_log). A coordinator can turn this off in My Profile; if CRON_SECRET is set, the call must carry it.
import { serviceClient } from "./_lib/authUser.js";
import { fromAs, sendNotification, viaOrg } from "./_lib/inquiry.js";
import { buildAgentUpdate, gatherDeal, milestonesFor, summarize, todayKey } from "./_lib/dealUpdate.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Sent as the coordinator the update is from ("Terrence Finchum via The Agency Oklahoma"); replies go to them.
const FROM = (coordinator, org) => fromAs(viaOrg(coordinator, org), "Deals");

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
  // Deals with a coordinator: picked for the deal, or assigned to the agent.
  const [{ data: per }, { data: wide }] = await Promise.all([admin.from("deal_tcs").select("person_id"), admin.from("deal_team").select("agent_id")]);
  const agents = [...new Set((wide || []).map((r) => r.agent_id))];
  const ids = new Set((per || []).map((r) => r.person_id));
  const { data: ofAgents } = agents.length ? await admin.from("people").select("id").in("owner_id", agents).eq("stage_group", "transaction").eq("archived", false) : { data: [] };
  for (const p of ofAgents || []) ids.add(p.id);

  const sentLog = [];
  const weekly = new Map(); // agent id -> { owner, tc, deals: [{ data, summary }] }
  const isMonday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "America/Chicago" }) === "Monday";
  for (const id of [...ids].slice(0, 400)) {
    try {
      const data = await gatherDeal(admin, id);
      if (!data || data.deal.archived || !data.owner?.email) continue;
      const tc = data.tcs.find((t) => t.auto);
      if (!tc) continue; // every coordinator on it has turned automatic updates off
      const { data: settings } = await admin.from("people_settings").select("stages").eq("owner_id", data.deal.owner_id).maybeSingle();
      const closedName = settings?.stages?.transaction_closed || "Closed";
      if (String(data.deal.stage).toLowerCase() === String(closedName).toLowerCase()) continue;
      if (data.deal.closing_date && daysAgo(data.deal.closing_date, today) > 2) continue;

      const { data: log } = await admin.from("deal_update_log").select("key").eq("person_id", id);
      const seen = new Set((log || []).map((r) => r.key));
      const { send, handled } = milestonesFor(data, { today, seen, firstSight: seen.size === 0 });
      for (const m of handled) if (!dryRun) await admin.from("deal_update_log").insert({ person_id: id, key: m.key, kind: "milestone" });
      if (send.length) {
        // Everything due today goes out as one email, led by what happened.
        const lead = send.map((m) => m.lead).join(". ");
        const mail = buildAgentUpdate(data, { lead, fromName: tc.full_name || "" });
        const where = data.deal.property_address || data.deal.name;
        if (dryRun) sentLog.push({ deal: where, keys: send.map((m) => m.key), subject: mail.subject });
        else {
          // Claim the milestones first, so an overlapping run can't send the same one twice.
          const { error } = await admin.from("deal_update_log").insert(send.map((m) => ({ person_id: id, key: m.key, kind: "milestone" })));
          if (!error) {
            const ok = await sendNotification(apiKey, { from: FROM(tc.full_name, data.owner?.org?.name), to: [data.owner.email], replyTo: tc.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
            if (!ok) await admin.from("deal_update_log").delete().eq("person_id", id).in("key", send.map((m) => m.key));
            else sentLog.push({ deal: where, keys: send.map((m) => m.key) });
          }
        }
      }
      if (isMonday || req.query?.weekly === "1") {
        const s = summarize(data, today);
        if (s.overdue.length || s.upcomingDates.some((d) => d.days <= 7) || s.flagged.length) {
          const entry = weekly.get(data.deal.owner_id) || { owner: data.owner, tc, deals: [] };
          entry.deals.push({ data, s });
          weekly.set(data.deal.owner_id, entry);
        }
      }
    } catch (err) {
      console.error("deal update failed for", id, err);
    }
  }

  // Monday: one summary per agent, not one email per deal.
  const monday = today;
  for (const [, entry] of weekly) {
    const keyWeek = `weekly-${monday}`;
    const fresh = [];
    for (const d of entry.deals) {
      const { data: row } = await admin.from("deal_update_log").select("key").eq("person_id", d.data.deal.id).eq("key", keyWeek).maybeSingle();
      if (!row) fresh.push(d);
    }
    if (!fresh.length) continue;
    const lines = fresh.flatMap(({ data, s }) => {
      const where = data.deal.property_address || data.deal.name;
      const bits = [
        s.overdue.length ? `${s.overdue.length} overdue task${s.overdue.length === 1 ? "" : "s"}` : "",
        s.flagged.length ? `${s.flagged.length} document${s.flagged.length === 1 ? "" : "s"} flagged by compliance` : "",
        ...s.upcomingDates.filter((d) => d.days <= 7).map((d) => `${d.label.toLowerCase()} ${d.days === 0 ? "today" : d.days === 1 ? "tomorrow" : `in ${d.days} days`}`),
      ].filter(Boolean);
      return [`${where}: ${bits.join(", ")}`];
    });
    const first = entry.owner.full_name?.split(" ")[0] || "there";
    const url = `${SITE_ORIGIN}/dashboard/deals`;
    const subject = `Your deals this week: ${fresh.length} need${fresh.length === 1 ? "s" : ""} a look`;
    const text = [`Hi ${first},`, "", `${entry.tc.full_name || "Your coordinator"} here with this week's summary of your deals:`, "", ...lines.map((l) => `  - ${l}`), "", `Open Deals: ${url}`, "", `Reply to this email to reach ${entry.tc.full_name || "your coordinator"}.`].join("\n");
    const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="max-width:600px;width:100%"><tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Weekly deal summary</div><div style="margin-top:6px;font:600 24px Georgia,serif;color:#1c1a17">${esc(subject)}</div></td></tr><tr><td style="padding:0 6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:14px 18px">${lines.map((l) => `<div style="font:14px/1.6 Arial,sans-serif;color:#1c1a17;padding:3px 0">${esc(l)}</div>`).join("")}</div></td></tr><tr><td style="padding:14px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open Deals</a></td></tr></table></td></tr></table></body></html>`;
    if (dryRun) {
      sentLog.push({ weekly: entry.owner.full_name, deals: fresh.length });
      continue;
    }
    for (const d of fresh) await admin.from("deal_update_log").insert({ person_id: d.data.deal.id, key: keyWeek, kind: "weekly" });
    const ok = await sendNotification(apiKey, { from: FROM(entry.tc.full_name, entry.owner?.org?.name), to: [entry.owner.email], replyTo: entry.tc.email || undefined, subject, text, html });
    if (!ok) for (const d of fresh) await admin.from("deal_update_log").delete().eq("person_id", d.data.deal.id).eq("key", keyWeek);
    else sentLog.push({ weekly: entry.owner.full_name, deals: fresh.length });
  }
  return res.status(200).json({ ok: true, today, checked: ids.size, sent: sentLog });
}

function daysAgo(key, today) {
  return Math.round((new Date(`${today}T12:00:00Z`) - new Date(`${key}T12:00:00Z`)) / 86400000);
}
