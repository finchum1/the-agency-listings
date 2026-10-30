// AI connection tools for the agent's to-do list and Contacts (scope write_tasks to change, read to look). Same rules as the people tools
// (mcpWriteTools.js): runs as the agent through row-level security, validated, logged, rate limited, nothing deleted, nothing sent.
//   tasks:     add_task, update_task, complete_task, reopen_task      (the to-do list on the dashboard home page)
//   contacts:  find_contact, get_contact (read); add_contact, update_contact, add_contact_note, tag_contact, archive_contact, restore_contact
import * as people from "./bots/people.js";
import { HttpError, bad, dateKey, isUuid, number, oneOf, text } from "./bots/util.js";
import { WRITES, bool, change, ctxFor, dayText, int, obj, plusDays, str, todayKey } from "./mcpWriteTools.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RELATIONSHIPS = ["client", "past_client", "lead", "sphere", "referral_partner", "vendor", "agent", "lender", "other"];
const NOTE_KINDS = ["note", "call", "text", "email", "meeting", "showing", "other"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// ---------------------------------------------------------------------------------------------------- tasks

const dueFrom = (a) => {
  if (a.due_date !== undefined) return a.due_date;
  if (a.due_in_days !== undefined) {
    const n = Number(a.due_in_days);
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw bad("due_in_days must be a whole number of days from today (0 to 3650).");
    return plusDays(todayKey(), n);
  }
  return undefined;
};
const clock = (t) => (t ? new Date(`2000-01-01T${t.slice(0, 5)}:00`).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "");
const taskLine = (t) =>
  `"${t.title}" (id ${t.id}) — ${t.due_date ? `due ${dayText(t.due_date)}${t.start_time ? ` at ${clock(t.start_time)}` : ""}` : "no date"}${t.recurrence && t.recurrence !== "none" ? `, repeats ${t.recurrence}` : ""}${t.list ? `, list ${t.list}` : ""}${t.done ? ", done" : ""}.`;

const taskCtx = { peopleOk: true }; // the to-do list doesn't need the People module

async function addTask(sb, userId, a) {
  return change("add_task", sb, userId, async (ctx) => {
    const { task } = await people.createTask(ctx, { title: a.title, due_date: dueFrom(a), start_time: a.start_time, duration_min: a.duration_min, list: a.list, recurrence: a.recurrence, checklist: a.steps, contact_id: a.contact_id });
    return { text: `Added task ${taskLine(task)}`, audit: `task ${task.id} added` };
  }, taskCtx);
}
async function updateTask(sb, userId, a) {
  return change("update_task", sb, userId, async (ctx) => {
    const body = { title: a.title, due_date: a.clear_due ? "" : dueFrom(a), list: a.list, recurrence: a.recurrence, contact_id: a.contact_id };
    const { task } = await people.updateTask(ctx, a.id, Object.fromEntries(Object.entries(body).filter(([, v]) => v !== undefined)));
    return { text: `Updated task ${taskLine(task)}`, audit: `task ${task.id} updated` };
  }, taskCtx);
}
async function completeTask(sb, userId, a) {
  return change("complete_task", sb, userId, async (ctx) => {
    const { task } = await people.updateTask(ctx, a.id, { done: true });
    const repeats = task.recurrence && task.recurrence !== "none";
    return { text: repeats ? `Done. This repeats, so it moved to its next date: ${taskLine(task)}` : `Marked done: ${taskLine(task)}`, audit: `task ${task.id} completed` };
  }, taskCtx);
}
async function reopenTask(sb, userId, a) {
  return change("reopen_task", sb, userId, async (ctx) => {
    const { task } = await people.updateTask(ctx, a.id, { done: false });
    return { text: `Reopened ${taskLine(task)}`, audit: `task ${task.id} reopened` };
  }, taskCtx);
}

// -------------------------------------------------------------------------------------------------- contacts

async function contactsOn(ctx) {
  const { data } = await ctx.admin.from("profiles").select("people_enabled").eq("id", ctx.ownerId).maybeSingle();
  if (!data?.people_enabled) throw new HttpError(403, "The People module (which holds Contacts) isn't turned on for this account.");
}
const cname = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "(no name)";
const rel = (r) => String(r || "").replace(/_/g, " ");
const contactLine = (c) =>
  `${cname(c)}${c.company && (c.first_name || c.last_name) ? ` (${c.company})` : ""} | ${rel(c.relationship)}${c.email ? ` | ${c.email}` : ""}${c.phone ? ` | ${c.phone}` : ""}${c.archived ? " | archived" : ""} | id ${c.id}`;

async function loadContact(ctx, contactId) {
  if (!isUuid(contactId)) throw bad("That isn't a valid contact id. Use find_contact to get one.");
  const { data } = await ctx.client.from("contacts").select("*").eq("id", contactId).eq("owner_id", ctx.ownerId).maybeSingle();
  if (!data) throw new HttpError(404, "No contact with that id in your Contacts.");
  return data;
}

// Reads the contact fields an AI may set. Absent = untouched; wrong = a clear 400.
function readContact(a) {
  const f = {};
  const set = (k, v) => v !== undefined && (f[k] = v);
  for (const [k, max] of [["first_name", 80], ["last_name", 80], ["company", 120], ["phone", 40], ["address_line1", 200], ["city", 80], ["state", 40], ["zip", 20], ["source", 80], ["about", 5000]]) set(k, text(a, k, { max }));
  const email = text(a, "email", { max: 200 });
  if (email) {
    if (!EMAIL.test(email)) throw bad("email isn't a valid email address.");
    set("email", email.toLowerCase());
  } else set("email", email);
  set("relationship", oneOf(a, "relationship", RELATIONSHIPS));
  for (const k of ["birthday", "home_anniversary"]) {
    const v = dateKey(a, k);
    if (v !== undefined) set(k, v === "" ? null : v);
  }
  if (a.touch_every_days !== undefined) {
    const n = number(a, "touch_every_days", { min: 0, max: 1095, integer: true });
    set("touch_every_days", n ? n : null); // 0 turns the reminder off
  }
  if (a.do_not_contact !== undefined) {
    if (typeof a.do_not_contact !== "boolean") throw bad("do_not_contact must be true or false.");
    set("do_not_contact", a.do_not_contact);
  }
  return f;
}

async function findContact(sb, userId, a) {
  const ctx = ctxFor(sb, userId, "AI connection");
  await contactsOn(ctx);
  const term = String(a.query || "").toLowerCase().replace(/[%,()]/g, " ").trim().slice(0, 80);
  if (!term) throw bad("Give a name, email, phone, company or address fragment to search for.");
  const digits = term.replace(/\D/g, "");
  let q = sb.from("contacts").select("id, first_name, last_name, company, email, phone, relationship, archived").eq("owner_id", userId).or(digits.length >= 4 ? `search_text.ilike.%${term}%,search_text.ilike.%${digits}%` : `search_text.ilike.%${term}%`).order("last_name").order("first_name").limit(Math.min(Number(a.limit) || 15, 40));
  if (!a.include_archived) q = q.eq("archived", false);
  if (a.relationship) q = q.eq("relationship", oneOf(a, "relationship", RELATIONSHIPS));
  const { data, error } = await q;
  if (error) throw new HttpError(500, error.message);
  return data.length ? `${data.length} contact${data.length === 1 ? "" : "s"}:\n${data.map((c) => `- ${contactLine(c)}`).join("\n")}` : "No contacts match that.";
}

async function getContact(sb, userId, a) {
  const ctx = ctxFor(sb, userId, "AI connection");
  await contactsOn(ctx);
  const c = await loadContact(ctx, a.id);
  const [{ data: links }, { data: notes }, { data: tasks }, { data: cards }] = await Promise.all([
    sb.from("contact_tag_links").select("tag:contact_tags(name)").eq("contact_id", c.id),
    sb.from("contact_notes").select("kind, body, occurred_at").eq("contact_id", c.id).order("occurred_at", { ascending: false }).limit(8),
    sb.from("agent_tasks").select("id, title, due_date").eq("contact_id", c.id).eq("done", false).order("due_date", { ascending: true, nullsFirst: false }).limit(10),
    sb.from("people").select("id, name, stage_group, stage").eq("contact_id", c.id).eq("archived", false),
  ]);
  const lines = [contactLine(c)];
  const addr = [c.address_line1, c.city, [c.state, c.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (addr) lines.push(`Address: ${addr}`);
  if (c.source) lines.push(`Source: ${c.source}`);
  if (c.birthday) lines.push(`Birthday: ${dayText(c.birthday)}`);
  if (c.home_anniversary) lines.push(`Home anniversary: ${dayText(c.home_anniversary)}`);
  lines.push(`Keep in touch: ${c.touch_every_days ? `every ${c.touch_every_days} days` : "no reminder"}${c.last_contacted_at ? `; last contacted ${c.last_contacted_at.slice(0, 10)}` : "; never contacted"}${c.do_not_contact ? "; DO NOT CONTACT" : ""}`);
  const tagNames = (links || []).map((l) => l.tag?.name).filter(Boolean);
  if (tagNames.length) lines.push(`Tags: ${tagNames.join(", ")}`);
  if (c.about) lines.push(`About: ${c.about}`);
  if (cards?.length) lines.push(`On a board: ${cards.map((p) => `${p.name} (${p.stage_group} › ${p.stage}, person id ${p.id})`).join("; ")}`);
  if (tasks?.length) lines.push(`Open follow-ups:\n${tasks.map((t) => `- ${t.title}${t.due_date ? ` (due ${t.due_date})` : ""} [task id ${t.id}]`).join("\n")}`);
  if (notes?.length) lines.push(`Recent activity:\n${notes.map((n) => `- ${n.occurred_at.slice(0, 10)} ${n.kind}: ${n.body.slice(0, 300)}`).join("\n")}`);
  return lines.join("\n");
}

async function addContact(sb, userId, a) {
  return change("add_contact", sb, userId, async (ctx) => {
    await contactsOn(ctx);
    const f = readContact(a);
    if (!f.first_name && !f.last_name && !f.company) throw bad("Give at least a first name, last name or company.");
    if (f.email && a.allow_duplicate !== true) {
      const { data: dup } = await sb.from("contacts").select("id, first_name, last_name, company, archived").eq("owner_id", userId).ilike("email", f.email).limit(1).maybeSingle();
      if (dup) throw new HttpError(409, `${cname(dup)} already has that email${dup.archived ? " (archived)" : ""} (id ${dup.id}). Update them instead, or send allow_duplicate: true.`);
    }
    const { data: c, error } = await sb.from("contacts").insert({ ...f, relationship: f.relationship || "other", source: f.source || "Added by AI" }).select("*").single();
    if (error) throw new HttpError(error.code === "23514" ? 400 : 500, error.message);
    if (Array.isArray(a.tags) && a.tags.length) await applyTags(sb, userId, c.id, a.tags, []);
    return { text: `Added contact ${contactLine(c)}`, audit: `contact ${c.id} added` };
  });
}

async function updateContact(sb, userId, a) {
  return change("update_contact", sb, userId, async (ctx) => {
    await contactsOn(ctx);
    const c = await loadContact(ctx, a.id);
    const f = readContact(a);
    if (!Object.keys(f).length) throw bad("Nothing to change. Send at least one field.");
    const { data, error } = await sb.from("contacts").update(f).eq("id", c.id).select("*").single();
    if (error) throw new HttpError(error.code === "23514" ? 400 : 500, error.message);
    return { text: `Updated contact ${contactLine(data)}`, audit: `contact ${c.id} updated: ${Object.keys(f).join(", ")}` };
  });
}

async function addContactNote(sb, userId, a) {
  return change("add_contact_note", sb, userId, async (ctx) => {
    await contactsOn(ctx);
    const c = await loadContact(ctx, a.id);
    const kind = oneOf(a, "kind", NOTE_KINDS) || "note";
    const body = text(a, "text", { required: true, max: 5000 });
    let occurred = new Date().toISOString();
    if (a.date) {
      const d = dateKey(a, "date");
      occurred = new Date(`${d}T12:00:00Z`).toISOString();
    }
    const { error } = await sb.from("contact_notes").insert({ contact_id: c.id, kind, body, occurred_at: occurred });
    if (error) throw new HttpError(500, error.message);
    const touched = ["call", "text", "email", "meeting", "showing"].includes(kind);
    return { text: `Logged ${kind === "note" ? "a note" : `a ${kind}`} for ${cname(c)}${touched ? ", which counts as being in touch" : ""}.`, audit: `contact ${c.id} ${kind} logged` };
  });
}

// Tag names -> tags (made when they don't exist yet), then linked or unlinked.
async function applyTags(sb, userId, contactId, add, remove) {
  const clean = (list) => [...new Set((list || []).map((t) => String(t).trim()).filter(Boolean))].slice(0, 10);
  const names = clean(add);
  if (names.some((n) => n.length > 40)) throw bad("A tag name can be at most 40 characters.");
  const { data: existing } = await sb.from("contact_tags").select("id, name").eq("owner_id", userId);
  const byName = new Map((existing || []).map((t) => [t.name.toLowerCase(), t]));
  for (const name of names) {
    let tag = byName.get(name.toLowerCase());
    if (!tag) {
      const { data, error } = await sb.from("contact_tags").insert({ name }).select("id, name").single();
      if (error) throw new HttpError(500, error.message);
      tag = data;
      byName.set(name.toLowerCase(), tag);
    }
    await sb.from("contact_tag_links").upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
  }
  for (const name of clean(remove)) {
    const tag = byName.get(name.toLowerCase());
    if (tag) await sb.from("contact_tag_links").delete().eq("contact_id", contactId).eq("tag_id", tag.id);
  }
}

async function tagContact(sb, userId, a) {
  return change("tag_contact", sb, userId, async (ctx) => {
    await contactsOn(ctx);
    const c = await loadContact(ctx, a.id);
    if (!a.add?.length && !a.remove?.length) throw bad("Send tags to add and/or remove.");
    await applyTags(sb, userId, c.id, a.add, a.remove);
    return { text: `Tags updated for ${cname(c)}${a.add?.length ? `; added ${a.add.join(", ")}` : ""}${a.remove?.length ? `; removed ${a.remove.join(", ")}` : ""}.`, audit: `contact ${c.id} tags changed` };
  });
}

async function setArchived(tool, sb, userId, a, archived) {
  return change(tool, sb, userId, async (ctx) => {
    await contactsOn(ctx);
    const c = await loadContact(ctx, a.id);
    const { error } = await sb.from("contacts").update({ archived }).eq("id", c.id);
    if (error) throw new HttpError(500, error.message);
    return { text: archived ? `Archived ${cname(c)}. Nothing is deleted: restore_contact brings them back.` : `Restored ${cname(c)}.`, audit: `contact ${c.id} ${archived ? "archived" : "restored"}` };
  });
}

const DUE = { due_date: str("Due day, YYYY-MM-DD."), due_in_days: int("Or: days from today (0 = today, 1 = tomorrow).") };
const CONTACT_FIELDS = {
  first_name: str("First name"), last_name: str("Last name"), company: str("Company"), email: str("Email address"), phone: str("Phone number"),
  relationship: { type: "string", enum: RELATIONSHIPS, description: "How they relate to the agent" },
  address_line1: str("Street address"), city: str("City"), state: str("State"), zip: str("Zip code"), source: str("Where they came from"),
  about: str("Free-text notes about them"), birthday: str("YYYY-MM-DD"), home_anniversary: str("YYYY-MM-DD, the day they closed on their home"),
  touch_every_days: int("Remind the agent to get in touch after this many days (0 turns the reminder off)"),
  do_not_contact: bool("true marks them do-not-contact"),
};

export const TASK_TOOLS = [
  {
    name: "add_task", title: "Add a to-do", scope: "write_tasks", annotations: WRITES, run: addTask,
    description: "Add a to-do to the agent's list (the Tasks on their dashboard home), optionally with a day, a time block, a list label, a repeat and checklist steps. Pass contact_id to make it a follow-up for a contact.",
    inputSchema: obj({ title: str("What to do"), ...DUE, start_time: str("24-hour time, e.g. 14:30 (needs a due day)"), duration_min: int("Minutes, with start_time (default 60)"), list: str("A list label, e.g. Work"), recurrence: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "quarterly", "yearly"] }, steps: { type: "array", items: { type: "string" }, description: "Checklist steps" }, contact_id: str("A contact id from find_contact, to make this that contact's follow-up") }, ["title"]),
  },
  {
    name: "update_task", title: "Change a to-do", scope: "write_tasks", annotations: WRITES, run: updateTask,
    description: "Change a to-do's title, day, list or repeat, or link it to a contact. Use complete_task to tick it off.",
    inputSchema: obj({ id: str("Task id from list_tasks"), title: str("New title"), ...DUE, clear_due: bool("true removes the day"), list: str("New list label"), recurrence: { type: "string", enum: ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "quarterly", "yearly"] }, contact_id: str("A contact id to link, or an empty string to unlink") }, ["id"]),
  },
  {
    name: "complete_task", title: "Tick off a to-do", scope: "write_tasks", annotations: WRITES, run: completeTask,
    description: "Mark a to-do done. A repeating one moves to its next date instead, like ticking it in the dashboard.",
    inputSchema: obj({ id: str("Task id from list_tasks") }, ["id"]),
  },
  {
    name: "reopen_task", title: "Reopen a to-do", scope: "write_tasks", annotations: WRITES, run: reopenTask,
    description: "Mark a finished to-do as not done.",
    inputSchema: obj({ id: str("Task id from list_tasks (include_done: true)") }, ["id"]),
  },
  {
    name: "find_contact", title: "Find a contact", scope: "read", annotations: READ, run: findContact,
    description: "Search the agent's Contacts (their private database) by name, email, phone, company or address. Returns ids for get_contact and the contact tools.",
    inputSchema: obj({ query: str("Name, email, phone, company or address fragment"), relationship: { type: "string", enum: RELATIONSHIPS }, include_archived: bool("Include archived contacts"), limit: int("Max results (default 15, up to 40)") }, ["query"]),
  },
  {
    name: "get_contact", title: "Get a contact", scope: "read", annotations: READ, run: getContact,
    description: "One contact in full: details, tags, keep-in-touch reminder, last contact, open follow-ups, recent activity and any Leads/Pipeline cards they are on.",
    inputSchema: obj({ id: str("Contact id from find_contact") }, ["id"]),
  },
  {
    name: "add_contact", title: "Add a contact", scope: "write_tasks", annotations: WRITES, run: addContact,
    description: "Add someone to the agent's Contacts database (not a lead card; use add_person for Leads and Pipeline). Needs a first name, last name or company. Refuses a duplicate email unless the agent confirmed. Check with the agent first unless they gave you the details.",
    inputSchema: obj({ ...CONTACT_FIELDS, tags: { type: "array", items: { type: "string" }, description: "Tag names to put on them (created if new)" }, allow_duplicate: bool("Only if the agent confirmed a second contact with this email is right") }),
  },
  {
    name: "update_contact", title: "Update a contact", scope: "write_tasks", annotations: WRITES, run: updateContact,
    description: "Change a contact's details, relationship, keep-in-touch reminder or do-not-contact flag. Only the fields you send change.",
    inputSchema: obj({ id: str("Contact id from find_contact"), ...CONTACT_FIELDS }, ["id"]),
  },
  {
    name: "add_contact_note", title: "Log a note or touch on a contact", scope: "write_tasks", annotations: WRITES, run: addContactNote,
    description: "Add a note to a contact's activity. A call, text, email, meeting or showing also counts as being in touch (resets their reminder).",
    inputSchema: obj({ id: str("Contact id from find_contact"), text: str("What happened or what to remember"), kind: { type: "string", enum: NOTE_KINDS, description: "Default note" }, date: str("YYYY-MM-DD when it happened (default now)") }, ["id", "text"]),
  },
  {
    name: "tag_contact", title: "Tag a contact", scope: "write_tasks", annotations: WRITES, run: tagContact,
    description: "Add and/or remove tags on a contact. New tag names are created.",
    inputSchema: obj({ id: str("Contact id from find_contact"), add: { type: "array", items: { type: "string" } }, remove: { type: "array", items: { type: "string" } } }, ["id"]),
  },
  {
    name: "archive_contact", title: "Archive a contact", scope: "write_tasks", annotations: WRITES, run: (sb, u, a) => setArchived("archive_contact", sb, u, a, true),
    description: "Hide a contact from the main list. Never deletes; restore_contact brings them back. Ask the agent first.",
    inputSchema: obj({ id: str("Contact id from find_contact") }, ["id"]),
  },
  {
    name: "restore_contact", title: "Restore a contact", scope: "write_tasks", annotations: WRITES, run: (sb, u, a) => setArchived("restore_contact", sb, u, a, false),
    description: "Bring an archived contact back.",
    inputSchema: obj({ id: str("Contact id (find_contact with include_archived)") }, ["id"]),
  },
];
