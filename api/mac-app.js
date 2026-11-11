// What the Latchpoint Mac app asks of the dashboard besides text sync (api/text-sync.js): the "Today" list for notifications and the menu bar, marking a
// website lead as answered, and quick add. Signed with the Mac's own device key (Authorization: Bearer ts_...), never a browser session, so the app needs no
// sign-in handling of its own. Every read and write is filtered to the key's owner here, because this uses the service role.
//   GET  /api/mac-app?a=today        leads waiting for a first reply, follow-ups due, deal tasks due
//   POST /api/mac-app?a=responded    {person_id}   the agent called or texted a waiting lead from a notification
//   GET  /api/mac-app?a=search&q=    contacts matching a name, phone number or email (for quick add)
//   POST /api/mac-app?a=note         {contact_id, kind, body}
//   POST /api/mac-app?a=task         {title, due_date?, contact_id?, recurrence?, list?, today?}   returns the new task
// Follow-ups and deal tasks that are due, dealt with from the Today window:
//   POST /api/mac-app?a=followup_done   {person_id, today}   "Followed up": the next follow-up is today + the column's cadence (none when the column has none)
//   POST /api/mac-app?a=followup_set    {person_id, date}    a chosen next follow-up date, or null to clear it
//   POST /api/mac-app?a=deal_task_done  {task_id, done}      tick a deal checklist task off (or back on)
//   POST /api/mac-app?a=deal_task_due   {task_id, date}      move a deal task to a day (its due_override), or null to go back to the deal's own rule
// The native Deals window (read-only, plus the checklist actions above):
//   GET  /api/mac-app?a=deals           your deals and, for a coordinator, the deals they coordinate; the board's stages; each deal's checklist and document progress
//   GET  /api/mac-app?a=deal&deal_id=   one deal: dates, money, the people on it, its checklist (with each task's due day) and its documents
// The native Today window's to-do list (agent_tasks), done the way the dashboard does it (src/hooks/useAgentTasks.js):
//   GET  /api/mac-app?a=tasks              open tasks, and ones finished in the last two weeks, each with its contact's name
//   POST /api/mac-app?a=task_complete      {task_id, today}   a one-off is marked done; a repeating one moves to its next date
//   POST /api/mac-app?a=task_reopen        {task_id}
//   POST /api/mac-app?a=task_update        {task_id, changes: {title?, due_date?, list?, checklist?}}
//   POST /api/mac-app?a=task_delete        {task_id}
//   POST /api/mac-app?a=contact      {first_name, last_name, company, phone, email, relationship?, force?}   a duplicate is reported, not created, unless force
// The native Contacts window:
//   GET  /api/mac-app?a=contacts&since=   every contact changed since then (all of them without `since`), the ids that exist now (so deletions show), tags, tag links, open follow-ups
//   GET  /api/mac-app?a=history&contact_id=   that contact's notes, synced texts and calls, and card notes, newest first
//   POST /api/mac-app?a=update       {contact_id, changes}   a few fields of one contact (see EDITABLE)
//   POST /api/mac-app?a=tag          {contact_id, name, on}   put a tag (made if new) on a contact, or take it off
import { serviceClient } from "./_lib/authUser.js";
import { deviceFor } from "./_lib/macDevice.js";
import { effectiveDue } from "../src/lib/checklistDefaults.js";
import { touchDue } from "../src/lib/contacts.js";
import { nextDue } from "../src/lib/taskRecurrence.js";
import { cleanList, cleanSteps } from "../src/lib/taskLists.js";

const TZ = "America/Chicago";
const DAY = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_KINDS = ["note", "call", "text", "email", "meeting", "showing", "other"];
const RELATIONSHIPS = ["client", "past_client", "lead", "sphere", "referral_partner", "vendor", "agent", "lender", "other"];

const CONTACT_COLUMNS = "id, first_name, last_name, company, email, phone, other_emails, other_phones, address_line1, city, state, zip, birthday, home_anniversary, relationship, source, about, touch_every_days, last_contacted_at, do_not_contact, archived, text_sync, created_at, updated_at";
// What the Mac app may change on a contact, and how each value is cleaned. Anything else in `changes` is ignored.
const EDITABLE = {
  first_name: (v) => String(v ?? "").trim().slice(0, 80),
  last_name: (v) => String(v ?? "").trim().slice(0, 80),
  company: (v) => String(v ?? "").trim().slice(0, 120),
  phone: (v) => String(v ?? "").trim().slice(0, 40),
  email: (v) => String(v ?? "").trim().toLowerCase().slice(0, 254),
  about: (v) => String(v ?? "").slice(0, 5000),
  relationship: (v) => (RELATIONSHIPS.includes(v) ? v : undefined),
  touch_every_days: (v) => (v === null || v === "" ? null : Number.isInteger(v) && v >= 1 && v <= 1095 ? v : undefined),
  text_sync: (v) => (typeof v === "boolean" ? v : undefined),
  do_not_contact: (v) => (typeof v === "boolean" ? v : undefined),
};

const DEAL_COLUMNS = "id, owner_id, name, email, phone, stage, side, property_address, price, commission, contract_date, inspection_date, inspection_period_end, inspection_time, appraisal_date, financing_deadline, closing_date, closing_time, is_cash, financing_type, compliance_status, earnest_money, earnest_money_delivered, earnest_money_delivered_at, updated_at, contact_id";
const DEAL_PARTY_COLUMNS = "client2_name, client2_email, other_agent, other_agent_email, other_agent_company, other_agent_phone, other_agent2, other_agent2_email, other_agent2_company, other_agent2_phone, other_agent_tc_name, other_agent_tc_email, title_company, title_company_email, title_phone, title_processor_name, title_processor_email, escrow_officer, escrow_officer_email, lender, lender_email, lender_phone, loan_processor_name, loan_processor_email, other_party_name";
const DEFAULT_DEAL_STAGES = ["Listings", "Pending", "Closing Soon", "Closed"];
const TASK_COLUMNS = "id, title, due_date, recurrence, series_start, done, done_at, last_done_at, start_time, duration_min, list, checklist, contact_id, created_at";
const RECURRENCES = ["none", "daily", "weekdays", "weekly", "biweekly", "monthly", "quarterly", "yearly"];

const todayKey = () => new Date().toLocaleDateString("en-CA", { timeZone: TZ });
const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "Contact";
const digits = (v) => String(v || "").replace(/\D/g, "");

async function readAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

/** The closed column of a deal board: the one named in settings, else "Closed", else the last. */
function closedStageOf(settings) {
  const list = Array.isArray(settings?.stages?.transaction) ? settings.stages.transaction : ["Pending", "Closing Soon", "Closed"];
  const named = settings?.stages?.transaction_closed;
  return named && list.includes(named) ? named : list.includes("Closed") ? "Closed" : list[list.length - 1];
}

async function today(admin, owner) {
  const day = todayKey();
  const waitingSince = new Date(Date.now() - 3 * DAY).toISOString();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    admin.from("profiles").select("deals_role").eq("id", owner).maybeSingle(),
    admin.from("people_settings").select("stages").eq("owner_id", owner).maybeSingle(),
  ]);

  // Website leads nobody has answered yet (the dashboard's "Waiting" timer): newest first, and only for three days.
  const { data: waitingRows } = await admin
    .from("people")
    .select("id, name, phone, email, lead_id, created_at, source")
    .eq("owner_id", owner).eq("stage_group", "lead").eq("archived", false).not("lead_id", "is", null).is("first_response_at", null).gte("created_at", waitingSince)
    .order("created_at", { ascending: false }).limit(25);
  const leadIds = (waitingRows || []).map((p) => p.lead_id);
  const { data: leadRows } = leadIds.length ? await admin.from("leads").select("id, message, target_type").in("id", leadIds) : { data: [] };
  const leadById = new Map((leadRows || []).map((l) => [l.id, l]));
  const waiting = (waitingRows || []).map((p) => ({
    id: p.id, name: p.name, phone: p.phone || "", email: p.email || "", message: (leadById.get(p.lead_id)?.message || "").slice(0, 300),
    source: leadById.get(p.lead_id)?.target_type === "agent_site" ? "your website" : "a property site", arrived: p.created_at, path: `/dashboard/people/leads?person=${p.id}`,
  }));
  const waitingIds = new Set(waiting.map((w) => w.id));

  // People (leads and pipeline) whose follow-up date has come, and the agent's own tasks due today or overdue.
  const { data: dueRows } = await admin
    .from("people").select("id, name, phone, stage_group, stage, next_follow_up")
    .eq("owner_id", owner).in("stage_group", ["lead", "pipeline"]).eq("archived", false).lte("next_follow_up", day).order("next_follow_up").limit(40);
  const { data: taskRows } = await admin
    .from("agent_tasks").select("id, title, due_date, contact_id").eq("owner_id", owner).eq("done", false).not("due_date", "is", null).lte("due_date", day).order("due_date").limit(40);
  const contactIds = [...new Set((taskRows || []).map((t) => t.contact_id).filter(Boolean))];
  const { data: contactRows } = contactIds.length ? await admin.from("contacts").select("id, first_name, last_name, company, phone").eq("owner_id", owner).in("id", contactIds) : { data: [] };
  const contactById = new Map((contactRows || []).map((c) => [c.id, c]));
  const followups = [
    ...(dueRows || []).filter((p) => !waitingIds.has(p.id)).map((p) => ({
      id: `p:${p.id}`, kind: "person", title: `Follow up with ${p.name}`, name: p.name, phone: p.phone || "", due: p.next_follow_up,
      path: `/dashboard/people/${p.stage_group === "lead" ? "leads" : "pipeline"}?person=${p.id}`,
    })),
    ...(taskRows || []).map((t) => {
      const c = t.contact_id ? contactById.get(t.contact_id) : null;
      return { id: `t:${t.id}`, kind: "task", title: t.title, name: c ? fullName(c) : "", phone: c?.phone || "", due: t.due_date, path: c ? `/dashboard/people/contacts?contact=${c.id}` : "/dashboard" };
    }),
  ];

  // Contacts past their "keep in touch" reminder: counted, not listed.
  const touchRows = await readAll(() => admin.from("contacts").select("id, touch_every_days, last_contacted_at, created_at, archived, do_not_contact").eq("owner_id", owner).eq("archived", false).not("touch_every_days", "is", null).order("id"));
  const touches = touchRows.filter(touchDue).length;

  // Deal tasks due today or overdue on open deals: the agent's own, plus a coordinator's deals (same rule as the Deals bubble).
  const closed = closedStageOf(settings);
  const deals = (await readAll(() => admin.from("people").select("id, name, property_address, stage, owner_id, contract_date, inspection_date, closing_date").eq("owner_id", owner).eq("stage_group", "transaction").eq("archived", false).order("id"))).filter((d) => d.stage !== closed);
  if (profile?.deals_role === "tc") {
    const [{ data: per }, { data: wide }, { data: placed }] = await Promise.all([
      admin.from("deal_tcs").select("person_id").eq("tc_id", owner),
      admin.from("deal_team").select("agent_id").eq("tc_id", owner),
      admin.from("deal_tc_stages").select("person_id, stage").eq("tc_id", owner),
    ]);
    const mine = new Set((per || []).map((r) => r.person_id));
    const agents = new Set((wide || []).map((r) => r.agent_id));
    const column = new Map((placed || []).map((r) => [r.person_id, r.stage]));
    const others = await readAll(() => admin.from("people").select("id, name, property_address, stage, owner_id, contract_date, inspection_date, closing_date").eq("stage_group", "transaction").eq("archived", false).neq("owner_id", owner).order("id"));
    for (const d of others) if ((mine.has(d.id) || agents.has(d.owner_id)) && (column.get(d.id) || d.stage) !== closed) deals.push(d);
  }
  let dealTasks = [];
  if (deals.length) {
    const byId = new Map(deals.map((d) => [d.id, d]));
    const tasks = await readAll(() => {
      const q = admin.from("transaction_tasks").select("id, person_id, text, anchor, offset_days, due_override, done").eq("done", false).order("id");
      return profile?.deals_role === "tc" ? q.in("person_id", [...byId.keys()]) : q.eq("owner_id", owner);
    });
    dealTasks = tasks
      .map((t) => ({ t, d: byId.get(t.person_id) }))
      .filter(({ t, d }) => d && (effectiveDue(t, d) || "9999") <= day)
      .map(({ t, d }) => ({ id: t.id, title: t.text || "Task", deal: d.property_address || d.name, due: effectiveDue(t, d), path: `/dashboard/deals/board?deal=${d.id}` }))
      .sort((a, b) => String(a.due).localeCompare(String(b.due)))
      .slice(0, 40);
  }

  return {
    now: new Date().toISOString(), day,
    counts: { waiting: waiting.length, followups: followups.length, dealTasks: dealTasks.length, touches, total: waiting.length + followups.length + dealTasks.length },
    waiting, followups, dealTasks,
  };
}

/** The deals this person can see in Deals: their own, plus (for a coordinator) the deals they coordinate for other agents. */
async function visibleDeals(admin, owner, columns) {
  const { data: profile } = await admin.from("profiles").select("deals_role, full_name").eq("id", owner).maybeSingle();
  const own = await readAll(() => admin.from("people").select(columns).eq("owner_id", owner).eq("stage_group", "transaction").eq("archived", false).order("id"));
  const deals = own.map((d) => ({ ...d, _foreign: false, _agent: profile?.full_name || "", _column: "" }));
  if (profile?.deals_role === "tc") {
    const [{ data: per }, { data: wide }, { data: placed }] = await Promise.all([
      admin.from("deal_tcs").select("person_id").eq("tc_id", owner),
      admin.from("deal_team").select("agent_id").eq("tc_id", owner),
      admin.from("deal_tc_stages").select("person_id, stage").eq("tc_id", owner),
    ]);
    const mine = new Set((per || []).map((r) => r.person_id)), agents = new Set((wide || []).map((r) => r.agent_id));
    const column = new Map((placed || []).map((r) => [r.person_id, r.stage]));
    const others = (await readAll(() => admin.from("people").select(columns).eq("stage_group", "transaction").eq("archived", false).neq("owner_id", owner).order("id"))).filter((d) => mine.has(d.id) || agents.has(d.owner_id));
    const owners = [...new Set(others.map((d) => d.owner_id))];
    const { data: profs } = owners.length ? await admin.from("profiles").select("id, full_name").in("id", owners) : { data: [] };
    const names = new Map((profs || []).map((p) => [p.id, p.full_name]));
    for (const d of others) deals.push({ ...d, _foreign: true, _agent: names.get(d.owner_id) || "", _column: column.get(d.id) || "" });
  }
  return { deals, profile };
}

/** Done / total of a checklist table for each of these deals. */
async function progressOf(admin, table, ids) {
  const out = new Map(ids.map((id) => [id, { done: 0, total: 0 }]));
  for (let i = 0; i < ids.length; i += 100) {
    const rows = await readAll(() => admin.from(table).select("person_id, done").in("person_id", ids.slice(i, i + 100)).order("id"));
    for (const r of rows) { const p = out.get(r.person_id); if (p) { p.total += 1; if (r.done) p.done += 1; } }
  }
  return out;
}

const bad = (res, message, code = 400) => res.status(code).json({ error: message });

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return bad(res, "Server not configured.", 500);
  }
  const dev = await deviceFor(admin, req);
  if (!dev) return bad(res, "This Mac isn't connected anymore. Sign in to Latchpoint to connect it again.", 401);
  const owner = dev.owner_id;
  const a = String(req.query?.a || "");
  const body = req.body && typeof req.body === "object" ? req.body : {};

  try {
    if (req.method === "GET" && a === "today") return res.status(200).json(await today(admin, owner));

    if (req.method === "GET" && a === "search") {
      const q = String(req.query?.q || "").trim().toLowerCase().slice(0, 60);
      if (q.length < 2) return res.status(200).json({ contacts: [] });
      const d = digits(q);
      const clause = [`search_text.ilike.%${q.replace(/[%,()]/g, " ")}%`, ...(d.length >= 4 ? [`search_text.ilike.%${d}%`] : [])].join(",");
      const { data } = await admin.from("contacts").select("id, first_name, last_name, company, phone, email, relationship").eq("owner_id", owner).eq("archived", false).or(clause).order("last_contacted_at", { ascending: false, nullsFirst: false }).limit(8);
      return res.status(200).json({ contacts: (data || []).map((c) => ({ id: c.id, name: fullName(c), phone: c.phone || "", email: c.email || "", relationship: c.relationship })) });
    }

    if (req.method === "GET" && a === "contacts") {
      const since = String(req.query?.since || "");
      const now = new Date().toISOString();
      const changed = () => {
        let q = admin.from("contacts").select(CONTACT_COLUMNS).eq("owner_id", owner).order("id");
        if (since && !Number.isNaN(Date.parse(since))) q = q.gte("updated_at", new Date(since).toISOString());
        return q;
      };
      const [rows, ids, tags, links, tasks] = await Promise.all([
        readAll(changed),
        readAll(() => admin.from("contacts").select("id").eq("owner_id", owner).order("id")),
        admin.from("contact_tags").select("id, name, color").eq("owner_id", owner).order("name"),
        readAll(() => admin.from("contact_tag_links").select("contact_id, tag_id").eq("owner_id", owner).order("contact_id").order("tag_id")),
        readAll(() => admin.from("agent_tasks").select("contact_id, due_date").eq("owner_id", owner).eq("done", false).not("contact_id", "is", null).order("id")),
      ]);
      const next = new Map();
      for (const t of tasks) {
        const d = t.due_date || "";
        if (!next.has(t.contact_id) || (d && (!next.get(t.contact_id) || d < next.get(t.contact_id)))) next.set(t.contact_id, d);
      }
      return res.status(200).json({ now, contacts: rows, ids: ids.map((r) => r.id), tags: tags.data || [], links, followups: [...next].map(([contact_id, due]) => ({ contact_id, due })) });
    }

    if (req.method === "GET" && a === "tasks") {
      const since = new Date(Date.now() - 14 * DAY).toISOString();
      const [open, done] = await Promise.all([
        readAll(() => admin.from("agent_tasks").select(TASK_COLUMNS).eq("owner_id", owner).eq("done", false).order("due_date", { ascending: true, nullsFirst: false }).order("created_at").order("id")),
        admin.from("agent_tasks").select(TASK_COLUMNS).eq("owner_id", owner).eq("done", true).gte("done_at", since).order("done_at", { ascending: false }).limit(100),
      ]);
      const rows = [...open, ...(done.data || [])];
      const contactIds = [...new Set(rows.map((t) => t.contact_id).filter(Boolean))];
      const names = new Map();
      for (let i = 0; i < contactIds.length; i += 100) {
        const { data } = await admin.from("contacts").select("id, first_name, last_name, company").eq("owner_id", owner).in("id", contactIds.slice(i, i + 100));
        for (const c of data || []) names.set(c.id, fullName(c));
      }
      return res.status(200).json({ tasks: rows.map((t) => ({ ...t, checklist: Array.isArray(t.checklist) ? t.checklist : [], contact_name: t.contact_id ? names.get(t.contact_id) || "" : "" })) });
    }

    if (req.method === "GET" && a === "deals") {
      const { deals } = await visibleDeals(admin, owner, DEAL_COLUMNS);
      const { data: settings } = await admin.from("people_settings").select("stages").eq("owner_id", owner).maybeSingle();
      const stages = Array.isArray(settings?.stages?.transaction) && settings.stages.transaction.length ? settings.stages.transaction : DEFAULT_DEAL_STAGES;
      const named = settings?.stages?.transaction_closed;
      const closed = named && stages.includes(named) ? named : stages.includes("Closed") ? "Closed" : stages[stages.length - 1];
      const ids = deals.map((d) => d.id);
      const [tasks, docs] = await Promise.all([progressOf(admin, "transaction_tasks", ids), progressOf(admin, "transaction_documents", ids)]);
      return res.status(200).json({
        stages, closed,
        deals: deals.map((d) => ({ ...d, column: d._foreign ? d._column || d.stage : d.stage, foreign: d._foreign, agent: d._agent, tasks: tasks.get(d.id), docs: docs.get(d.id), _foreign: undefined, _agent: undefined, _column: undefined })),
      });
    }

    if (req.method === "GET" && a === "deal") {
      const id = String(req.query?.deal_id || "");
      if (!UUID.test(id)) return bad(res, "Missing deal.");
      const { deals } = await visibleDeals(admin, owner, `${DEAL_COLUMNS}, ${DEAL_PARTY_COLUMNS}`);
      const deal = deals.find((d) => d.id === id);
      if (!deal) return bad(res, "Deal not found.", 404);
      const [tasks, docs] = await Promise.all([
        admin.from("transaction_tasks").select("id, section, position, text, anchor, offset_days, due_override, done, done_at").eq("person_id", id).order("position").limit(500),
        admin.from("transaction_documents").select("id, section, position, text, done, review_status").eq("person_id", id).order("position").limit(500),
      ]);
      const { _foreign, _agent, _column, ...rest } = deal;
      return res.status(200).json({
        deal: { ...rest, column: _foreign ? _column || rest.stage : rest.stage, foreign: _foreign, agent: _agent },
        tasks: (tasks.data || []).map((t) => ({ id: t.id, section: t.section, position: t.position, text: t.text, done: t.done, done_at: t.done_at, due_override: t.due_override, due: effectiveDue(t, deal) || null })),
        docs: docs.data || [],
      });
    }

    if (req.method === "GET" && a === "history") {
      const id = String(req.query?.contact_id || "");
      if (!UUID.test(id)) return bad(res, "Missing contact.");
      const { data: contact } = await admin.from("contacts").select("id").eq("id", id).eq("owner_id", owner).maybeSingle();
      if (!contact) return bad(res, "Contact not found.", 404);
      const { data: cards } = await admin.from("people").select("id").eq("owner_id", owner).eq("contact_id", id);
      const cardIds = (cards || []).map((c) => c.id);
      const [notes, msgs, cardNotes] = await Promise.all([
        admin.from("contact_notes").select("id, kind, body, occurred_at").eq("contact_id", id).eq("owner_id", owner).order("occurred_at", { ascending: false }).limit(200),
        admin.from("contact_messages").select("id, kind, direction, body, duration_seconds, occurred_at").eq("contact_id", id).eq("owner_id", owner).order("occurred_at", { ascending: false }).limit(300),
        cardIds.length ? admin.from("people_notes").select("id, body, created_at").in("person_id", cardIds).order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] }),
      ]);
      const items = [
        ...(msgs.data || []).map((m) => ({ id: `m${m.id}`, kind: m.kind === "call" ? "synced_call" : "synced_text", direction: m.direction, seconds: m.duration_seconds, body: m.body, at: m.occurred_at })),
        ...(notes.data || []).map((n) => ({ id: `c${n.id}`, kind: n.kind, direction: null, seconds: null, body: n.body, at: n.occurred_at })),
        ...(cardNotes.data || []).map((n) => ({ id: `p${n.id}`, kind: "card", direction: null, seconds: null, body: n.body, at: n.created_at })),
      ].sort((x, y) => y.at.localeCompare(x.at));
      return res.status(200).json({ items });
    }

    if (req.method !== "POST") return bad(res, "Not found.", 404);

    if (a === "responded") {
      if (!UUID.test(String(body.person_id || ""))) return bad(res, "Missing person.");
      await admin.from("people").update({ first_response_at: new Date().toISOString() }).eq("id", body.person_id).eq("owner_id", owner).not("lead_id", "is", null).is("first_response_at", null);
      return res.status(200).json({ ok: true });
    }

    const taskOut = async (t) => {
      let name = "";
      if (t.contact_id) {
        const { data } = await admin.from("contacts").select("first_name, last_name, company").eq("id", t.contact_id).eq("owner_id", owner).maybeSingle();
        name = data ? fullName(data) : "";
      }
      return { ...t, checklist: Array.isArray(t.checklist) ? t.checklist : [], contact_name: name };
    };
    const ownsContact = async (id) => {
      if (!UUID.test(String(id || ""))) return null;
      const { data } = await admin.from("contacts").select("id, first_name, last_name, company").eq("id", id).eq("owner_id", owner).maybeSingle();
      return data || null;
    };

    if (a === "note") {
      const kind = NOTE_KINDS.includes(body.kind) ? body.kind : "note";
      const text = String(body.body || "").trim().slice(0, 5000);
      if (!text && kind === "note") return bad(res, "Write something first.");
      const contact = await ownsContact(body.contact_id);
      if (!contact) return bad(res, "Pick a contact.");
      const { error } = await admin.from("contact_notes").insert({ contact_id: contact.id, owner_id: owner, kind, body: text });
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, contact: fullName(contact) });
    }

    if (a === "task") {
      const title = String(body.title || "").trim().slice(0, 300);
      if (!title) return bad(res, "Give the task a title.");
      let due = DATE.test(String(body.due_date || "")) ? body.due_date : null;
      const rule = RECURRENCES.includes(body.recurrence) ? body.recurrence : "none";
      // A repeating task needs a date to repeat from: default to today.
      if (rule !== "none" && !due) due = DATE.test(String(body.today || "")) ? body.today : todayKey();
      let contactId = null;
      if (body.contact_id) {
        const contact = await ownsContact(body.contact_id);
        if (!contact) return bad(res, "That contact isn't yours.");
        contactId = contact.id;
      }
      const { data, error } = await admin.from("agent_tasks").insert({ owner_id: owner, title, due_date: due, recurrence: rule, series_start: rule !== "none" ? due : null, list: cleanList(body.list), ...(contactId ? { contact_id: contactId } : {}) }).select(TASK_COLUMNS).single();
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, task: await taskOut(data) });
    }

    if (a === "followup_done" || a === "followup_set") {
      if (!UUID.test(String(body.person_id || ""))) return bad(res, "Missing person.");
      const { data: person } = await admin.from("people").select("id, stage_group, stage, next_follow_up, lead_id, first_response_at, archived").eq("id", body.person_id).eq("owner_id", owner).maybeSingle();
      if (!person || !["lead", "pipeline"].includes(person.stage_group)) return bad(res, "That person isn't yours.", 404);
      let next;
      if (a === "followup_set") {
        if (body.date !== null && body.date !== undefined && !DATE.test(String(body.date))) return bad(res, "That date doesn't look right.");
        next = body.date || null;
      } else {
        // "Followed up": a lead that was still waiting for a first reply counts as answered, and the next follow-up follows the column's cadence.
        if (person.lead_id && !person.first_response_at) await admin.from("people").update({ first_response_at: new Date().toISOString() }).eq("id", person.id).eq("owner_id", owner).is("first_response_at", null);
        const today = DATE.test(String(body.today || "")) ? body.today : todayKey();
        const { data: days } = await admin.rpc("people_cadence_days", { p_owner: owner, p_group: person.stage_group, p_stage: person.stage });
        const d = typeof days === "number" && days > 0 ? days : null;
        next = d ? new Date(new Date(`${today}T12:00:00Z`).getTime() + d * DAY).toISOString().slice(0, 10) : null;
      }
      const { error } = await admin.from("people").update({ next_follow_up: next }).eq("id", person.id).eq("owner_id", owner);
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, next_follow_up: next, previous: person.next_follow_up || null });
    }

    if (a === "deal_task_done" || a === "deal_task_due") {
      if (!UUID.test(String(body.task_id || ""))) return bad(res, "Missing task.");
      const { data: task } = await admin.from("transaction_tasks").select("id, person_id, owner_id, due_override, done").eq("id", body.task_id).maybeSingle();
      if (!task) return bad(res, "That task isn't yours.", 404);
      let allowed = task.owner_id === owner;
      if (!allowed) {
        // A coordinator works the deals they coordinate (the same rule that puts them in Today).
        const { data: profile } = await admin.from("profiles").select("deals_role").eq("id", owner).maybeSingle();
        if (profile?.deals_role === "tc") {
          const [{ data: per }, { data: deal }] = await Promise.all([
            admin.from("deal_tcs").select("person_id").eq("tc_id", owner).eq("person_id", task.person_id).limit(1),
            admin.from("people").select("owner_id").eq("id", task.person_id).maybeSingle(),
          ]);
          const { data: team } = deal ? await admin.from("deal_team").select("agent_id").eq("tc_id", owner).eq("agent_id", deal.owner_id).limit(1) : { data: [] };
          allowed = Boolean(per?.length || team?.length);
        }
      }
      if (!allowed) return bad(res, "That task isn't yours.", 404);
      let changes;
      if (a === "deal_task_done") {
        const done = body.done !== false;
        changes = { done, done_at: done ? new Date().toISOString() : null };
      } else {
        if (body.date !== null && body.date !== undefined && !DATE.test(String(body.date))) return bad(res, "That date doesn't look right.");
        changes = { due_override: body.date || null };
      }
      const { error } = await admin.from("transaction_tasks").update(changes).eq("id", task.id);
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, previous: task.due_override || null });
    }

    if (a === "task_complete" || a === "task_reopen" || a === "task_update" || a === "task_delete") {
      if (!UUID.test(String(body.task_id || ""))) return bad(res, "Missing task.");
      const { data: task } = await admin.from("agent_tasks").select(TASK_COLUMNS).eq("id", body.task_id).eq("owner_id", owner).maybeSingle();
      if (!task) return bad(res, "That task isn't yours.", 404);
      const mine = (q) => q.eq("id", task.id).eq("owner_id", owner);
      const back = async (changes) => {
        const { data, error } = await mine(admin.from("agent_tasks").update(changes)).select(TASK_COLUMNS).single();
        if (error) return bad(res, "Couldn't save it.", 500);
        return res.status(200).json({ ok: true, task: await taskOut(data) });
      };

      if (a === "task_delete") {
        const { error } = await mine(admin.from("agent_tasks").delete());
        return error ? bad(res, "Couldn't delete it.", 500) : res.status(200).json({ ok: true });
      }
      if (a === "task_reopen") return back({ done: false, done_at: null });
      if (a === "task_complete") {
        const now = new Date().toISOString();
        if (task.recurrence === "none") return back({ done: true, done_at: now });
        const today = DATE.test(String(body.today || "")) ? body.today : todayKey();
        const due = nextDue(task.recurrence, task.series_start, task.due_date, today);
        // The next one starts with its steps unticked.
        const steps = Array.isArray(task.checklist) ? task.checklist : [];
        return back({ due_date: due, last_done_at: now, ...(steps.some((x) => x.done) ? { checklist: steps.map((x) => ({ ...x, done: false })) } : {}) });
      }
      // task_update
      const ch = body.changes && typeof body.changes === "object" ? body.changes : {};
      const changes = {};
      if ("title" in ch) {
        const t = String(ch.title || "").trim().slice(0, 300);
        if (!t) return bad(res, "A task needs a title.");
        changes.title = t;
      }
      if ("due_date" in ch) {
        if (ch.due_date !== null && !DATE.test(String(ch.due_date))) return bad(res, "That date doesn't look right.");
        changes.due_date = ch.due_date;
        if (task.recurrence !== "none") {
          // A repeating task always needs a date; moving it restarts the series from the new date.
          if (!ch.due_date) return bad(res, "A repeating task needs a date.");
          changes.series_start = ch.due_date;
        } else if (!ch.due_date) {
          changes.start_time = null;
          changes.duration_min = null;
        }
      }
      if ("list" in ch) changes.list = cleanList(ch.list);
      if ("checklist" in ch) {
        if (!Array.isArray(ch.checklist)) return bad(res, "Steps must be a list.");
        changes.checklist = cleanSteps(ch.checklist);
      }
      if (!Object.keys(changes).length) return bad(res, "Nothing to change.");
      return back(changes);
    }

    if (a === "contact") {
      const first = String(body.first_name || "").trim().slice(0, 80), last = String(body.last_name || "").trim().slice(0, 80), company = String(body.company || "").trim().slice(0, 120);
      const phone = String(body.phone || "").trim().slice(0, 40), email = String(body.email || "").trim().toLowerCase().slice(0, 254);
      if (!first && !last && !company) return bad(res, "Add a name.");
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, "That email address doesn't look right.");
      if (!body.force && (email || digits(phone).length >= 7)) {
        const clauses = [...(email ? [`email.eq.${email}`] : []), ...(digits(phone).length >= 7 ? [`search_text.ilike.%${digits(phone).slice(-10)}%`] : [])].join(",");
        const { data: dup } = await admin.from("contacts").select("id, first_name, last_name, company").eq("owner_id", owner).eq("archived", false).or(clauses).limit(1);
        if (dup?.length) return res.status(200).json({ duplicate: { id: dup[0].id, name: fullName(dup[0]) } });
      }
      const relationship = RELATIONSHIPS.includes(body.relationship) ? body.relationship : "sphere";
      const { data, error } = await admin.from("contacts").insert({ owner_id: owner, first_name: first, last_name: last, company, phone, email, relationship }).select("id, first_name, last_name, company").single();
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, id: data.id, name: fullName(data) });
    }

    if (a === "update") {
      const contact = await ownsContact(body.contact_id);
      if (!contact) return bad(res, "That contact isn't yours.");
      const changes = {};
      for (const [key, clean] of Object.entries(EDITABLE)) {
        if (!body.changes || !(key in body.changes)) continue;
        const v = clean(body.changes[key]);
        if (v === undefined) return bad(res, `That value for ${key.replace(/_/g, " ")} isn't allowed.`);
        changes[key] = v;
      }
      if ("email" in changes && changes.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(changes.email)) return bad(res, "That email address doesn't look right.");
      if (!Object.keys(changes).length) return bad(res, "Nothing to change.");
      const { data, error } = await admin.from("contacts").update(changes).eq("id", contact.id).eq("owner_id", owner).select(CONTACT_COLUMNS).single();
      if (error) {
        const noName = /contacts_has_a_name/.test(error.message || "");
        return bad(res, noName ? "A contact needs a name or a company." : "Couldn't save it.", noName ? 400 : 500);
      }
      return res.status(200).json({ ok: true, contact: data });
    }

    if (a === "tag") {
      const contact = await ownsContact(body.contact_id);
      if (!contact) return bad(res, "That contact isn't yours.");
      const name = String(body.name || "").trim().slice(0, 40);
      if (!name) return bad(res, "Name the tag.");
      // Tag names are unique per agent ignoring case, so find it by comparing lowercased names here rather than building a pattern.
      const { data: mine } = await admin.from("contact_tags").select("id, name, color").eq("owner_id", owner);
      let tag = (mine || []).find((t) => t.name.toLowerCase() === name.toLowerCase());
      if (body.on === false) {
        if (tag) await admin.from("contact_tag_links").delete().eq("contact_id", contact.id).eq("tag_id", tag.id).eq("owner_id", owner);
        return res.status(200).json({ ok: true });
      }
      if (!tag) {
        const made = await admin.from("contact_tags").insert({ owner_id: owner, name, color: "gray" }).select("id, name, color").single();
        if (made.error) return bad(res, "Couldn't save it.", 500);
        tag = made.data;
      }
      const { error } = await admin.from("contact_tag_links").upsert({ contact_id: contact.id, tag_id: tag.id, owner_id: owner }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true, tag });
    }

    return bad(res, "Not found.", 404);
  } catch (err) {
    console.error("mac-app:", a, err);
    return bad(res, "Something went wrong.", 500);
  }
}
