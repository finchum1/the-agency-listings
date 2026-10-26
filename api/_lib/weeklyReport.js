// The weekly listing report email: last 7 days against the 7 before, where visitors came from, and what they did. It goes to the
// listing's agent (who can forward the seller report link from the dashboard); it is never sent to a seller directly.
import { sourceLabel } from "../../src/lib/listingAnalytics.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtTime = (s) => (s == null ? "–" : s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);
const pct = (n, of) => (of > 0 ? Math.round((n / of) * 100) : 0);

/** week = listing_analytics(id, 7), two = listing_analytics(id, 14): the week before is the two-week daily total minus this week's. */
export function summarize(week, two) {
  const daily = two?.daily || [];
  const prior = daily.slice(0, Math.max(0, daily.length - 7)).reduce((n, d) => n + d.views, 0);
  const change = prior > 0 ? Math.round(((week.views - prior) / prior) * 100) : null;
  return { views: week.views, visitors: week.visitors, priorViews: prior, change, avg: week.avg_duration, leads: week.leads };
}

export function buildWeeklyEmail({ listing, agentName, orgName, week, two, dashboardUrl }) {
  const s = summarize(week, two);
  const e = week.engagement || {};
  const tracked = week.tracked_views || 0;
  const top = (week.sources || []).slice(0, 3);
  const city = (week.locations || [])[0];
  // A percentage off a handful of views is noise ("+2186%"), so small weeks are described with the number instead.
  const small = s.priorViews < 10;
  const dir = s.views > s.priorViews ? "up" : s.views < s.priorViews ? "down" : "same";
  const arrow = s.change == null && s.priorViews === 0 ? (s.views > 0 ? "first week of visits" : "") : dir === "same" ? "same as last week" : small ? `${dir} from ${s.priorViews} last week` : `${dir} ${Math.abs(s.change)}% from last week`;
  const subject = `Weekly report: ${listing.address_line1}, ${s.views} view${s.views === 1 ? "" : "s"}${small || s.change == null ? "" : ` (${s.change >= 0 ? "+" : ""}${s.change}%)`}`;

  const lines = [
    `Hi ${agentName.split(" ")[0] || "there"}, here's how ${listing.address_line1} did online this past week.`,
    "",
    `Views: ${s.views}${arrow ? ` (${arrow})` : ""}`,
    `Unique visitors: ${s.visitors}`,
    `Average time on the page: ${fmtTime(s.avg)}`,
    `Inquiries: ${s.leads}`,
  ];
  if (top.length) lines.push("", "Where they came from:", ...top.map((x) => `  ${sourceLabel(x.source)}: ${x.views}`));
  if (city) lines.push("", `Top city: ${[city.city, city.region].filter(Boolean).join(", ")}`);
  if (tracked > 0) lines.push("", `${pct(e.gallery_opens || 0, tracked)}% opened the photos, ${e.video_gallery || e.video_plays ? `${pct(e.video_plays || 0, tracked)}% played the video, ` : ""}${e.phone_clicks || 0} tapped your phone number, ${e.form_starts || 0} started the inquiry form.`);
  if (s.views === 0) lines.push("", "No visits yet this week. Share the listing's tagged links from its Analytics page to get it in front of people.");
  lines.push("", `Open the full report, or send your seller their private link: ${dashboardUrl}`, "", "You get this because weekly reports are on for this listing. Turn them off on the listing's Analytics page.");
  const text = lines.join("\n");

  const tile = (label, value, note) =>
    `<td style="width:25%;padding:6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:16px 14px"><div style="font:600 26px Georgia,serif;color:#1c1a17">${esc(value)}</div><div style="margin-top:4px;font:600 10px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a756b">${esc(label)}</div>${note ? `<div style="margin-top:4px;font:12px Arial,sans-serif;color:#7a756b">${esc(note)}</div>` : ""}</div></td>`;
  const sourceRows = top
    .map((x) => `<tr><td style="padding:5px 0;font:14px Arial,sans-serif;color:#1c1a17">${esc(sourceLabel(x.source))}</td><td style="padding:5px 0;text-align:right;font:14px Arial,sans-serif;color:#57534b">${x.views} · ${pct(x.views, s.views)}%</td></tr>`)
    .join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Weekly report</div><div style="margin-top:6px;font:600 28px Georgia,serif;color:#1c1a17">${esc(listing.address_line1)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(listing.city || "")}${arrow ? ` · views ${esc(arrow)}` : ""}</div></td></tr>
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tile("Views", s.views)}${tile("Visitors", s.visitors)}${tile("Avg. time", fmtTime(s.avg))}${tile("Inquiries", s.leads)}</tr></table></td></tr>
${top.length ? `<tr><td style="padding:12px 6px 0"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:16px 18px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a756b;margin-bottom:6px">Where they came from</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${sourceRows}</table>${city ? `<div style="margin-top:10px;font:13px Arial,sans-serif;color:#57534b">Top city: ${esc([city.city, city.region].filter(Boolean).join(", "))}</div>` : ""}</div></td></tr>` : ""}
${tracked > 0 ? `<tr><td style="padding:12px 6px 0"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:16px 18px;font:14px/1.6 Arial,sans-serif;color:#1c1a17">${pct(e.gallery_opens || 0, tracked)}% opened the photos · ${e.phone_clicks || 0} tapped your phone number · ${e.form_starts || 0} started the inquiry form</div></td></tr>` : ""}
${s.views === 0 ? `<tr><td style="padding:12px 6px 0"><div style="background:#fff7f6;border:1px solid #f1c9c6;border-radius:14px;padding:16px 18px;font:14px/1.6 Arial,sans-serif;color:#1c1a17">No visits yet this week. Share the listing's tagged links from its Analytics page to get it in front of people.</div></td></tr>` : ""}
<tr><td style="padding:20px 6px"><a href="${esc(dashboardUrl)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the full report</a><div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">From there you can create the private link to send ${esc("your seller")}.</div></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">You get this because weekly reports are on for this listing. Turn them off any time on the listing's Analytics page. ${esc(orgName || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
