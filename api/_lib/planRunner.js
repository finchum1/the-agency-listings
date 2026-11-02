// Runs the steps of follow-up plans (see src/lib/plans.js and supabase/lead-response-plans.sql). Called by the schedule (api/plans.js), by the
// dashboard when it opens, and right after a website inquiry arrives, so the first steps of a plan happen within moments of a new lead.
// A step is CLAIMED (the enrollment's next_step moves on) before it runs, so two runners at once can't do the same step twice.
import { BOARDS } from "../../src/lib/peopleStages.js";
import { DEFAULT_OCCASION_RELATIONSHIPS, OCCASIONS, mergeContext, occasionContext, renderTemplate } from "../../src/lib/plans.js";
import { cleanList, newStepId } from "../../src/lib/taskLists.js";

const centralDay = (d = new Date()) => d.toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const plusDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const MAX_STEPS_PER_RUN = 10;
const MAX_DRAFTS_PER_PERSON = 10;

async function stageNames(admin, ownerId, group) {
  const { data } = await admin.from("people_settings").select("stages").eq("owner_id", ownerId).maybeSingle();
  const custom = data?.stages?.[group];
  return Array.isArray(custom) && custom.length ? custom : [...BOARDS[group].stages];
}

// One step. Returns what happened, as a short line for the plan's log.
async function doStep(admin, enrollment, plan, person, owner, step) {
  const ctx = mergeContext(person, owner);
  const today = centralDay();
  if (step.type === "task") {
    const title = renderTemplate(step.title, ctx) || `Follow up with ${person.name}`;
    const { error } = await admin.from("agent_tasks").insert({ owner_id: enrollment.owner_id, title: title.slice(0, 300), due_date: today, list: cleanList(plan.name), contact_id: person.contact_id || null });
    return error ? `couldn't add the to-do: ${error.message}` : `to-do added: ${title}`;
  }
  if (step.type === "draft") {
    if (step.channel === "email" && !person.email) return "skipped: no email on file";
    if (step.channel !== "email" && !person.phone) return "skipped: no phone number on file";
    if (person.contact_id) {
      const { data: c } = await admin.from("contacts").select("do_not_contact").eq("id", person.contact_id).maybeSingle();
      if (c?.do_not_contact) return "skipped: marked do not contact";
    }
    const { count } = await admin.from("people_outreach").select("id", { count: "exact", head: true }).eq("person_id", person.id).eq("status", "draft");
    if ((count || 0) >= MAX_DRAFTS_PER_PERSON) return "skipped: too many drafts waiting";
    const body = renderTemplate(step.body, ctx);
    if (!body) return "skipped: the message came out empty";
    const { error } = await admin.from("people_outreach").insert({
      person_id: person.id,
      owner_id: enrollment.owner_id,
      channel: step.channel,
      subject: step.channel === "email" ? renderTemplate(step.subject, ctx).slice(0, 200) : "",
      body: body.slice(0, 5000),
      drafted_by: `Plan: ${plan.name}`.slice(0, 80),
    });
    return error ? `couldn't write the draft: ${error.message}` : `${step.channel} draft written`;
  }
  if (step.type === "move") {
    const names = await stageNames(admin, enrollment.owner_id, step.group);
    if (!names.includes(step.stage)) return `skipped: no “${step.stage}” column on the ${step.group} board`;
    if (person.stage_group === step.group && person.stage === step.stage) return "already there";
    await admin.from("plan_enrollments").update({ expect_stage: step.stage }).eq("id", enrollment.id);
    const { error } = await admin.from("people").update({ stage_group: step.group, stage: step.stage }).eq("id", person.id);
    return error ? `couldn't move them: ${error.message}` : `moved to ${step.stage}`;
  }
  return `skipped: unknown step type ${step.type}`;
}

async function runOne(admin, enrollment, today) {
  const plan = enrollment.plan;
  const steps = Array.isArray(plan?.steps) ? plan.steps : [];
  const stop = (reason) => admin.from("plan_enrollments").update({ status: "stopped", stop_reason: reason }).eq("id", enrollment.id).eq("status", "active");
  const [{ data: person }, { data: owner }] = await Promise.all([
    admin.from("people").select("id, owner_id, name, email, phone, source, property_address, stage_group, stage, archived, contact_id").eq("id", enrollment.person_id).maybeSingle(),
    admin.from("profiles").select("full_name, phone").eq("id", enrollment.owner_id).maybeSingle(),
  ]);
  if (!person || person.owner_id !== enrollment.owner_id) return stop("Person not found");
  if (person.archived) return stop("Archived");
  if (person.stage_group === "transaction") return stop("Became a deal");

  // Which steps are due now: those whose day has come, in order, a few at a time.
  const first = enrollment.next_step;
  let last = first;
  while (last < steps.length && last - first < MAX_STEPS_PER_RUN && plusDays(enrollment.started_on, steps[last].day) <= today) last++;
  if (last === first) return 0;

  // Claim them before doing them.
  const finished = last >= steps.length;
  const { data: claimed } = await admin
    .from("plan_enrollments")
    .update({ next_step: last, next_due: finished ? null : plusDays(enrollment.started_on, steps[last].day), status: finished ? "done" : "active" })
    .eq("id", enrollment.id)
    .eq("next_step", first)
    .eq("status", "active")
    .select("id");
  if (!claimed?.length) return 0;

  const log = [...(enrollment.log || [])];
  for (let i = first; i < last; i++) {
    let result;
    try {
      result = await doStep(admin, enrollment, plan, person, owner, steps[i]);
    } catch (err) {
      result = `failed: ${String(err.message || err).slice(0, 120)}`;
    }
    log.push({ at: new Date().toISOString(), step: i, type: steps[i].type, result });
  }
  await admin.from("plan_enrollments").update({ log: log.slice(-40) }).eq("id", enrollment.id);
  return last - first;
}

// ---- birthday / home anniversary plans: run on contacts, once a year each ----
const MAX_CONTACTS_PER_DAY = 40; // more than this on one date is almost surely a placeholder date from an import, not real birthdays

async function runOccasionPlan(admin, plan, owner, today) {
  const kind = plan.starts_when.type;
  const occ = OCCASIONS[kind];
  const ahead = Number(plan.starts_when.ahead) || 0;
  const on = plusDays(today, ahead);
  const { data: found, error } = await admin.rpc("plans_due_occasions", { p_owner: plan.owner_id, p_kind: kind, p_on: on });
  if (error) throw new Error(error.message);
  const rels = Array.isArray(plan.starts_when.relationships) && plan.starts_when.relationships.length ? plan.starts_when.relationships : DEFAULT_OCCASION_RELATIONSHIPS;
  const yearsOf = (c) => Number(on.slice(0, 4)) - Number(String(c.occasion_date).slice(0, 4));
  const due = (found || []).filter((c) => rels.includes(c.relationship) && (kind === "birthday" || yearsOf(c) >= 1));
  if (!due.length) return 0;
  if (due.length > MAX_CONTACTS_PER_DAY) {
    const title = `${plan.name}: ${due.length} contacts share a ${occ.noun} on ${on}, so it was skipped. Check for placeholder dates.`.slice(0, 300);
    const { count } = await admin.from("agent_tasks").select("id", { count: "exact", head: true }).eq("owner_id", plan.owner_id).eq("title", title).eq("due_date", today);
    if (!count) await admin.from("agent_tasks").insert({ owner_id: plan.owner_id, title, due_date: today, list: cleanList(plan.name) });
    return 0;
  }
  // Claim each contact for this year's occasion before doing anything, so two runners can't both act on it.
  const { data: claimed, error: claimErr } = await admin
    .from("plan_occasion_runs")
    .upsert(due.map((c) => ({ plan_id: plan.id, contact_id: c.contact_id, owner_id: plan.owner_id, occasion_on: on })), { onConflict: "plan_id,contact_id,occasion_on", ignoreDuplicates: true })
    .select("contact_id");
  if (claimErr) throw new Error(claimErr.message);
  const mine = new Set((claimed || []).map((r) => r.contact_id));
  let made = 0;
  for (const c of due.filter((x) => mine.has(x.contact_id))) {
    const ctx = occasionContext(c, owner, kind, on, c.occasion_date);
    const who = ctx.first_name || ctx.name || "them";
    for (const step of plan.steps) {
      let row;
      if (step.type === "task") {
        row = { title: renderTemplate(step.title, ctx) || `Reach out to ${who} for their ${occ.noun}` };
      } else if (step.type === "draft") {
        const verb = step.channel === "email" ? "Email" : step.channel === "call" ? "Call" : "Text";
        const body = renderTemplate(step.body, ctx);
        if (!body) continue;
        const subject = step.channel === "email" ? renderTemplate(step.subject, ctx) : "";
        row = {
          title: `${verb} ${who} for their ${occ.noun}${ahead ? ` (${ctx.occasion_date})` : ""}`,
          checklist: [...(subject ? [{ id: newStepId(), text: `Subject: ${subject}`.slice(0, 300), done: false }] : []), { id: newStepId(), text: body.slice(0, 2000), done: false }],
        };
      } else continue;
      const { error: err } = await admin.from("agent_tasks").insert({ owner_id: plan.owner_id, title: row.title.slice(0, 300), due_date: today, list: cleanList(plan.name), contact_id: c.contact_id, ...(row.checklist ? { checklist: row.checklist } : {}) });
      if (!err) made++;
    }
  }
  return made;
}

/** Runs the active birthday / anniversary plans for today. Returns how many to-dos it made. */
export async function runOccasions(admin, { ownerId } = {}) {
  const today = centralDay();
  let q = admin.from("plans").select("id, owner_id, name, steps, starts_when").eq("active", true).or("starts_when->>type.eq.birthday,starts_when->>type.eq.anniversary").limit(500);
  if (ownerId) q = q.eq("owner_id", ownerId);
  const { data: plans, error } = await q;
  if (error) throw new Error(error.message);
  const owners = new Map();
  let made = 0;
  for (const plan of plans || []) {
    try {
      if (!owners.has(plan.owner_id)) owners.set(plan.owner_id, (await admin.from("profiles").select("full_name, phone, people_enabled").eq("id", plan.owner_id).maybeSingle()).data);
      const owner = owners.get(plan.owner_id);
      if (!owner?.people_enabled) continue;
      made += await runOccasionPlan(admin, plan, owner, today);
    } catch (err) {
      console.error("occasion plan failed:", plan.id, err);
    }
  }
  return made;
}

/** Runs every plan step that is due. `ownerId` / `personId` narrow it (a person's own dashboard, or just-arrived lead). Returns how many steps ran. */
export async function runPlans(admin, { ownerId, personId } = {}) {
  const today = centralDay();
  let q = admin.from("plan_enrollments").select("*, plan:plans(id, name, steps, active)").eq("status", "active").lte("next_due", today).limit(500);
  if (ownerId) q = q.eq("owner_id", ownerId);
  if (personId) q = q.eq("person_id", personId);
  const { data: due, error } = await q;
  if (error) throw new Error(error.message);
  let ran = 0;
  for (const e of due || []) {
    try {
      ran += (await runOne(admin, e, today)) || 0;
    } catch (err) {
      console.error("plan step failed:", e.id, err);
    }
  }
  if (!personId) {
    try {
      ran += await runOccasions(admin, { ownerId });
    } catch (err) {
      console.error("occasion plans failed:", err);
    }
  }
  return ran;
}
