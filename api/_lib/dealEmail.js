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

const dateText = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "");

// "<agent> picked you to coordinate this deal." No price or commission: just what a coordinator needs to find it and start.
export function buildTcAssignedEmail({ deal, agentName, tcName, orgName, url }) {
  const title = deal.property_address || deal.name;
  const subject = `${agentName || "An agent"} picked you as coordinator: ${title}`;
  const facts = [
    deal.property_address ? ["Property", deal.property_address] : null,
    ["Client", deal.name],
    deal.side ? ["Side", deal.side === "buyer" ? "Buyer" : "Seller"] : null,
    deal.contract_date ? ["Contract date", dateText(deal.contract_date)] : null,
    deal.closing_date ? ["Closing", dateText(deal.closing_date)] : null,
  ].filter(Boolean);
  const text = [
    `Hi ${(tcName || "").split(" ")[0] || "there"}, ${agentName || "an agent"} picked you to coordinate a deal.`,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    "",
    `Open it in Deals: ${url}`,
    "",
    `Replying to this email reaches ${agentName || "them"}.`,
  ].join("\n");
  const rows = facts.map(([k, v]) => `<tr><td style="padding:6px 0;width:130px;font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a756b">${esc(k)}</td><td style="padding:6px 0;font:15px Arial,sans-serif;color:#1c1a17">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">New deal to coordinate</div><div style="margin-top:6px;font:600 26px Georgia,serif;color:#1c1a17">${esc(title)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(agentName || "An agent")} picked you as the transaction coordinator.</div></td></tr>
<tr><td style="padding:0 6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:12px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></div></td></tr>
<tr><td style="padding:20px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the deal</a><div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">Replying to this email reaches ${esc(agentName || "them")}.</div></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(orgName || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// "<agent> has a deal ready for review." Sent to the office's compliance reviewers when a deal is submitted or resubmitted.
export function buildSubmittedEmail({ deal, agentName, submitterName, note, resubmitted, progress, orgName, url }) {
  const title = deal.property_address || deal.name;
  const byTc = submitterName && agentName && submitterName !== agentName;
  const subject = `${resubmitted ? "Resubmitted" : "Ready for review"}: ${title}${agentName ? ` (${agentName})` : ""}`;
  const facts = [
    deal.property_address ? ["Property", deal.property_address] : null,
    ["Client", deal.name],
    agentName ? ["Agent", agentName] : null,
    deal.side ? ["Side", deal.side === "buyer" ? "Buyer" : "Seller"] : null,
    deal.closing_date ? ["Closing", dateText(deal.closing_date)] : null,
    progress ? ["Checklists", progress] : null,
  ].filter(Boolean);
  const lead = `${byTc ? `${submitterName}, coordinating for ${agentName},` : agentName || "An agent"} ${resubmitted ? "resubmitted" : "submitted"} a deal for compliance review.`;
  const text = [lead, "", ...facts.map(([k, v]) => `${k}: ${v}`), ...(note ? ["", `Note: ${note}`] : []), "", `Review it in Deals: ${url}`, "", `Replying to this email reaches ${submitterName || "them"}.`].join("\n");
  const rows = facts.map(([k, v]) => `<tr><td style="padding:6px 0;width:130px;font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a756b">${esc(k)}</td><td style="padding:6px 0;font:15px Arial,sans-serif;color:#1c1a17">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">${resubmitted ? "Resubmitted for review" : "Ready for compliance review"}</div><div style="margin-top:6px;font:600 26px Georgia,serif;color:#1c1a17">${esc(title)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(lead)}</div></td></tr>
<tr><td style="padding:0 6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:12px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></div></td></tr>
${note ? `<tr><td style="padding:12px 6px 0"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:14px 20px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#7a756b;margin-bottom:6px">Note from ${esc(submitterName || "the agent")}</div><div style="font:15px/1.6 Arial,sans-serif;color:#1c1a17;white-space:pre-wrap">${esc(note)}</div></div></td></tr>` : ""}
<tr><td style="padding:20px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Review the deal</a><div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">Replying to this email reaches ${esc(submitterName || "them")}.</div></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(orgName || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}

// "<coordinator> started a deal for you." Sent to the agent when a transaction coordinator creates a deal on their board.
export function buildDealStartedEmail({ deal, tcName, agentName, orgName, url }) {
  const title = deal.property_address || deal.name;
  const who = tcName || "Your coordinator";
  const subject = `${who} started a deal for you: ${title}`;
  const facts = [
    deal.property_address ? ["Property", deal.property_address] : null,
    ["Client", deal.name],
    deal.side ? ["Side", deal.side === "buyer" ? "Buyer" : "Seller"] : null,
    deal.contract_date ? ["Contract date", dateText(deal.contract_date)] : null,
    deal.closing_date ? ["Closing", dateText(deal.closing_date)] : null,
  ].filter(Boolean);
  const text = [
    `Hi ${(agentName || "").split(" ")[0] || "there"}, ${who} started a deal for you and is coordinating it.`,
    "",
    ...facts.map(([k, v]) => `${k}: ${v}`),
    "",
    `It's on your Deals board: ${url}`,
    "",
    `Replying to this email reaches ${who}.`,
  ].join("\n");
  const rows = facts.map(([k, v]) => `<tr><td style="padding:6px 0;width:130px;font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#7a756b">${esc(k)}</td><td style="padding:6px 0;font:15px Arial,sans-serif;color:#1c1a17">${esc(v)}</td></tr>`).join("");
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">New deal on your board</div><div style="margin-top:6px;font:600 26px Georgia,serif;color:#1c1a17">${esc(title)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(who)} started this deal for you and is coordinating it.</div></td></tr>
<tr><td style="padding:0 6px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:12px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></div></td></tr>
<tr><td style="padding:20px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the deal</a><div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">Replying to this email reaches ${esc(who)}. You can change anything on the deal, or remove the coordinator from it.</div></td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(orgName || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html };
}
