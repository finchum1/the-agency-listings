// A status update on a deal, written for the agent by their transaction coordinator: where it stands, what's coming up, what's overdue or
// missing, and what changed since the last update. The same text goes out whether the coordinator presses the button (api/deal-notify.js)
// or a milestone triggers it (api/deal-updates.js).
import { effectiveDue } from "../../src/lib/checklistDefaults.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const TZ = "America/Chicago";

export const todayKey = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: TZ });
export const daysBetween = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
const nice = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const rel = (key, today) => {
  const d = daysBetween(today, key);
  return d === 0 ? "today" : d === 1 ? "tomorrow" : d === -1 ? "yesterday" : d > 0 ? `in ${d} days` : `${-d} days ago`;
};

export const DATE_LABELS = { contract_date: "Contract", inspection_date: "Inspection", inspection_period_end: "Inspection period ends", appraisal_date: "Appraisal", financing_deadline: "Financing deadline", closing_date: "Closing" };

/** Everything an update needs about one deal, read with the service role. */
export async function gatherDeal(admin, personId) {
  const { data: deal } = await admin.from("people").select("*").eq("id", personId).eq("stage_group", "transaction").maybeSingle();
  if (!deal) return null;
  const [{ data: owner }, { data: tasks }, { data: docs }, { data: sigs }, { data: per }, { data: wide }, { data: last }] = await Promise.all([
    admin.from("profiles").select("id, full_name, email, org:organizations(name)").eq("id", deal.owner_id).maybeSingle(),
    admin.from("transaction_tasks").select("*").eq("person_id", personId).order("position"),
    admin.from("transaction_documents").select("id, text, done, done_at, review_status, review_note").eq("person_id", personId).order("position"),
    admin.from("deal_signatures").select("id, title, status, recipients, completed_at").eq("person_id", personId),
    admin.from("deal_tcs").select("tc:profiles!deal_tcs_tc_id_fkey(id, full_name, email)").eq("person_id", personId),
    admin.from("deal_team").select("tc:profiles!deal_team_tc_id_fkey(id, full_name, email)").eq("agent_id", deal.owner_id),
    admin.from("deal_update_log").select("sent_at").eq("person_id", personId).order("sent_at", { ascending: false }).limit(1),
  ]);
  const tcs = [...new Map([...(per || []), ...(wide || [])].map((r) => r.tc).filter(Boolean).map((t) => [t.id, t])).values()];
  const { data: settings } = tcs.length ? await admin.from("agent_notification_settings").select("agent_id, deal_updates_auto").in("agent_id", tcs.map((t) => t.id)) : { data: [] };
  const off = new Set((settings || []).filter((s) => s.deal_updates_auto === false).map((s) => s.agent_id));
  return { deal, owner, tasks: tasks || [], docs: docs || [], sigs: sigs || [], tcs: tcs.map((t) => ({ ...t, auto: !off.has(t.id) })), lastUpdateAt: last?.[0]?.sent_at || null };
}

/** The numbers and lists behind an update (also used to decide which milestones apply). */
export function summarize(data, today = todayKey()) {
  const { deal, tasks, docs, sigs, lastUpdateAt } = data;
  const dates = { contract_date: deal.contract_date, inspection_date: deal.inspection_date, closing_date: deal.closing_date };
  const open = tasks.filter((t) => !t.done).map((t) => ({ ...t, due: effectiveDue(t, dates) }));
  const upcomingDates = Object.keys(DATE_LABELS).filter((k) => deal[k] && !(deal.is_cash && (k === "appraisal_date" || k === "financing_deadline")) && deal[k] >= today).map((k) => ({ key: k, label: DATE_LABELS[k], date: deal[k], days: daysBetween(today, deal[k]) })).sort((a, b) => a.date.localeCompare(b.date));
  return {
    today,
    overdue: open.filter((t) => t.due && t.due < today).sort((a, b) => a.due.localeCompare(b.due)),
    soon: open.filter((t) => t.due && t.due >= today && daysBetween(today, t.due) <= 7).sort((a, b) => a.due.localeCompare(b.due)),
    tasksDone: tasks.filter((t) => t.done).length,
    tasksTotal: tasks.length,
    docsDone: docs.filter((d) => d.done).length,
    docsTotal: docs.length,
    missing: docs.filter((d) => !d.done),
    flagged: docs.filter((d) => d.review_status === "issue"),
    out: sigs.filter((s) => s.status === "pending" || s.status === "sending"),
    signedSince: sigs.filter((s) => s.status === "completed" && s.completed_at && (!lastUpdateAt || s.completed_at > lastUpdateAt)),
    doneSince: lastUpdateAt ? tasks.filter((t) => t.done && t.done_at && t.done_at > lastUpdateAt) : [],
    upcomingDates,
  };
}

const list = (items, max, fmt) => {
  const shown = items.slice(0, max).map(fmt);
  return items.length > max ? [...shown, `…and ${items.length - max} more`] : shown;
};

/** The update itself: { subject, text, html }. `lead` is a one-line reason ("Heads up: closing is in 2 days"); `note` is the coordinator's own words. */
export function buildAgentUpdate(data, { lead = "", note = "", fromName = "" } = {}) {
  const { deal, owner } = data;
  const s = summarize(data);
  const where = deal.property_address || deal.name;
  const url = `${SITE_ORIGIN}/dashboard/deals?deal=${deal.id}`;
  const stateBits = [`Stage: ${deal.stage}`, deal.compliance_status === "approved" ? "Compliance approved" : deal.compliance_status === "submitted" ? "In compliance review" : deal.compliance_status === "needs_changes" ? "Compliance sent it back" : ""].filter(Boolean);

  const blocks = [];
  if (s.overdue.length) blocks.push({ title: `Overdue tasks (${s.overdue.length})`, lines: list(s.overdue, 6, (t) => `${t.text} (was due ${nice(t.due)})`), tone: "alert" });
  if (s.soon.length) blocks.push({ title: "Tasks due in the next 7 days", lines: list(s.soon, 6, (t) => `${t.text} (${rel(t.due, s.today)})`) });
  if (s.upcomingDates.length) blocks.push({ title: "Coming up", lines: list(s.upcomingDates, 5, (d) => `${d.label}: ${nice(d.date)} (${rel(d.date, s.today)})`) });
  if (s.docsTotal) blocks.push({ title: `Documents (${s.docsDone} of ${s.docsTotal} collected)`, lines: s.missing.length ? list(s.missing, 8, (d) => `Still needed: ${d.text}`) : ["All collected."] });
  if (s.flagged.length) blocks.push({ title: "Flagged by compliance", lines: list(s.flagged, 5, (d) => `${d.text}${d.review_note ? `: ${d.review_note}` : ""}`), tone: "alert" });
  if (s.out.length) blocks.push({ title: "Waiting on signatures", lines: list(s.out, 5, (g) => `${g.title}: ${(g.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.name || r.email).join(", ") || "out for signature"}`) });
  if (s.signedSince.length || s.doneSince.length) {
    blocks.push({ title: "Since the last update", lines: [...s.signedSince.map((g) => `Signed by everyone: ${g.title}`), ...list(s.doneSince, 6, (t) => `Done: ${t.text}`)] });
  }

  const subject = lead ? `${lead}: ${where}` : `Deal update: ${where}`;
  const intro = `${fromName ? `${fromName}'s` : "Your coordinator's"} update on ${where}${deal.property_address ? ` (${deal.name})` : ""}.`;
  const text = [
    `Hi ${(owner?.full_name || "").split(" ")[0] || "there"},`,
    "",
    lead ? `${lead}.` : intro,
    ...(note ? ["", note] : []),
    "",
    stateBits.join(" · "),
    s.tasksTotal ? `Tasks: ${s.tasksDone} of ${s.tasksTotal} done` : "",
    ...blocks.flatMap((b) => ["", `${b.title}:`, ...b.lines.map((l) => `  - ${l}`)]),
    "",
    `Open the deal: ${url}`,
    ...(fromName ? ["", `Reply to this email to reach ${fromName}.`] : []),
  ].filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");

  const block = (b) =>
    `<tr><td style="padding:0 6px 10px"><div style="background:#ffffff;border:1px solid ${b.tone === "alert" ? "#f1c9c6" : "#e4dfd3"};border-radius:14px;padding:14px 18px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:${b.tone === "alert" ? "#b3261e" : "#7a756b"};margin-bottom:6px">${esc(b.title)}</div>${b.lines.map((l) => `<div style="font:14px/1.5 Arial,sans-serif;color:#1c1a17;padding:2px 0">${esc(l)}</div>`).join("")}</div></td></tr>`;
  const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f4ee"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
<tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">${esc(lead || "Deal update")}</div><div style="margin-top:6px;font:600 26px Georgia,serif;color:#1c1a17">${esc(where)}</div><div style="margin-top:4px;font:14px Arial,sans-serif;color:#57534b">${esc(deal.name)} · ${esc(stateBits.join(" · "))}${s.tasksTotal ? ` · Tasks ${s.tasksDone}/${s.tasksTotal}` : ""}</div></td></tr>
${note ? `<tr><td style="padding:0 6px 10px"><div style="background:#ffffff;border:1px solid #e4dfd3;border-radius:14px;padding:14px 18px;font:15px/1.6 Arial,sans-serif;color:#1c1a17;white-space:pre-wrap">${esc(note)}</div></td></tr>` : ""}
${blocks.map(block).join("")}
<tr><td style="padding:14px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#ffffff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Open the deal</a>${fromName ? `<div style="margin-top:10px;font:13px/1.5 Arial,sans-serif;color:#57534b">Replying to this email reaches ${esc(fromName)}.</div>` : ""}</td></tr>
<tr><td style="padding:6px 6px 0;font:12px/1.5 Arial,sans-serif;color:#7a756b">${esc(owner?.org?.name || "")}</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text, html, summary: s };
}

/**
 * Milestones that apply to this deal today: { send, handled }. `send` are worth an email now; `handled` apply but shouldn't be emailed (a
 * looser closing window when a tighter one is sent, or a state that was already true the first time the deal was seen, such as every
 * document being collected, so switching updates on doesn't announce old news). Keys already in `seen` are left out.
 */
export function milestonesFor(data, { today = todayKey(), seen = new Set(), firstSight = false } = {}) {
  const { deal } = data;
  const s = summarize(data, today);
  const dated = [];
  const within = (field, days, key, lead) => {
    const d = deal[field] ? daysBetween(today, deal[field]) : null;
    if (d != null && d >= 0 && d <= days) dated.push({ key, lead: d === 0 ? lead.today : lead.soon(d), tight: days });
  };
  const soon = (name) => ({ today: `${name} is today`, soon: (d) => `${name} is ${d === 1 ? "tomorrow" : `in ${d} days`}` });
  within("closing_date", 2, "closing-2", soon("Closing"));
  within("closing_date", 7, "closing-7", soon("Closing"));
  within("inspection_date", 2, "inspection-2", soon("Inspection"));
  if (!deal.is_cash) {
    within("appraisal_date", 2, "appraisal-2", soon("Appraisal"));
    within("financing_deadline", 2, "financing-2", soon("Financing deadline"));
  }
  const state = [];
  if (s.docsTotal > 0 && s.docsDone === s.docsTotal) state.push({ key: "docs-complete", lead: "All documents are collected" });
  if (deal.compliance_status === "approved" && deal.compliance_updated_at) state.push({ key: `approved-${String(deal.compliance_updated_at).slice(0, 10)}`, lead: "Compliance approved the deal" });

  // Of the two closing windows only the tighter one is emailed; the other counts as handled.
  const closing = dated.filter((m) => m.key.startsWith("closing-")).sort((a, b) => a.tight - b.tight);
  const keepClosing = closing[0]?.key;
  const send = [];
  const handled = [];
  for (const m of dated) {
    if (seen.has(m.key)) continue;
    (m.key.startsWith("closing-") && m.key !== keepClosing ? handled : send).push(m);
  }
  for (const m of state) {
    if (seen.has(m.key)) continue;
    (firstSight ? handled : send).push(m);
  }
  return { send, handled };
}
