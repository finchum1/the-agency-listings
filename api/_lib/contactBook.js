// The agent's whole Contacts database as the dashboard sees it (src/hooks/useContacts.js): contacts, tags, which boards each person is on, open follow-ups,
// saved smart lists and households. The AI connection (api/_lib/mcpListTools.js) filters it with the SAME code the Contacts page uses
// (src/lib/contacts.js applyFilters), so "the Past Clients list" means exactly what it means on screen. `sb` is the agent's own client (row-level security
// already limits everything to them). One response is capped at 1000 rows, so big tables are read a page at a time.
import { HttpError } from "./bots/util.js";
import { fullName, relationshipLabel } from "../../src/lib/contacts.js";

async function fetchAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw new HttpError(500, error.message);
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

export async function loadContactBook(sb, userId) {
  const [contacts, tagsRes, links, cards, tasks, listsRes, hhRes] = await Promise.all([
    fetchAll(() => sb.from("contacts").select("*").eq("owner_id", userId).order("created_at", { ascending: false }).order("id")),
    sb.from("contact_tags").select("id, name, color").eq("owner_id", userId).order("name"),
    fetchAll(() => sb.from("contact_tag_links").select("contact_id, tag_id").eq("owner_id", userId).order("contact_id").order("tag_id")),
    fetchAll(() => sb.from("people").select("id, contact_id, stage_group, stage, archived").eq("owner_id", userId).not("contact_id", "is", null).eq("archived", false).order("id")),
    fetchAll(() => sb.from("agent_tasks").select("id, contact_id, due_date").eq("owner_id", userId).not("contact_id", "is", null).eq("done", false).order("id")),
    sb.from("contact_smart_lists").select("id, name, filters, position").eq("owner_id", userId).order("position").order("created_at"),
    sb.from("contact_households").select("id, name").eq("owner_id", userId),
  ]);
  for (const r of [tagsRes, listsRes, hhRes]) if (r.error) throw new HttpError(500, r.error.message);
  const tags = tagsRes.data || [];

  const tagsByContact = new Map();
  for (const l of links) tagsByContact.set(l.contact_id, [...(tagsByContact.get(l.contact_id) || []), l.tag_id]);
  const boardsByContact = new Map();
  for (const p of cards) boardsByContact.set(p.contact_id, new Set([...(boardsByContact.get(p.contact_id) || []), p.stage_group]));
  const nextTaskByContact = new Map();
  for (const k of tasks) {
    const d = k.due_date || "9999-12-31";
    if (!nextTaskByContact.has(k.contact_id) || d < (nextTaskByContact.get(k.contact_id) || "9999-12-31")) nextTaskByContact.set(k.contact_id, k.due_date || "");
  }
  const tagById = new Map(tags.map((t) => [t.id, t]));
  return { contacts, tags, tagById, lists: listsRes.data || [], households: hhRes.data || [], ctx: { tagsByContact, boardsByContact, nextTaskByContact, tagById } };
}

/** Plain-words version of what a smart list (or a set of filters) selects. */
export function describeFilters(f, tagById) {
  const parts = [];
  if (f.relationship) parts.push(`relationship is ${relationshipLabel(f.relationship)}`);
  if (f.tags?.length) parts.push(`tagged ${f.tags.map((id) => tagById.get(id)?.name || "(deleted tag)").join(" or ")}`);
  if (f.board) parts.push(f.board === "none" ? "not on any board" : `on the ${f.board === "transaction" ? "Deals" : f.board === "lead" ? "Leads" : "Pipeline"} board`);
  if (f.contacted) parts.push(f.contacted === "never" ? "never contacted" : `not contacted in ${f.contacted}+ days`);
  if (f.followup) parts.push({ overdue: "follow-up overdue", week: "follow-up due this week", none: "no follow-up scheduled" }[f.followup] || `follow-up ${f.followup}`);
  if (f.touch) parts.push("due for a touch");
  if (f.dates) parts.push({ has_birthday: "has a birthday", no_birthday: "no birthday saved", has_anniversary: "has a home anniversary", no_anniversary: "no home anniversary saved" }[f.dates] || f.dates);
  if (f.q) parts.push(`matching "${f.q}"`);
  if (f.archived) parts.push("archived");
  return parts.join(", ") || "everyone";
}

export { fullName };
