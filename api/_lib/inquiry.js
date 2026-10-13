// Shared by api/contact.js and api/agent-site-contact.js: input cleaning,
// bot/rate-limit checks, the repeat-contact lookup, and the Resend calls.
// (api/_lib files don't count toward Vercel's Hobby 12-function cap.)

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

async function resendSend(apiKey, payload) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) console.error("Resend API error:", res.status, await res.text());
  return res.ok;
}

// The notification to the agent / brokerage.
export const sendNotification = (apiKey, { from, to, replyTo, subject, text }) =>
  resendSend(apiKey, { from, to, reply_to: replyTo, subject, text });

// A short "we got it" note to the visitor. Never includes anything the
// visitor typed except their first name, so the form can't be used to push
// arbitrary text at someone else's inbox. Failures are logged, not fatal.
export async function sendConfirmation(apiKey, { from, visitor, agentName, agentEmail, about }) {
  try {
    const firstName = visitor.name.split(" ")[0];
    const who = agentName || "our team";
    const senderAddress = (from.match(/<([^>]+)>/) || [])[1] || from;
    const displayName = (agentName || "The Agency").replace(/["<>]/g, "");
    const lines = [
      `Hi ${firstName},`,
      "",
      `Thanks for reaching out! ${who} received your message${about ? ` about ${about}` : ""} and will be in touch shortly.`,
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
