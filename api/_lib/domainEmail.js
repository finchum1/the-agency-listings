// The email sent when a property site's custom domain stops responding, or comes back (api/_lib/domainCheck.js).
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const FIX = {
  no_dns: "Check the domain's DNS records at the registrar. The domain may have expired, or its records may have been changed or removed.",
  not_attached: "Add the domain to the Vercel project (Settings, then Domains). The DNS is pointed at Vercel but Vercel doesn't know which project it belongs to.",
  elsewhere: "Check where the domain's DNS now points. It should point at Vercel, and may have been moved to another host or a parking page.",
  tls: "Vercel is usually still issuing the certificate. If it doesn't clear within an hour, check the domain in the Vercel project.",
  timeout: "This is often temporary. You'll get another email when it answers again.",
  unreachable: "This is often temporary. You'll get another email when it answers again.",
};

const since = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "");
const where = (l) => (l ? `${l.address_line1}${l.city ? `, ${l.city}` : ""}${l.agent?.full_name ? ` (${l.agent.full_name})` : ""}` : "");

export function buildDomainAlertEmail({ down, back, url }) {
  const subject = down.length === 1 ? `Domain not responding: ${down[0].domain}` : down.length > 1 ? `${down.length} property site domains aren't responding` : back.length === 1 ? `Back online: ${back[0].domain}` : `${back.length} property site domains are back online`;
  const text = [
    ...(down.length ? ["These property site domains were working and have stopped responding:", ""] : []),
    ...down.flatMap((d) => [`${d.domain}`, `  ${where(d.listing)}`, `  ${d.label}`, `  ${FIX[d.status] || ""}`, ""]),
    ...(back.length ? ["These domains are back online:", ""] : []),
    ...back.flatMap((d) => [`${d.domain}`, `  ${where(d.listing)}`, d.down_since ? `  It had been down since ${since(d.down_since)} (Central).` : "", ""]),
    `See all of your property sites: ${url}`,
    "",
    "You get this because domain alerts are on in My Profile.",
  ].join("\n");
  const card = (d, good) =>
    `<tr><td style="padding:0 6px 12px"><div style="background:#ffffff;border:1px solid ${good ? "#cfe8d9" : "#f1c9c6"};border-radius:14px;padding:16px 18px"><div style="font:600 17px Georgia,serif;color:#1c1a17">${esc(d.domain)}</div><div style="margin-top:2px;font:13px Arial,sans-serif;color:#57534b">${esc(where(d.listing))}</div>${
      good
        ? `<div style="margin-top:8px;font:14px/1.5 Arial,sans-serif;color:#1c1a17">Responding again.${d.down_since ? ` It had been down since ${esc(since(d.down_since))} (Central).` : ""}</div>`
        : `<div style="margin-top:8px;font:14px/1.5 Arial,sans-serif;color:#b3261e;font-weight:600">${esc(d.label)}</div><div style="margin-top:4px;font:14px/1.5 Arial,sans-serif;color:#1c1a17">${esc(FIX[d.status] || "")}</div>`
    }</div></td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Domain alert</div><div style="margin-top:6px;font:600 24px Georgia,serif;color:#1c1a17">${esc(subject)}</div></td></tr>
${down.length ? `<tr><td style="padding:0 6px 10px;font:14px Arial,sans-serif;color:#57534b">These property site domains were working and have stopped responding.</td></tr>${down.map((d) => card(d, false)).join("")}` : ""}
${back.length ? `<tr><td style="padding:6px 6px 10px;font:14px Arial,sans-serif;color:#57534b">Back online:</td></tr>${back.map((d) => card(d, true)).join("")}` : ""}
<tr><td style="padding:12px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">See all property sites</a></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">You get this because domain alerts are on in My Profile.</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
