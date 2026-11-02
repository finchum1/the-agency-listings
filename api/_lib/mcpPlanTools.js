// AI connection tools for follow-up plans (scope write_people to change, read to look): see src/lib/plans.js. An AI can write a plan from a plain
// description, switch it on or off, and put a lead on it or take them off. A plan's steps only create to-dos and DRAFT messages (nothing is sent) and
// move people between columns, and a plan stops by itself when the person is moved or archived.
import { HttpError } from "./bots/util.js";
import { cleanPlan, startText, stepSummary } from "../../src/lib/plans.js";
import { serviceClient } from "./authUser.js";
import { runPlans } from "./planRunner.js";
import { WRITES, bool, change, obj, str } from "./mcpWriteTools.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Chicago" });
const plus = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const STEP = {
  type: "object",
  properties: {
    day: { type: "integer", description: "Days after they start the plan (0 = right away). Days must not go down from one step to the next." },
    type: { type: "string", enum: ["task", "draft", "move"], description: "task = a to-do for the agent, draft = a message waiting for the agent to send, move = move the person to a column" },
    title: str("For a task. May use {first_name}, {name}, {agent_first_name}, {agent_phone}, {property_address}, {source}"),
    channel: { type: "string", enum: ["text", "email", "call"], description: "For a draft" },
    subject: str("For an email draft"),
    body: str("For a draft: the message (or call notes). Same {merge fields}."),
    group: { type: "string", enum: ["lead", "pipeline"], description: "For a move" },
    stage: str("For a move: the column name exactly as list_stages shows it"),
  },
  required: ["day", "type"],
  additionalProperties: false,
};
const STARTS = {
  type: "object",
  description: 'How it starts: { "type": "manual" } (the agent or AI starts it), { "type": "source", "value": "Website inquiry" } (a new person with that source), or { "type": "column", "group": "lead", "stage": "New" } (someone enters that column)',
  properties: { type: { type: "string", enum: ["manual", "source", "column"] }, value: str(""), group: { type: "string", enum: ["lead", "pipeline"] }, stage: str("") },
  required: ["type"],
  additionalProperties: false,
};

async function listPlans(sb, userId) {
  const [{ data: plans, error }, { data: en }] = await Promise.all([sb.from("plans").select("*").eq("owner_id", userId).order("created_at"), sb.from("plan_enrollments").select("plan_id, status").eq("owner_id", userId)]);
  if (error) throw new HttpError(500, error.message);
  if (!plans.length) return "No plans yet. create_plan writes one.";
  return plans
    .map((p) => {
      const on = (en || []).filter((e) => e.plan_id === p.id && (e.status === "active" || e.status === "paused")).length;
      return `- ${p.name} (id ${p.id}) | ${p.active ? "ON" : "off"} | ${startText(p.starts_when)} | ${on} on it now\n${p.steps.map((s) => `    Day ${s.day}: ${stepSummary(s)}`).join("\n")}`;
    })
    .join("\n");
}

async function createPlan(sb, userId, a) {
  return change("create_plan", sb, userId, async () => {
    let clean;
    try {
      clean = cleanPlan(a);
    } catch (e) {
      throw new HttpError(400, e.message);
    }
    const { data, error } = await sb.from("plans").insert({ ...clean, active: a.active === true }).select("id, name, active").single();
    if (error) throw new HttpError(error.code === "42501" ? 403 : 500, error.message);
    return { text: `Created plan “${data.name}” (id ${data.id}), ${data.active ? "ON" : "OFF"}. ${data.active ? "" : "It's off: nothing starts until it is switched on (update_plan active: true). "}${startText(clean.starts_when)}.`, audit: `plan ${data.id} created` };
  });
}

async function updatePlan(sb, userId, a) {
  return change("update_plan", sb, userId, async () => {
    const { data: cur } = await sb.from("plans").select("*").eq("id", a.plan_id).eq("owner_id", userId).maybeSingle();
    if (!cur) throw new HttpError(404, "No plan with that id.");
    const changes = {};
    if (a.name !== undefined || a.starts_when !== undefined || a.steps !== undefined) {
      try {
        Object.assign(changes, cleanPlan({ name: a.name ?? cur.name, starts_when: a.starts_when ?? cur.starts_when, steps: a.steps ?? cur.steps }));
      } catch (e) {
        throw new HttpError(400, e.message);
      }
    }
    if (a.active !== undefined) changes.active = a.active === true;
    if (!Object.keys(changes).length) throw new HttpError(400, "Nothing to change.");
    const { data, error } = await sb.from("plans").update(changes).eq("id", cur.id).select("id, name, active").single();
    if (error) throw new HttpError(500, error.message);
    return { text: `Updated plan “${data.name}”, now ${data.active ? "ON" : "OFF"}. People already on it keep their place.`, audit: `plan ${data.id} updated` };
  });
}

async function enroll(sb, userId, a) {
  return change("enroll_in_plan", sb, userId, async () => {
    const [{ data: plan }, { data: person }] = await Promise.all([
      sb.from("plans").select("id, name, steps").eq("id", a.plan_id).eq("owner_id", userId).maybeSingle(),
      sb.from("people").select("id, name, stage_group, archived").eq("id", a.person_id).eq("owner_id", userId).maybeSingle(),
    ]);
    if (!plan) throw new HttpError(404, "No plan with that id.");
    if (!person) throw new HttpError(404, "No person with that id in your People.");
    if (person.archived) throw new HttpError(400, `${person.name} is archived.`);
    if (person.stage_group === "transaction") throw new HttpError(400, `${person.name} is a deal; plans are for leads and pipeline people.`);
    const t = today();
    const fresh = { started_on: t, next_step: 0, next_due: plus(t, plan.steps[0].day), status: "active", stop_reason: "", log: [] };
    const { data: existing } = await sb.from("plan_enrollments").select("id, status").eq("plan_id", plan.id).eq("person_id", person.id).maybeSingle();
    if (existing?.status === "active" || existing?.status === "paused") throw new HttpError(409, `${person.name} is already on “${plan.name}”.`);
    const { error } = existing ? await sb.from("plan_enrollments").update(fresh).eq("id", existing.id) : await sb.from("plan_enrollments").insert({ plan_id: plan.id, person_id: person.id, ...fresh });
    if (error) throw new HttpError(500, error.message);
    const ran = await runPlans(serviceClient(), { ownerId: userId, personId: person.id }).catch(() => 0);
    return { text: `${person.name} is on “${plan.name}”.${ran ? ` ${ran} step${ran === 1 ? "" : "s"} ran straight away (to-dos and drafts are on their card and your list).` : ""}`, audit: `person ${person.id} on plan ${plan.id}` };
  });
}

async function stop(sb, userId, a) {
  return change("stop_plan_for_person", sb, userId, async () => {
    let q = sb.from("plan_enrollments").update({ status: "stopped", stop_reason: a.reason ? String(a.reason).slice(0, 80) : "Stopped by AI" }).eq("person_id", a.person_id).eq("owner_id", userId).in("status", ["active", "paused"]);
    if (a.plan_id) q = q.eq("plan_id", a.plan_id);
    const { data, error } = await q.select("id");
    if (error) throw new HttpError(500, error.message);
    return { text: data.length ? `Stopped ${data.length} plan${data.length === 1 ? "" : "s"} for that person.` : "They weren't on any running plan.", audit: `person ${a.person_id} plans stopped` };
  });
}

export const PLAN_TOOLS = [
  { name: "list_plans", title: "List follow-up plans", scope: "read", annotations: READ, run: listPlans, description: "The agent's follow-up plans: what starts each one, whether it is on, its steps, and how many people are on it.", inputSchema: obj() },
  {
    name: "create_plan", title: "Create a follow-up plan", scope: "write_people", annotations: WRITES, run: createPlan,
    description: "Write a follow-up plan: timed steps counted from the day someone starts it. Steps are to-dos for the agent, DRAFT messages for them to send (never sent automatically) and moves between columns. It is created OFF unless active is true; confirm with the agent before switching one on, because an ON plan starts by itself for new people. Use list_stages for the exact column names.",
    inputSchema: obj({ name: str("e.g. New web lead"), starts_when: STARTS, steps: { type: "array", minItems: 1, maxItems: 20, items: STEP }, active: bool("Switch it on now (default false)") }, ["name", "steps"]),
  },
  {
    name: "update_plan", title: "Change a follow-up plan", scope: "write_people", annotations: WRITES, run: updatePlan,
    description: "Rename a plan, change what starts it or its steps, or switch it on or off (active). Send only what changes; steps replace the whole list. People already on it keep their place.",
    inputSchema: obj({ plan_id: str("Plan id from list_plans"), name: str(""), starts_when: STARTS, steps: { type: "array", minItems: 1, maxItems: 20, items: STEP }, active: bool("true switches it on, false off") }, ["plan_id"]),
  },
  {
    name: "enroll_in_plan", title: "Put someone on a plan", scope: "write_people", annotations: WRITES, run: enroll,
    description: "Start a lead or pipeline person on a plan now. Its first steps (a to-do, a drafted message) happen right away.",
    inputSchema: obj({ plan_id: str("Plan id from list_plans"), person_id: str("Person id from find_person") }, ["plan_id", "person_id"]),
  },
  {
    name: "stop_plan_for_person", title: "Take someone off a plan", scope: "write_people", annotations: WRITES, run: stop,
    description: "Stop one plan (or all of them) for a person, for example because they replied. Nothing is deleted.",
    inputSchema: obj({ person_id: str("Person id"), plan_id: str("Only this plan; leave out to stop all"), reason: str("Why, e.g. They replied") }, ["person_id"]),
  },
];
