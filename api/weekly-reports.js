// The weekly listing report email (see supabase/people-module.sql section 38 and api/_lib/weeklyReport.js).
//   GET  /api/weekly-reports            run by the Vercel cron (vercel.json) every morning: emails each listing's agent a report for
//                                       the listings that have weekly reports turned on, on the weekday that agent picked
//                                       (profiles.weekly_report_day, Monday unless they changed it; Central time). If CRON_SECRET is
//                                       set, the call must carry it. Either way a listing is never emailed twice within 6 days.
//   POST /api/weekly-reports {listingId} the listing's own agent (or an admin) asking for this week's report right now.
//                                       Signed in; the email goes to the listing's agent; it doesn't count as the weekly one.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { fromAs, sendNotification } from "./_lib/inquiry.js";
import { buildWeeklyEmail } from "./_lib/weeklyReport.js";
import { weeklyReportToken } from "./_lib/reportLink.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

const SENDABLE = ["coming_soon", "for_sale", "pending"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// The org's logo for the email: the one-color black version when there is one (the email background is light), else its main logo.
function logoFor(org) {
  const logos = org?.brand?.logos || {};
  const path = logos.black || logos[org?.brand?.default_logo] || Object.values(logos)[0];
  if (!path) return "";
  return /^https?:\/\//i.test(path) ? path : `${SITE_ORIGIN}${path.startsWith("/") ? "" : "/"}${path}`;
}

async function emailFor(admin, listing, { dryRun } = {}) {
  const [{ data: agent }, { data: week }, { data: two }] = await Promise.all([
    admin.from("profiles").select("full_name, email, org:organizations(name, brand)").eq("id", listing.agent_id).maybeSingle(),
    admin.rpc("listing_analytics", { p_listing_id: listing.id, p_days: 7 }),
    admin.rpc("listing_analytics", { p_listing_id: listing.id, p_days: 14 }),
  ]);
  if (!agent?.email || !week) return { skipped: "no agent email or no data" };
  // The button goes to the public seller report page, not the dashboard: not every agent has a login, and the agent forwards this link.
  const token = dryRun ? "(a private link is made when it sends)" : await weeklyReportToken(admin, listing);
  if (!token) return { skipped: "couldn't make the report link" };
  const mail = buildWeeklyEmail({ listing, agentName: agent.full_name || "", orgName: agent.org?.name, logoUrl: logoFor(agent.org), week, two, reportUrl: `${SITE_ORIGIN}/report/${token}` });
  if (dryRun) return { ...mail, to: agent.email };
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { skipped: "email isn't configured" };
  const ok = await sendNotification(apiKey, { from: fromAs("Listing Reports", "The Agency", "reports"), to: [agent.email], subject: mail.subject, text: mail.text, html: mail.html });
  return ok ? { sent: true } : { skipped: "the email service refused it" };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "GET") {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
    let admin;
    try {
      admin = serviceClient();
    } catch {
      return res.status(500).json({ error: "Server not configured." });
    }
    const cutoff = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();
    const { data: due } = await admin
      .from("listings")
      .select("id, org_id, agent_id, address_line1, city, status, weekly_report_sent_at, agent:profiles(weekly_report_day)")
      .eq("weekly_report", true)
      .in("status", SENDABLE)
      .or(`weekly_report_sent_at.is.null,weekly_report_sent_at.lt.${cutoff}`)
      .limit(300);
    // Today's weekday in Central time (the cron fires at 14:00 UTC, mid-morning there).
    const today = WEEKDAYS.indexOf(new Date().toLocaleDateString("en-US", { weekday: "short", timeZone: "America/Chicago" }));
    const dueToday = (due || []).filter((l) => (l.agent?.weekly_report_day ?? 1) === today);
    let sent = 0;
    let skipped = 0;
    for (const listing of dueToday) {
      try {
        const r = await emailFor(admin, listing);
        if (r.sent) {
          sent += 1;
          await admin.from("listings").update({ weekly_report_sent_at: new Date().toISOString() }).eq("id", listing.id);
        } else skipped += 1;
      } catch (err) {
        skipped += 1;
        console.error("weekly report failed:", listing.id, err);
      }
    }
    return res.status(200).json({ due: dueToday.length, sent, skipped });
  }

  if (req.method === "POST") {
    const auth = await authenticate(req, res);
    if (!auth) return;
    const id = String(req.body?.listingId || "");
    const { data: listing } = await auth.supabase.from("listings").select("id, org_id, agent_id, address_line1, city, status").eq("id", id).maybeSingle();
    if (!listing) return res.status(404).json({ error: "Listing not found." });
    const { data: me } = await auth.supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
    if (listing.agent_id !== auth.user.id && me?.role !== "admin") return res.status(403).json({ error: "That isn't your listing." });
    const r = await emailFor(serviceClient(), listing, { dryRun: req.body?.dryRun === true && me?.role === "admin" });
    if (r.skipped) return res.status(502).json({ error: `Couldn't send it: ${r.skipped}.` });
    return res.status(200).json(r.sent ? { ok: true } : { ok: true, preview: { subject: r.subject, to: r.to, html: r.html } });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
}
