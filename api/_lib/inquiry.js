// Shared by api/contact.js and api/agent-site-contact.js: input cleaning,
// bot/rate-limit checks, the repeat-contact lookup, and the Resend calls.
// (api/_lib files don't count toward Vercel's Hobby 12-function cap.)

import { SITE_ORIGIN } from "../../src/lib/seo.js";

const EMAIL_RE = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/;
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

const clean = (v, max) => String(v ?? "").replace(CONTROL_CHARS, "").trim().slice(0, max);
const oneLine = (v, max) => clean(v, max).replace(/\s+/g, " ");

// A hidden honeypot field (`contact_extra`) that real visitors never see, and
// the milliseconds between the form showing and being submitted — bots fill
// the field and/or submit instantly. Either way the request is dropped
// silently with a normal "ok" so the bot learns nothing.
export function parseInquiry(body) {
  const b = body || {};
  if (typeof b.contact_extra === "string" && b.contact_extra.trim()) return { bot: true };
  const elapsed = Number(b.elapsedMs);
  if (Number.isFinite(elapsed) && elapsed < 1500) return { bot: true };

  const data = {
    name: oneLine(b.name, 100),
    email: oneLine(b.email, 254).toLowerCase(),
    phone: oneLine(b.phone, 40),
    message: clean(b.message, 5000),
    address: oneLine(b.address, 200),
  };
  if (!data.name || !data.email) return { error: "Name and email are required." };
  if (!EMAIL_RE.test(data.email)) return { error: "Please enter a valid email address." };
  return { data };
}

// The landing pages (Sellers, Buyers, Home Value) send what the visitor filled in as `details`. Only known fields are kept, each capped, and
// the lot is turned into the readable note that goes in the lead, the alert email and the person's notes.
export const LANDING_PAGES = {
  sellers: { label: "listing consultation request", title: "Listing consultation request" },
  buyers: { label: "buyer wish list", title: "Buyer wish list" },
  home_value: { label: "home value request", title: "Home value request" },
};
const list = (v, max = 12) => (Array.isArray(v) ? v.slice(0, max).map((x) => oneLine(x, 60)).filter(Boolean) : []);

export function describeLanding(page, details, { address, message }) {
  const d = details && typeof details === "object" ? details : {};
  const line = (label, value) => (value ? `${label}: ${value}` : "");
  const lines = [LANDING_PAGES[page].title, line("Property", address)];
  if (page === "home_value") {
    const specs = [d.beds && `${oneLine(d.beds, 10)} bed`, d.baths && `${oneLine(d.baths, 10)} bath`, d.sqft && `${oneLine(d.sqft, 12)} sq ft`].filter(Boolean).join(" · ");
    lines.push(specs, line("Condition", oneLine(d.condition, 40)), line("Thinking of selling", oneLine(d.timeline, 40)));
  } else if (page === "sellers") {
    lines.push(line("Thinking of selling", oneLine(d.timeline, 40)));
  } else if (page === "buyers") {
    lines.push(
      line("Location", list(d.locations).join(", ")),
      line("Home type", list(d.types).join(", ")),
      line("Style", list(d.styles).join(", ")),
      line("Must-haves", clean(d.must_haves, 1000)),
      line("Would love", clean(d.would_love, 1000)),
      line("Deal breakers", clean(d.deal_breakers, 1000)),
      line("Needs to close", oneLine(d.close_by, 60)),
    );
  }
  const body = lines.filter(Boolean).join("\n");
  return message ? `${body}\n\n${message}` : body;
}

const MINUTE = 60 * 1000;
const since = (ms) => new Date(Date.now() - ms).toISOString();

// Per-sender and per-target limits, read from the leads table. Returns
// { limited, duplicate, confirmedRecently }.
//   limited            — 3+ inquiries from this email in the last hour, or
//                        15+ to this one target in 10 minutes
//   duplicate          — same email AND same message within 2 minutes
//                        (a double-click or a retry); accepted but not redone
//   confirmedRecently  — this email already got a confirmation within the hour
export async function checkRate(admin, { targetId, email, message }) {
  const [{ data: mine }, { count: targetCount }] = await Promise.all([
    admin
      .from("leads")
      .select("message, created_at")
      .eq("email", email)
      .gte("created_at", since(60 * MINUTE))
      .order("created_at", { ascending: false })
      .limit(5),
    admin
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("target_id", targetId)
      .gte("created_at", since(10 * MINUTE)),
  ]);
  const recent = mine || [];
  const duplicate = recent.some(
    (l) => l.message === message && Date.now() - new Date(l.created_at).getTime() < 2 * MINUTE,
  );
  return {
    limited: recent.length >= 3 || (targetCount || 0) >= 15,
    duplicate,
    confirmedRecently: recent.length > 0,
  };
}

// Is this email already someone in the agent's People? (Case-insensitive;
// LIKE wildcards in the address are escaped.)
export async function findExistingPerson(admin, agentId, email) {
  if (!agentId) return null;
  const escaped = email.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data } = await admin
    .from("people")
    .select("stage_group, stage, archived")
    .eq("owner_id", agentId)
    .ilike("email", escaped)
    .order("archived")
    .limit(1);
  return data?.[0] || null;
}

const STAGE_GROUP_LABELS = { lead: "Leads", pipeline: "Pipeline", transaction: "Transactions" };
export const describePerson = (p) =>
  `${STAGE_GROUP_LABELS[p.stage_group] || p.stage_group} › ${p.stage}${p.archived ? " (archived)" : ""}`;

// The From line for a system email: the address configured in LEAD_FROM_EMAIL (the one the email service is set up to send from), under a display
// name that says what the email really is. The configured name ("Website Inquiries") is right for a visitor's inquiry and wrong for everything
// else, so a deal email is sent as the person it is from ("Terrence Finchum via The Agency Oklahoma") and replies go to that person.
export function fromAs(displayName, fallback = "The Agency") {
  const raw = process.env.LEAD_FROM_EMAIL || "onboarding@resend.dev";
  const address = (raw.match(/<([^>]+)>/) || [])[1] || raw.trim();
  const name = String(displayName || "").replace(/["<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || fallback;
  return `${name} <${address}>`;
}
export const viaOrg = (person, org) => (person ? (org ? `${person} via ${org}` : person) : org || "");

async function resendSend(apiKey, payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Resend API error:", res.status, await res.text());
  return res.ok;
}

// The notification to the agent / brokerage. `to` is one address or a list; `html` is the formatted version (the plain `text` is
// always sent too, so every mail app has something to show and spam filters see a normal multipart message).
export const sendNotification = (apiKey, { from, to, replyTo, subject, text, html }) =>
  resendSend(apiKey, { from, to, reply_to: replyTo, subject, text, ...(html ? { html } : {}) });

const escapeHtml = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Who gets this agent's lead alert, and where the "open in your dashboard" button goes. The agent's optional second address lives in
// a private table (agent_notification_settings): never on profiles, which are public for agents with a published site. Read with the
// service role; without one (or on any failure) the alert simply goes to the agent's main address as before.
export async function leadAlertContext(admin, agentId, primaryEmail) {
  const to = [primaryEmail];
  let peopleEnabled = false;
  try {
    if (admin && agentId) {
      const [{ data: s }, { data: p }] = await Promise.all([
        admin.from("agent_notification_settings").select("lead_alert_email").eq("agent_id", agentId).maybeSingle(),
        admin.from("profiles").select("people_enabled").eq("id", agentId).maybeSingle(),
      ]);
      const extra = s?.lead_alert_email?.trim();
      if (extra && extra.toLowerCase() !== String(primaryEmail || "").toLowerCase()) to.push(extra);
      peopleEnabled = !!p?.people_enabled;
    }
  } catch (err) {
    console.error("Lead alert settings lookup failed:", err);
  }
  return { to, dashboardUrl: `${SITE_ORIGIN}/dashboard${peopleEnabled ? "/people" : ""}` };
}

// The formatted lead alert. Everything the visitor typed is escaped.
export function renderLeadEmailHtml({ heading, agentName, notice, about, fields, message, dashboardUrl }) {
  const first = escapeHtml((agentName || "").split(" ")[0] || "there");
  const rows = fields
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 16px 6px 0;color:#6b6762;font-size:13px;white-space:nowrap;vertical-align:top">${escapeHtml(label)}</td><td style="padding:6px 0;font-size:15px;color:#1c1a17">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f2ee;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e3dfd8;border-radius:12px">
<tr><td style="padding:28px 28px 8px">
<p style="margin:0 0 4px;font-size:13px;color:#6b6762">Hi ${first},</p>
<h1 style="margin:0 0 4px;font-size:21px;line-height:1.3;color:#1c1a17">${escapeHtml(heading)}</h1>
${about ? `<p style="margin:0;font-size:14px;color:#6b6762">${escapeHtml(about)}</p>` : ""}
</td></tr>
${notice ? `<tr><td style="padding:8px 28px 0"><div style="background:#fbf3e4;border:1px solid #efdcb4;border-radius:8px;padding:10px 12px;font-size:14px;color:#6a4b10">${escapeHtml(notice)}</div></td></tr>` : ""}
<tr><td style="padding:12px 28px 0"><table role="presentation" cellspacing="0" cellpadding="0">${rows}</table></td></tr>
<tr><td style="padding:12px 28px 4px"><div style="background:#f7f5f1;border-radius:8px;padding:14px 16px;font-size:15px;line-height:1.55;color:#1c1a17;white-space:pre-wrap">${escapeHtml(message || "(no message)")}</div></td></tr>
<tr><td style="padding:20px 28px 8px"><a href="${escapeHtml(dashboardUrl)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 22px;border-radius:99px">Open in your dashboard</a></td></tr>
<tr><td style="padding:8px 28px 26px;font-size:13px;line-height:1.5;color:#6b6762">Just reply to this email to answer them directly.</td></tr>
</table></td></tr></table></body></html>`;
}

// A short "we got it" note to the visitor. Never includes anything the
// visitor typed except their first name, so the form can't be used to push
// arbitrary text at someone else's inbox. Failures are logged, not fatal.
export async function sendConfirmation(apiKey, { from, visitor, agentName, agentEmail, about, when }) {
  try {
    const firstName = visitor.name.split(" ")[0];
    const who = agentName || "our team";
    const senderAddress = (from.match(/<([^>]+)>/) || [])[1] || from;
    const displayName = (agentName || "The Agency").replace(/["<>]/g, "");
    const lines = [
      `Hi ${firstName},`,
      "",
      `Thanks for reaching out! ${who} received your message${about ? ` about ${about}` : ""} and will be in touch ${when || "shortly"}.`,
      "",
      agentEmail ? "If you need anything sooner, just reply to this email." : "",
      "",
      `— ${who}`,
    ];
    return await resendSend(apiKey, {
      from: `${displayName} <${senderAddress}>`,
      to: visitor.email,
      ...(agentEmail ? { reply_to: agentEmail } : {}),
      subject: `We got your message${agentName ? ` — ${agentName}` : ""}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.error("Confirmation email failed:", err);
    return false;
  }
}
