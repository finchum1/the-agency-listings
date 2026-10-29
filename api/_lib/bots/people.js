// The People module over the bot API (scope "people"): leads, pipeline, transactions, notes, drafted messages and the agent's
// own to-do list. Everything acts as the admin who made the token, under row-level security, so a bot only ever sees and
// changes that admin's own people. Rules that keep a bot safe: nothing is deleted (people are archived with a reason), nothing
// is sent (messages are drafts the agent approves in the dashboard), and a duplicate email is refused unless asked for.
import { HttpError, bad, dateKey, isUuid, number, oneOf, text, timeKey } from "./util.js";
import { requireScope } from "./context.js";
import { ARCHIVE_REASONS, BOARDS, SOURCES } from "../../../src/lib/peopleStages.js";
import { ANCHORS, DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_TEMPLATES, effectiveDue } from "../../../src/lib/checklistDefaults.js";
import { nextDue } from "../../../src/lib/taskRecurrence.js";
import { toKey } from "../../../src/lib/homeDates.js";
import { cleanList, cleanSteps } from "../../../src/lib/taskLists.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GROUPS = ["lead", "pipeline", "transaction"];
const SIDES = ["buyer", "seller", "both"];
const ANCHOR_KEYS = ANCHORS.map((a) => a.value);
const RECURRENCES = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "quarterly", "yearly"];
const DEAL_DATES = ["contract_date", "inspection_date", "inspection_period_end", "appraisal_date", "financing_deadline", "closing_date"];

const fail = (error) => {
  throw new HttpError(error.code === "23514" || error.code === "22P02" ? 400 : 500, error.message);
};
const must = ({ data, error }) => {
  if (error) fail(error);
  return data;
};
const id = (value, what) => {
  if (!isUuid(value)) throw bad(`That isn't a valid ${what} id.`);
  return value;
};
const clip = (n, def, max) => Math.max(1, Math.min(max, Number.parseInt(n, 10) || def));

// The scope, and the People module being on for the account the token belongs to.
async function gate(ctx) {
  requireScope(ctx, "people");
  if (ctx.peopleOk) return;
  const { data } = await ctx.admin.from("profiles").select("people_enabled").eq("id", ctx.ownerId).maybeSingle();
  if (!data?.people_enabled) throw new HttpError(403, "The People module isn't turned on for the account behind this token.");
  ctx.peopleOk = true;
}

const personView = ({ owner_id: _owner, ...p }) => p;

async function stageLists(ctx) {
  const { data } = await ctx.client.from("people_settings").select("stages").eq("owner_id", ctx.ownerId).maybeSingle();
  const { transaction_closed: closed, ...custom } = data?.stages || {};
  const lists = {};
  for (const g of GROUPS) lists[g] = Array.isArray(custom[g]) && custom[g].length ? custom[g] : [...BOARDS[g].stages];
  return { lists, closed: closed || null };
}

async function loadPerson(ctx, personId) {
  const { data, error } = await ctx.client.from("people").select("*").eq("owner_id", ctx.ownerId).eq("id", id(personId, "person")).maybeSingle();
  if (error) fail(error);
  if (!data) throw new HttpError(404, "No person with that id in your People.");
  return data;
}

// ---- reading and checking a person's fields ----

function readFields(body) {
  const f = {};
  const set = (k, v) => {
    if (v !== undefined) f[k] = v;
  };
  set("name", text(body, "name", { max: 120 }));
  if (f.name !== undefined && !f.name) throw bad("name can't be empty.");
  const email = text(body, "email", { max: 200 });
  if (email) {
    if (!EMAIL.test(email)) throw bad("email isn't a valid email address.");
    set("email", email.toLowerCase());
  } else set("email", email);
  set("phone", text(body, "phone", { max: 40 }));
  set("source", text(body, "source", { max: 80 }));
  set("property_address", text(body, "property_address", { max: 200 }));
  set("other_agent", text(body, "other_agent", { max: 120 }));
  set("title_company", text(body, "title_company", { max: 120 }));
  set("lender", text(body, "lender", { max: 120 }));
  set("price", number(body, "price", { min: 0, max: 1e10 }));
  set("commission", number(body, "commission", { min: 0, max: 1e9 }));
  for (const key of ["next_follow_up", ...DEAL_DATES]) {
    const v = dateKey(body, key);
    set(key, v === "" ? null : v);
  }
  set("earnest_money", number(body, "earnest_money", { min: 0, max: 1e10 }));
  if (body.earnest_money_delivered !== undefined) {
    if (typeof body.earnest_money_delivered !== "boolean") throw bad("earnest_money_delivered must be true or false.");
    set("earnest_money_delivered", body.earnest_money_delivered);
    set("earnest_money_delivered_at", body.earnest_money_delivered ? new Date().toISOString() : null);
  }
  if (body.is_cash !== undefined) {
    if (typeof body.is_cash !== "boolean") throw bad("is_cash must be true or false.");
    set("is_cash", body.is_cash);
  }
  const clock = timeKey(body, "inspection_time");
  set("inspection_time", clock === "" ? null : clock);
  if (body.side !== undefined) set("side", body.side === null ? null : oneOf(body, "side", SIDES));
  return f;
}

// The board a person lands on and the column inside it. Moving to another board needs a column named, so a bot never guesses.
function placement(current, body, lists) {
  const group = oneOf(body, "stage_group", GROUPS);
  const stage = text(body, "stage", { max: 60 });
  const moving = group !== undefined && group !== current?.stage_group;
  if (stage === undefined && !moving) return {};
  const target = group || current.stage_group;
  if (moving && !stage) throw bad(`To move someone to ${target} also send "stage". Valid stages: ${lists[target].join(", ")}.`, { stages: lists[target] });
  if (stage && !lists[target].includes(stage)) throw bad(`"${stage}" isn't a stage on the ${target} board. Valid stages: ${lists[target].join(", ")}.`, { stages: lists[target] });
  return { stage_group: target, stage };
}

function checkSide(group, side) {
  if (group === "transaction" && side !== "buyer" && side !== "seller") throw bad('A transaction is for one side: send side "buyer" or "seller".');
}

// ---- people ----

export async function stages(ctx) {
  await gate(ctx);
  const { lists, closed } = await stageLists(ctx);
  return { boards: lists, closed_stage: closed, archive_reasons: ARCHIVE_REASONS, sources: SOURCES, sides: SIDES, checklist_anchors: ANCHOR_KEYS };
}

export async function overview(ctx) {
  await gate(ctx);
  const rows = must(await ctx.client.from("people").select("stage_group, stage, next_follow_up, closing_date, price, commission, created_at").eq("owner_id", ctx.ownerId).eq("archived", false).limit(5000));
  const today = toKey(new Date());
  const week = toKey(new Date(Date.now() + 7 * 864e5));
  const month = toKey(new Date(Date.now() + 30 * 864e5));
  const counts = {};
  for (const g of GROUPS) counts[g] = { total: 0, by_stage: {} };
  let overdue = 0;
  let dueToday = 0;
  let dueWeek = 0;
  const closings = [];
  for (const p of rows) {
    const c = counts[p.stage_group];
    c.total += 1;
    c.by_stage[p.stage] = (c.by_stage[p.stage] || 0) + 1;
    if (p.next_follow_up) {
      if (p.next_follow_up < today) overdue += 1;
      else if (p.next_follow_up === today) dueToday += 1;
      else if (p.next_follow_up <= week) dueWeek += 1;
    }
    if (p.stage_group === "transaction" && p.closing_date && p.closing_date >= today && p.closing_date <= month) closings.push(p);
  }
  const { count: drafts } = await ctx.client.from("people_outreach").select("*", { count: "exact", head: true }).eq("status", "draft");
  return {
    people: counts,
    follow_ups: { overdue, today: dueToday, next_7_days: dueWeek },
    closings_next_30_days: { count: closings.length, volume: closings.reduce((n, p) => n + (Number(p.price) || 0), 0) },
    drafts_waiting_for_you: drafts || 0,
  };
}

export async function listPeople(ctx, q) {
  await gate(ctx);
  const limit = clip(q.limit, 50, 200);
  const offset = Math.max(0, Number.parseInt(q.offset, 10) || 0);
  let query = ctx.client.from("people").select("*", { count: "exact" }).eq("owner_id", ctx.ownerId);
  if (q.group) query = query.eq("stage_group", oneOf(q, "group", GROUPS));
  if (q.stage) query = query.eq("stage", String(q.stage).slice(0, 60));
  if (q.side) query = query.eq("side", oneOf(q, "side", SIDES));
  if (q.source) query = query.eq("source", String(q.source).slice(0, 80));
  const archived = q.archived === "true" ? true : q.archived === "all" ? null : false;
  if (archived !== null) query = query.eq("archived", archived);
  const today = toKey(new Date());
  if (q.follow_up === "overdue") query = query.lt("next_follow_up", today);
  else if (q.follow_up === "today") query = query.eq("next_follow_up", today);
  else if (q.follow_up === "week") query = query.gte("next_follow_up", today).lte("next_follow_up", toKey(new Date(Date.now() + 7 * 864e5)));
  if (q.q) {
    const term = String(q.q).replace(/[%,()]/g, " ").trim().slice(0, 80);
    if (term) query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,property_address.ilike.%${term}%`);
  }
  query = q.order === "follow_up" ? query.order("next_follow_up", { ascending: true, nullsFirst: false }) : query.order("updated_at", { ascending: false });
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) fail(error);
  return { people: (data || []).map(personView), count: count ?? (data || []).length, limit, offset };
}

export async function getPerson(ctx, personId) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const [notes, outreach] = await Promise.all([
    ctx.client.from("people_notes").select("id, body, created_at").eq("person_id", person.id).order("created_at", { ascending: false }).limit(50),
    ctx.client.from("people_outreach").select("id, channel, subject, body, status, drafted_by, created_at, resolved_at").eq("person_id", person.id).order("created_at", { ascending: false }).limit(20),
  ]);
  const out = { person: personView(person), notes: must(notes), outreach: must(outreach) };
  if (person.stage_group === "transaction") out.checklist = (await checklistView(ctx, person)).progress;
  return out;
}

export async function createPerson(ctx, body) {
  await gate(ctx);
  const f = readFields(body);
  if (!f.name) throw bad("name is required.");
  const { lists } = await stageLists(ctx);
  const place = placement(null, { stage_group: body.stage_group || "lead", stage: body.stage ?? lists[body.stage_group || "lead"]?.[0] }, lists);
  checkSide(place.stage_group, f.side);
  if (f.side === "both" && place.stage_group === "transaction") throw bad('A transaction is for one side: send side "buyer" or "seller".');

  if (f.email && body.allow_duplicate !== true) {
    const { data: dup } = await ctx.client.from("people").select("id, name, archived, stage_group, stage").eq("owner_id", ctx.ownerId).ilike("email", f.email).limit(1).maybeSingle();
    if (dup) {
      throw new HttpError(409, `${dup.name} is already in your People with that email${dup.archived ? " (archived)" : ""}. Update them instead, or send allow_duplicate: true.`, { person_id: dup.id, archived: dup.archived, stage_group: dup.stage_group, stage: dup.stage });
    }
  }
  const row = { ...f, ...place, source: f.source || "Added manually" };
  const person = must(await ctx.client.from("people").insert(row).select("*").single());
  const note = text(body, "note", { max: 5000 });
  if (note) must(await ctx.client.from("people_notes").insert({ person_id: person.id, body: note }).select("id").single());
  return { person: personView(person) };
}

export async function updatePerson(ctx, personId, body) {
  await gate(ctx);
  const current = await loadPerson(ctx, personId);
  const f = readFields(body);
  const { lists } = await stageLists(ctx);
  const place = placement(current, body, lists);
  const group = place.stage_group || current.stage_group;
  const side = f.side !== undefined ? f.side : current.side;
  if (place.stage_group === "transaction" || (f.side !== undefined && group === "transaction")) checkSide(group, side);

  const changes = { ...f, ...place };
  if (body.archived === true) {
    const reason = text(body, "archived_reason", { max: 80 }) || "Other";
    if (!ARCHIVE_REASONS.includes(reason)) throw bad(`archived_reason must be one of: ${ARCHIVE_REASONS.join(", ")}.`);
    Object.assign(changes, { archived: true, archived_reason: reason, archived_at: new Date().toISOString() });
  } else if (body.archived === false) {
    Object.assign(changes, { archived: false, archived_reason: "", archived_at: null });
  }
  const note = text(body, "note", { max: 5000 });
  if (!Object.keys(changes).length && !note) throw bad("Nothing to change. Send at least one field.");
  let person = current;
  if (Object.keys(changes).length) person = must(await ctx.client.from("people").update(changes).eq("id", current.id).select("*").single());
  if (note) must(await ctx.client.from("people_notes").insert({ person_id: current.id, body: note }).select("id").single());
  return { person: personView(person) };
}

// ---- notes ----

export async function listNotes(ctx, personId, q) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const notes = must(await ctx.client.from("people_notes").select("id, body, created_at").eq("person_id", person.id).order("created_at", { ascending: false }).limit(clip(q.limit, 50, 200)));
  return { notes };
}

export async function addNote(ctx, personId, body) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const note = text(body, "body", { required: true, max: 5000 });
  const row = must(await ctx.client.from("people_notes").insert({ person_id: person.id, body: note }).select("id, body, created_at").single());
  return { note: row };
}

// ---- drafted messages: the agent approves and sends these from the dashboard ----

export async function createOutreach(ctx, personId, body) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const channel = oneOf(body, "channel", ["email", "text", "call"]);
  if (!channel) throw bad('channel is required: "email", "text" or "call" (a call draft is talking points).');
  const message = text(body, "body", { required: true, max: 5000 });
  const subject = channel === "email" ? text(body, "subject", { max: 200 }) || "" : "";
  if (channel === "email" && !person.email) throw bad(`${person.name} has no email address on file. Add one first.`);
  if ((channel === "text" || channel === "call") && !person.phone) throw bad(`${person.name} has no phone number on file. Add one first.`);
  const { count: mine } = await ctx.client.from("people_outreach").select("*", { count: "exact", head: true }).eq("person_id", person.id).eq("status", "draft");
  if ((mine || 0) >= 10) throw new HttpError(409, `${person.name} already has 10 drafts waiting for you. Ask them to be sent or discarded first.`);
  const { count: all } = await ctx.client.from("people_outreach").select("*", { count: "exact", head: true }).eq("status", "draft");
  if ((all || 0) >= 100) throw new HttpError(409, "You have 100 drafts waiting. Send or discard some first.");
  const row = must(
    await ctx.client
      .from("people_outreach")
      .insert({ person_id: person.id, channel, subject, body: message, drafted_by: ctx.tokenName })
      .select("id, person_id, channel, subject, body, status, drafted_by, created_at")
      .single(),
  );
  return { outreach: row, note: "This is a draft. It is waiting on the person's card in the dashboard; nothing was sent." };
}

export async function listOutreach(ctx, q) {
  await gate(ctx);
  const status = q.status ? oneOf(q, "status", ["draft", "sent", "discarded"]) : "draft";
  let query = ctx.client.from("people_outreach").select("id, person_id, channel, subject, body, status, drafted_by, created_at, resolved_at").eq("status", status).order("created_at", { ascending: false }).limit(clip(q.limit, 50, 200));
  if (q.person_id) query = query.eq("person_id", id(q.person_id, "person"));
  return { outreach: must(await query) };
}

export async function updateOutreach(ctx, outreachId, body) {
  await gate(ctx);
  const { data: row } = await ctx.client.from("people_outreach").select("id, status").eq("id", id(outreachId, "outreach")).maybeSingle();
  if (!row) throw new HttpError(404, "No draft with that id.");
  if (row.status !== "draft") throw new HttpError(409, `That message is already ${row.status}.`);
  const changes = {};
  const subject = text(body, "subject", { max: 200 });
  const message = text(body, "body", { max: 5000 });
  if (subject !== undefined) changes.subject = subject;
  if (message !== undefined) {
    if (!message) throw bad("body can't be empty.");
    changes.body = message;
  }
  if (body.status !== undefined) {
    if (body.status !== "discarded") throw bad('A bot can only set status to "discarded". Sending is done from the dashboard.');
    Object.assign(changes, { status: "discarded", resolved_at: new Date().toISOString() });
  }
  if (!Object.keys(changes).length) throw bad("Nothing to change.");
  const updated = must(await ctx.client.from("people_outreach").update(changes).eq("id", row.id).select("id, person_id, channel, subject, body, status, drafted_by, created_at, resolved_at").single());
  return { outreach: updated };
}

// ---- a transaction's checklist: tasks and documents ----

async function checklistView(ctx, person) {
  const [tasks, docs] = await Promise.all([
    ctx.client.from("transaction_tasks").select("id, section, position, text, anchor, offset_days, due_override, done, done_at").eq("person_id", person.id).order("position"),
    ctx.client.from("transaction_documents").select("id, section, position, text, done, done_at").eq("person_id", person.id).order("position"),
  ]);
  const dates = { contract_date: person.contract_date, inspection_date: person.inspection_date, closing_date: person.closing_date };
  const t = must(tasks).map((x) => ({ ...x, due: effectiveDue(x, dates) }));
  const d = must(docs);
  return {
    tasks: t,
    documents: d,
    progress: { tasks: { done: t.filter((x) => x.done).length, total: t.length }, documents: { done: d.filter((x) => x.done).length, total: d.length } },
  };
}

export async function getChecklist(ctx, personId) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  return { person_id: person.id, side: person.side, ...(await checklistView(ctx, person)) };
}

// Copies the agent's saved checklist for the deal's side (or the built-in one) onto the deal, like "Apply template" in the app.
// It only fills an empty list, so a bot can't pile a second copy of the checklist on top of the first.
export async function applyChecklist(ctx, personId, body) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  if (person.side !== "buyer" && person.side !== "seller") throw bad('This deal needs a side first: update the person with side "buyer" or "seller".');
  const kind = oneOf(body, "kind", ["tasks", "documents", "both"]) || "both";
  const added = {};
  if (kind !== "documents") {
    const { count } = await ctx.client.from("transaction_tasks").select("*", { count: "exact", head: true }).eq("person_id", person.id);
    if (count) throw new HttpError(409, "This deal already has a task checklist.");
    const saved = (await ctx.client.from("checklist_templates").select("sections").eq("side", person.side).maybeSingle()).data;
    const sections = saved?.sections?.length ? saved.sections : DEFAULT_TEMPLATES[person.side];
    const rows = [];
    let position = 0;
    for (const sec of sections) for (const item of sec.items) if (String(item).trim()) rows.push({ person_id: person.id, section: sec.title, position: position++, text: item, anchor: sec.anchor, offset_days: sec.offset_days });
    if (rows.length) must(await ctx.client.from("transaction_tasks").insert(rows).select("id"));
    added.tasks = rows.length;
  }
  if (kind !== "tasks") {
    const { count } = await ctx.client.from("transaction_documents").select("*", { count: "exact", head: true }).eq("person_id", person.id);
    if (count) throw new HttpError(409, "This deal already has a document checklist.");
    const saved = (await ctx.client.from("document_templates").select("sections").eq("side", person.side).maybeSingle()).data;
    const sections = saved?.sections?.length ? saved.sections : DEFAULT_DOCUMENT_TEMPLATES[person.side];
    const rows = [];
    let position = 0;
    for (const sec of sections) for (const item of sec.items) if (String(item).trim()) rows.push({ person_id: person.id, section: sec.title, position: position++, text: item });
    if (rows.length) must(await ctx.client.from("transaction_documents").insert(rows).select("id"));
    added.documents = rows.length;
  }
  return { added, ...(await checklistView(ctx, person)) };
}

export async function addChecklistTask(ctx, personId, body) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const label = text(body, "text", { required: true, max: 300 });
  const section = text(body, "section", { max: 80 }) ?? "";
  const anchor = oneOf(body, "anchor", ANCHOR_KEYS) || "contract_date";
  const offset = number(body, "offset_days", { min: -365, max: 365, integer: true }) ?? 0;
  const due = dateKey(body, "due_override");
  const { data: last } = await ctx.client.from("transaction_tasks").select("position").eq("person_id", person.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const row = must(
    await ctx.client
      .from("transaction_tasks")
      .insert({ person_id: person.id, section, position: (last?.position ?? -1) + 1, text: label, anchor, offset_days: offset, due_override: due || null })
      .select("id, section, position, text, anchor, offset_days, due_override, done, done_at")
      .single(),
  );
  return { task: row };
}

export async function updateChecklistTask(ctx, taskId, body) {
  await gate(ctx);
  const changes = {};
  const label = text(body, "text", { max: 300 });
  if (label !== undefined) {
    if (!label) throw bad("text can't be empty.");
    changes.text = label;
  }
  const section = text(body, "section", { max: 80 });
  if (section !== undefined) changes.section = section;
  const anchor = oneOf(body, "anchor", ANCHOR_KEYS);
  if (anchor) changes.anchor = anchor;
  const offset = number(body, "offset_days", { min: -365, max: 365, integer: true });
  if (offset !== undefined) changes.offset_days = offset ?? 0;
  const due = dateKey(body, "due_override");
  if (due !== undefined) changes.due_override = due || null;
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") throw bad("done must be true or false.");
    Object.assign(changes, { done: body.done, done_at: body.done ? new Date().toISOString() : null });
  }
  if (!Object.keys(changes).length) throw bad("Nothing to change.");
  const row = (await ctx.client.from("transaction_tasks").update(changes).eq("id", id(taskId, "task")).select("id, person_id, section, position, text, anchor, offset_days, due_override, done, done_at")).data?.[0];
  if (!row) throw new HttpError(404, "No checklist task with that id.");
  return { task: row };
}

export async function addChecklistDocument(ctx, personId, body) {
  await gate(ctx);
  const person = await loadPerson(ctx, personId);
  const label = text(body, "text", { required: true, max: 300 });
  const section = text(body, "section", { max: 80 }) ?? "";
  const { data: last } = await ctx.client.from("transaction_documents").select("position").eq("person_id", person.id).order("position", { ascending: false }).limit(1).maybeSingle();
  const row = must(await ctx.client.from("transaction_documents").insert({ person_id: person.id, section, position: (last?.position ?? -1) + 1, text: label }).select("id, section, position, text, done, done_at").single());
  return { document: row };
}

export async function updateChecklistDocument(ctx, docId, body) {
  await gate(ctx);
  const changes = {};
  const label = text(body, "text", { max: 300 });
  if (label !== undefined) {
    if (!label) throw bad("text can't be empty.");
    changes.text = label;
  }
  const section = text(body, "section", { max: 80 });
  if (section !== undefined) changes.section = section;
  if (body.done !== undefined) {
    if (typeof body.done !== "boolean") throw bad("done must be true or false.");
    Object.assign(changes, { done: body.done, done_at: body.done ? new Date().toISOString() : null });
  }
  if (!Object.keys(changes).length) throw bad("Nothing to change.");
  const row = (await ctx.client.from("transaction_documents").update(changes).eq("id", id(docId, "document")).select("id, person_id, section, position, text, done, done_at")).data?.[0];
  if (!row) throw new HttpError(404, "No checklist document with that id.");
  return { document: row };
}

// ---- the agent's own to-do list (the Tasks card on the dashboard home page) ----

const taskView = ({ owner_id: _owner, ...t }) => t;

export async function listTasks(ctx, q) {
  await gate(ctx);
  let query = ctx.client.from("agent_tasks").select("*").order("due_date", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }).limit(clip(q.limit, 100, 300));
  if (q.done !== "all") query = query.eq("done", q.done === "true");
  const today = toKey(new Date());
  if (q.due === "overdue") query = query.lt("due_date", today);
  else if (q.due === "today") query = query.eq("due_date", today);
  else if (q.due === "week") query = query.gte("due_date", today).lte("due_date", toKey(new Date(Date.now() + 7 * 864e5)));
  return { tasks: must(await query).map(taskView) };
}

export async function createTask(ctx, body) {
  await gate(ctx);
  const title = text(body, "title", { required: true, max: 300 });
  const recurrence = oneOf(body, "recurrence", RECURRENCES) || "none";
  let due = dateKey(body, "due_date") || null;
  if (recurrence !== "none" && !due) due = toKey(new Date());
  const time = text(body, "start_time", { max: 5 });
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw bad("start_time must look like 14:30.");
  const duration = number(body, "duration_min", { min: 5, max: 1440, integer: true });
  const row = {
    title,
    due_date: due,
    recurrence,
    series_start: recurrence !== "none" ? due : null,
    start_time: due && time ? time : null,
    duration_min: due && time ? duration || 60 : null,
    list: cleanList(text(body, "list", { max: 40 })),
    checklist: cleanSteps(Array.isArray(body.checklist) ? body.checklist.map((s) => (typeof s === "string" ? { text: s } : s)) : []),
  };
  return { task: taskView(must(await ctx.client.from("agent_tasks").insert(row).select("*").single())) };
}

export async function updateTask(ctx, taskId, body) {
  await gate(ctx);
  const { data: task } = await ctx.client.from("agent_tasks").select("*").eq("id", id(taskId, "task")).maybeSingle();
  if (!task) throw new HttpError(404, "No to-do with that id.");
  const changes = {};
  const title = text(body, "title", { max: 300 });
  if (title !== undefined) {
    if (!title) throw bad("title can't be empty.");
    changes.title = title;
  }
  const list = text(body, "list", { max: 40 });
  if (list !== undefined) changes.list = cleanList(list);
  const recurrence = oneOf(body, "recurrence", RECURRENCES);
  const dueKey = dateKey(body, "due_date");
  if (dueKey !== undefined || recurrence !== undefined) {
    const nextRule = recurrence ?? task.recurrence;
    let nextDate = dueKey !== undefined ? dueKey || null : task.due_date;
    if (nextRule !== "none" && !nextDate) nextDate = toKey(new Date());
    Object.assign(changes, { due_date: nextDate, recurrence: nextRule, series_start: nextRule !== "none" ? nextDate : null });
    if (!nextDate && nextRule === "none") Object.assign(changes, { start_time: null, duration_min: null });
  }
  if (body.done === true) {
    const now = new Date().toISOString();
    if (task.recurrence === "none") Object.assign(changes, { done: true, done_at: now });
    else {
      // A repeating to-do moves to its next date, like ticking it in the dashboard.
      const steps = Array.isArray(task.checklist) ? task.checklist : [];
      Object.assign(changes, { due_date: nextDue(task.recurrence, task.series_start, task.due_date, toKey(new Date())), last_done_at: now });
      if (steps.some((s) => s.done)) changes.checklist = steps.map((s) => ({ ...s, done: false }));
    }
  } else if (body.done === false) Object.assign(changes, { done: false, done_at: null });
  else if (body.done !== undefined) throw bad("done must be true or false.");
  if (!Object.keys(changes).length) throw bad("Nothing to change.");
  return { task: taskView(must(await ctx.client.from("agent_tasks").update(changes).eq("id", task.id).select("*").single())) };
}
