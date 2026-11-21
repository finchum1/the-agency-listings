// The one timeline of everything for a contact (or a whole household): notes, calls, texts, emails, meetings and showings the agent logged, texts and calls
// synced from the Mac, notes from their Leads / Pipeline / Deals cards, messages sent from a plan, follow-ups done, deal milestones and plan runs. Pure: the
// panel loads the rows and these turn them into entries, filter them and group them by day or month. An entry is
//   { id, kind, who, title, body, at (ISO), mine?, table?, rawId? }
// `kind` is one of the keys of KINDS; `who` is the first name of a household member when the entry isn't the open contact's own.

export const KINDS = {
  note: { type: "notes", label: "Note" },
  other: { type: "notes", label: "Note" },
  card: { type: "notes", label: "From a Leads / Pipeline card" },
  call: { type: "calls", label: "Call" },
  synced_call: { type: "calls", label: "Call" },
  text: { type: "texts", label: "Text" },
  synced_text: { type: "texts", label: "Text" },
  sent_text: { type: "texts", label: "Text sent" },
  email: { type: "emails", label: "Email" },
  sent_email: { type: "emails", label: "Email sent" },
  sent_call: { type: "calls", label: "Call made" },
  meeting: { type: "meetings", label: "Meeting" },
  showing: { type: "meetings", label: "Showing" },
  task: { type: "tasks", label: "Follow-up done" },
  milestone: { type: "deals", label: "Deal" },
  plan: { type: "deals", label: "Plan" },
};

export const FILTERS = [
  { key: "all", label: "Everything" },
  { key: "calls", label: "Calls" },
  { key: "texts", label: "Texts" },
  { key: "emails", label: "Emails" },
  { key: "meetings", label: "Meetings & showings" },
  { key: "notes", label: "Notes" },
  { key: "tasks", label: "Follow-ups" },
  { key: "deals", label: "Deals & plans" },
];

export const typeOf = (entry) => KINDS[entry.kind]?.type || "notes";

/** How many entries each filter would show (for the chips). */
export function countByFilter(entries) {
  const counts = { all: entries.length };
  for (const f of FILTERS) if (f.key !== "all") counts[f.key] = 0;
  for (const e of entries) counts[typeOf(e)] = (counts[typeOf(e)] || 0) + 1;
  return counts;
}

/** Entries of one type (or all) whose words contain the search text, newest first. */
export function filterEntries(entries, filter = "all", query = "") {
  const q = query.trim().toLowerCase();
  return entries
    .filter((e) => (filter === "all" || typeOf(e) === filter) && (!q || `${e.title || ""} ${e.body || ""} ${e.who || ""}`.toLowerCase().includes(q)))
    .sort((a, b) => String(b.at).localeCompare(String(a.at)));
}

const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** [{ label, items }]: "Today", "Yesterday", then a heading per month ("November 2026"). `entries` must already be newest first. */
export function groupByPeriod(entries, now = new Date()) {
  const today = dayKey(now);
  const yesterday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
  const groups = [];
  for (const e of entries) {
    const d = new Date(e.at);
    const k = dayKey(d);
    const label = k === today ? "Today" : k === yesterday ? "Yesterday" : d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

/** A date with no time ("2026-11-02") as a moment at noon local time, so it sits on that day wherever it is read. */
export const noonOf = (date) => (date ? new Date(`${String(date).slice(0, 10)}T12:00:00`).toISOString() : null);

const snippet = (s, n = 280) => {
  const t = String(s || "").trim();
  return t.length > n ? `${t.slice(0, n).trimEnd()}…` : t;
};

/** A message the agent sent from a plan's draft (a people_outreach row with status "sent"). */
export const sentEntry = (o, who = "") => ({
  id: `o${o.id}`,
  kind: o.channel === "email" ? "sent_email" : o.channel === "call" ? "sent_call" : "sent_text",
  who,
  title: o.subject || "",
  body: snippet(o.body),
  at: o.resolved_at || o.created_at,
});

/** A follow-up the agent finished. */
export const taskEntry = (t, who = "") => ({ id: `t${t.id}`, kind: "task", who, title: t.title, body: "", at: t.done_at || t.last_done_at });

/** What happened to a Leads / Pipeline / Deals card: it was added, and for a deal its contract and closing days once they have passed. */
export function cardEntries(card, who = "", now = new Date()) {
  const place = card.stage_group === "lead" ? "Leads" : card.stage_group === "pipeline" ? "Pipeline" : "Deals";
  const out = [{ id: `a${card.id}`, kind: "milestone", who, title: `Added to ${place}`, body: card.property_address || "", at: card.created_at }];
  if (card.stage_group === "transaction") {
    const past = (d) => d && new Date(noonOf(d)) <= now;
    const addr = card.property_address ? ` · ${card.property_address}` : "";
    if (past(card.contract_date)) out.push({ id: `k${card.id}`, kind: "milestone", who, title: `Under contract${addr}`, body: "", at: noonOf(card.contract_date) });
    if (past(card.closing_date)) out.push({ id: `l${card.id}`, kind: "milestone", who, title: `${card.stage === "Closed" ? "Closed" : "Closing day"}${addr}`, body: "", at: noonOf(card.closing_date) });
  }
  return out.filter((e) => e.at);
}

/** A plan starting, and (when it has ended) finishing or being stopped. */
export function planEntries(en, who = "") {
  const name = en.plan?.name || "a plan";
  const out = [{ id: `s${en.id}`, kind: "plan", who, title: `Started “${name}”`, body: "", at: en.created_at }];
  if (en.status === "done") out.push({ id: `d${en.id}`, kind: "plan", who, title: `Finished “${name}”`, body: "", at: en.updated_at });
  else if (en.status === "stopped") out.push({ id: `x${en.id}`, kind: "plan", who, title: `Stopped “${name}”`, body: en.stop_reason || "", at: en.updated_at });
  return out.filter((e) => e.at);
}
