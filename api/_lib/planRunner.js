// Runs the steps of follow-up plans (see src/lib/plans.js and supabase/lead-response-plans.sql). Called by the schedule (api/plans.js), by the
// dashboard when it opens, and right after a website inquiry arrives, so the first steps of a plan happen within moments of a new lead.
// A step is CLAIMED (the enrollment's next_step moves on) before it runs, so two runners at once can't do the same step twice.
import { BOARDS } from "../../src/lib/peopleStages.js";
import { mergeContext, renderTemplate } from "../../src/lib/plans.js";
import { cleanList } from "../../src/lib/taskLists.js";

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
  return ran;
}
