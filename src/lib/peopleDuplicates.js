// Repeated people on the Leads and Pipeline boards: the same rules as repeated contacts (a shared email, a shared phone number, or the same first and last
// name; lib/contacts.js duplicateGroups), over both boards together, since the same person is often a lead and a pipeline card.
import { duplicateGroups } from "./contacts.js";

const split = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] || "", last: parts.slice(1).join(" ") };
};

/** Groups of repeated people: [{ id, reasons, members: [people rows] }], strongest match first. Deals and archived people are left out. */
export function personDuplicateGroups(people) {
  const live = people.filter((p) => !p.archived && (p.stage_group === "lead" || p.stage_group === "pipeline"));
  const asContacts = live.map((p) => {
    const n = split(p.name);
    return { id: p.id, first_name: n.first, last_name: n.last, email: p.email || "", other_emails: [], phone: p.phone || "", other_phones: [], archived: false };
  });
  const byId = new Map(live.map((p) => [p.id, p]));
  return duplicateGroups(asContacts).map((g) => ({ id: g.id, reasons: g.reasons, members: g.members.map((m) => byId.get(m.id)).filter(Boolean) }));
}

/** The one to keep: the most filled in, a pipeline person over a lead, then the oldest. */
export function bestPersonToKeep(members) {
  const score = (p) => ["email", "phone", "source", "property_address", "next_follow_up"].filter((k) => p[k]).length + (p.stage_group === "pipeline" ? 1 : 0);
  return [...members].sort((a, b) => score(b) - score(a) || String(a.created_at).localeCompare(String(b.created_at)))[0];
}
