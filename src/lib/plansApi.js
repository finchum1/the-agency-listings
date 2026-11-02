import { supabase } from "./supabaseClient";

/** Asks the server to run the signed-in agent's due plan steps now (their dashboard just opened, or they just started a plan). Never throws. */
export async function runMyPlans() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return 0;
    const res = await fetch("/api/plans", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const json = await res.json().catch(() => ({}));
    return json.ran || 0;
  } catch {
    return 0;
  }
}

const centralKey = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const plusKey = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const chunk = (list, n = 150) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

/**
 * Starts a plan for a group: Leads / Pipeline people (`personIds`) and Contacts (`contactIds`). A contact that has a live card goes on the plan through
 * that card (so its drafts land on the card); one without a card goes on as a contact (its steps become to-dos). Anyone already on the plan is left
 * alone; someone who finished or was stopped starts over. Returns { started, already, skipped } where `skipped` says why for each left out.
 */
export async function startPlan(plan, { personIds = [], contactIds = [] }) {
  const result = { started: 0, already: 0, skipped: [] };
  const today = centralKey();
  const fresh = { started_on: today, next_step: 0, next_due: plusKey(today, plan.steps[0]?.day ?? 0), status: "active", stop_reason: "", log: [], expect_stage: null };

  // Which contacts have a card, and which can't be started at all.
  const people = new Set(personIds);
  const contactOnly = [];
  for (const ids of chunk([...new Set(contactIds)])) {
    const [{ data: contacts }, { data: cards }] = await Promise.all([
      supabase.from("contacts").select("id, archived, do_not_contact").in("id", ids),
      supabase.from("people").select("id, contact_id").in("contact_id", ids).eq("archived", false).neq("stage_group", "transaction"),
    ]);
    const cardOf = new Map();
    for (const c of cards || []) if (!cardOf.has(c.contact_id)) cardOf.set(c.contact_id, c.id);
    for (const c of contacts || []) {
      if (c.archived) result.skipped.push("archived");
      else if (c.do_not_contact) result.skipped.push("do not contact");
      else if (cardOf.has(c.id)) people.add(cardOf.get(c.id));
      else contactOnly.push(c.id);
    }
  }

  const targets = [
    ...[...people].map((id) => ({ key: "person_id", id })),
    ...contactOnly.map((id) => ({ key: "contact_id", id })),
  ];
  const existing = [];
  for (const group of ["person_id", "contact_id"]) {
    const ids = targets.filter((t) => t.key === group).map((t) => t.id);
    for (const part of chunk(ids)) {
      const { data } = await supabase.from("plan_enrollments").select("id, person_id, contact_id, status").eq("plan_id", plan.id).in(group, part);
      existing.push(...(data || []));
    }
  }
  const byWho = new Map(existing.map((e) => [e.person_id || e.contact_id, e]));
  const toInsert = [];
  const toRestart = [];
  for (const t of targets) {
    const e = byWho.get(t.id);
    if (!e) toInsert.push({ plan_id: plan.id, [t.key]: t.id, ...fresh });
    else if (e.status === "active" || e.status === "paused") result.already += 1;
    else toRestart.push(e.id);
  }
  for (const part of chunk(toInsert)) {
    const { error } = await supabase.from("plan_enrollments").insert(part);
    if (error) throw new Error(error.message);
    result.started += part.length;
  }
  for (const part of chunk(toRestart)) {
    const { error } = await supabase.from("plan_enrollments").update(fresh).in("id", part);
    if (error) throw new Error(error.message);
    result.started += part.length;
  }
  if (result.started) await runMyPlans();
  return result;
}
