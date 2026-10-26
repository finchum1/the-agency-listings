// The email sent when compliance sends a deal back (api/deal-notify.js).
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

export function buildSentBackEmail({ deal, reviewerName, message, orgName, url }) {
  const title = deal.property_address || deal.name;
  const subject = `Compliance sent back: ${title}`;
  const who = reviewerName || "Compliance";
  const text = [
    `${who} reviewed ${title}${deal.property_address ? ` (${deal.name})` : ""} and sent it back.`,
    "",
    message,
    "",
    `Fix what they flagged, then press Resubmit on the deal: ${url}`,
    "",
    "You can reply to this email to reach them.",
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Sent back by compliance</div><div style="margin-top:6px;font:600 26px Georgia,serif;color:#1c1a17">${esc(title)}</div>${deal.property_address ? `<div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(deal.name)}</div>` : ""}</td></tr>
<tr><td style="padding:0 6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:18px 20px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a756b;margin-bottom:8px">From ${esc(who)}</div><div style="font:15px/1.6 Arial,sans-serif;color:#1c1a17;white-space:pre-wrap">${esc(message)}</div></div></td></tr>
<tr><td style="padding:20px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the deal</a><div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">Fix what they flagged, then press Resubmit. Replying to this email reaches ${esc(who)}.</div></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(orgName || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
