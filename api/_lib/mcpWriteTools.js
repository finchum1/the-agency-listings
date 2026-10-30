// The tools an AI connection can use to CHANGE things (api/mcp.js). Each needs the scope the agent granted, runs as the agent through
// row-level security, and reuses the same careful logic as the bot API (api/_lib/bots/people.js): valid stages only, duplicate emails refused,
// nothing deleted (people are archived with a reason), nothing sent. Every change is written to api_audit_log with the tool name and the id
// it touched, and writes are rate limited per person.
import { serviceClient } from "./authUser.js";
import * as people from "./bots/people.js";
import { HttpError } from "./bots/util.js";

const TZ = "America/Chicago";
export const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
export const plusDays = (key, n) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayText = (key) => new Date(`${key}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

// ---- schema helpers (the same shapes mcpTools.js uses) ----
export const obj = (properties = {}, required = []) => ({ type: "object", properties, required, additionalProperties: false });
export const str = (description) => ({ type: "string", description });
export const int = (description) => ({ type: "integer", description });
export const bool = (description) => ({ type: "boolean", description });
export const WRITES = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false };
const BOARD = { type: "string", enum: ["lead", "pipeline"], description: "lead = the Leads board, pipeline = the Pipeline board" };

// ---- guard rails ----
const recent = new Map(); // person id -> request times
const WRITES_PER_MINUTE = 60;
function rateLimit(userId) {
  const now = Date.now();
  const list = (recent.get(userId) || []).filter((t) => now - t < 60000);
  if (list.length >= WRITES_PER_MINUTE) throw new HttpError(429, `That's a lot of changes at once (limit ${WRITES_PER_MINUTE} a minute). Wait a moment and continue.`);
  list.push(now);
  recent.set(userId, list);
}
export const ctxFor = (sb, userId, tokenName, extra = {}) => ({ client: sb, admin: serviceClient(), ownerId: userId, scopes: ["people"], tokenName, tokenId: null, ...extra });

async function audit(userId, tool, status, detail) {
  try {
    await serviceClient().from("api_audit_log").insert({ token_id: null, owner_id: userId, method: "TOOL", path: `mcp:${tool}`, status, detail: detail ? String(detail).slice(0, 500) : null });
  } catch {
    /* the log must never break a change */
  }
}

// Runs one change with the checks every write tool shares, and logs it.
export async function change(tool, sb, userId, fn, extra) {
  rateLimit(userId);
  try {
    const out = await fn(ctxFor(sb, userId, "AI connection", extra));
    await audit(userId, tool, 200, out.audit);
    return out.text;
  } catch (err) {
    await audit(userId, tool, err.status || 500, `failed: ${err.message}`);
    throw err;
  }
}

// An AI changes leads and pipeline here. A person who is a deal is changed with the deal tools (they need the Deals permission).
async function lead(ctx, id) {
  const { person } = await people.getPerson(ctx, id);
  if (person.stage_group === "transaction") throw new HttpError(403, `${person.name} is a deal. Deals are changed with the deal tools, which need the Deals permission.`);
  return person;
}
const where = (p) => `${p.stage_group === "lead" ? "Leads" : "Pipeline"} › ${p.stage}`;
const followText = (p) => (p.next_follow_up ? `follow-up ${dayText(p.next_follow_up)}` : "no follow-up set");
const line = (p) => `${p.name} (id ${p.id}) — ${where(p)}, ${followText(p)}.`;

// "follow_up_date" wins over "follow_up_in_days"; in_days counts from today (Central time).
function followUpFrom(args) {
  if (args.follow_up_date !== undefined) return args.follow_up_date;
  if (args.follow_up_in_days !== undefined) {
    const n = Number(args.follow_up_in_days);
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw new HttpError(400, "follow_up_in_days must be a whole number of days from today (0 to 3650).");
    return plusDays(todayKey(), n);
  }
  return undefined;
}

// ---- the tools ----
async function listStages(sb, userId) {
  const ctx = ctxFor(sb, userId, "AI connection");
  const s = await people.stages(ctx);
  return [
    "Boards and their columns, in order:",
    `- Leads: ${s.boards.lead.join(" › ")}`,
    `- Pipeline: ${s.boards.pipeline.join(" › ")}`,
    `- Deals (changed with the deal tools): ${s.boards.transaction.join(" › ")}`,
    `Sources: ${s.sources.join(", ")}`,
    `Archive reasons: ${s.archive_reasons.join(", ")}`,
  ].join("\n");
}

async function addPerson(sb, userId, a) {
  return change("add_person", sb, userId, async (ctx) => {
    const follow = followUpFrom(a);
    const group = a.board || "lead";
    if (!["lead", "pipeline"].includes(group)) throw new HttpError(400, 'board must be "lead" or "pipeline".');
    const { person } = await people.createPerson(ctx, {
      name: a.name, email: a.email, phone: a.phone, source: a.source, property_address: a.property_address, side: a.side,
      stage_group: group, stage: a.stage, next_follow_up: follow, note: a.note, allow_duplicate: a.allow_duplicate,
    });
    return { text: `Added ${line(person)}`, audit: `person ${person.id} added to ${group}` };
  });
}

async function updatePerson(sb, userId, a) {
  return change("update_person", sb, userId, async (ctx) => {
    await lead(ctx, a.id);
    const body = {};
    for (const k of ["name", "email", "phone", "source", "property_address", "side"]) if (a[k] !== undefined) body[k] = a[k];
    const { person } = await people.updatePerson(ctx, a.id, body);
    return { text: `Updated ${line(person)}`, audit: `person ${person.id} updated: ${Object.keys(body).join(", ")}` };
  });
}

async function movePerson(sb, userId, a) {
  return change("move_person", sb, userId, async (ctx) => {
    const current = await lead(ctx, a.id);
    if (a.board && !["lead", "pipeline"].includes(a.board)) throw new HttpError(400, 'board must be "lead" or "pipeline".');
    const body = { stage: a.stage };
    if (a.board && a.board !== current.stage_group) body.stage_group = a.board;
    const { person } = await people.updatePerson(ctx, a.id, body);
    return { text: `Moved ${line(person)}`, audit: `person ${person.id} moved to ${person.stage_group}/${person.stage}` };
  });
}

async function setFollowUp(sb, userId, a) {
  return change("set_follow_up", sb, userId, async (ctx) => {
    await lead(ctx, a.id);
    const date = a.clear === true ? "" : followUpFrom(a);
    if (date === undefined) throw new HttpError(400, "Say when: follow_up_date (YYYY-MM-DD), follow_up_in_days, or clear: true to remove it.");
    const { person } = await people.updatePerson(ctx, a.id, { next_follow_up: date, note: a.note });
    return { text: `${date ? "Follow-up set" : "Follow-up cleared"}: ${line(person)}${a.note ? " A note was added." : ""}`, audit: `person ${person.id} follow-up ${date || "cleared"}` };
  });
}

async function addNote(sb, userId, a) {
  return change("add_note", sb, userId, async (ctx) => {
    const person = await lead(ctx, a.id);
    await people.addNote(ctx, a.id, { body: a.text });
    return { text: `Note added to ${person.name} (id ${person.id}).`, audit: `person ${person.id} note added` };
  });
}

async function archivePerson(sb, userId, a) {
  return change("archive_person", sb, userId, async (ctx) => {
    await lead(ctx, a.id);
    const { person } = await people.updatePerson(ctx, a.id, { archived: true, archived_reason: a.reason, note: a.note });
    return { text: `Archived ${person.name} (id ${person.id}) as "${person.archived_reason}". Nothing is deleted: restore_person brings them back.`, audit: `person ${person.id} archived: ${person.archived_reason}` };
  });
}

async function restorePerson(sb, userId, a) {
  return change("restore_person", sb, userId, async (ctx) => {
    await lead(ctx, a.id);
    const { person } = await people.updatePerson(ctx, a.id, { archived: false });
    return { text: `Restored ${line(person)}`, audit: `person ${person.id} restored` };
  });
}

const FOLLOW = {
  follow_up_date: str("The follow-up day, YYYY-MM-DD."),
  follow_up_in_days: int("Or: how many days from today (0 = today, 1 = tomorrow, 7 = a week)."),
};

export const WRITE_TOOLS = [
  { name: "list_stages", title: "Boards and columns", scope: "read", description: "The column names on the Leads and Pipeline boards (use these exactly when adding or moving someone), the lead sources, and the archive reasons.", inputSchema: obj(), annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }, run: listStages },
  {
    name: "add_person", title: "Add a person", scope: "write_people", annotations: WRITES, run: addPerson,
    description: "Add someone to the Leads or Pipeline board, optionally with a first follow-up and a note. Refuses if the email is already in their People (use update_person or move_person on the existing one instead). Check with the agent first unless they gave you the details.",
    inputSchema: obj({ name: str("Full name"), email: str("Email address"), phone: str("Phone number"), board: BOARD, stage: str("Column on that board; defaults to its first. Use list_stages for the names."), source: str("Where they came from, e.g. Referral, Open house, Sphere of influence"), side: { type: "string", enum: ["buyer", "seller", "both"] }, property_address: str("A property they're interested in or selling"), ...FOLLOW, note: str("A first note about them"), allow_duplicate: bool("Only if the agent confirmed a second person with the same email is right") }, ["name"]),
  },
  {
    name: "update_person", title: "Update a person", scope: "write_people", annotations: WRITES, run: updatePerson,
    description: "Change a lead's or pipeline person's name, email, phone, source, property address or side. To move them to another column use move_person; for follow-ups use set_follow_up.",
    inputSchema: obj({ id: str("Person id from find_person"), name: str("Full name"), email: str("Email address"), phone: str("Phone number"), source: str("Where they came from"), property_address: str("A property they're interested in or selling"), side: { type: "string", enum: ["buyer", "seller", "both"] } }, ["id"]),
  },
  {
    name: "move_person", title: "Move a person to a column", scope: "write_people", annotations: WRITES, run: movePerson,
    description: "Move someone to another column, or to the other board (lead <-> pipeline). Name the column exactly as list_stages shows it.",
    inputSchema: obj({ id: str("Person id from find_person"), stage: str("The column to move them to"), board: BOARD }, ["id", "stage"]),
  },
  {
    name: "set_follow_up", title: "Set or clear a follow-up", scope: "write_people", annotations: WRITES, run: setFollowUp,
    description: "Set the date someone is next followed up, or clear it. Optionally add a note at the same time (for example what was just discussed). Use this after the agent has followed up with someone to schedule the next one.",
    inputSchema: obj({ id: str("Person id from find_person"), ...FOLLOW, clear: bool("true to remove the follow-up"), note: str("A note to add to their card") }, ["id"]),
  },
  {
    name: "add_note", title: "Add a note", scope: "write_people", annotations: WRITES, run: addNote,
    description: "Add a note to a lead's or pipeline person's card.",
    inputSchema: obj({ id: str("Person id from find_person"), text: str("The note") }, ["id", "text"]),
  },
  {
    name: "archive_person", title: "Archive a person", scope: "write_people", annotations: { ...WRITES, destructiveHint: false }, run: archivePerson,
    description: "Take someone off their board (they are archived with a reason, never deleted, and restore_person brings them back). Ask the agent before archiving unless they said to.",
    inputSchema: obj({ id: str("Person id from find_person"), reason: str("Why, e.g. Not interested, Went elsewhere, Unresponsive, Other"), note: str("A note to add") }, ["id", "reason"]),
  },
  {
    name: "restore_person", title: "Restore an archived person", scope: "write_people", annotations: WRITES, run: restorePerson,
    description: "Bring an archived person back to their board.",
    inputSchema: obj({ id: str("Person id from find_person (search with include_archived)") }, ["id"]),
  },
];
