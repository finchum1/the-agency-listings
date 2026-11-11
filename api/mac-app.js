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
// The Leads and Pipeline boards (the dashboard's People boards), for the native Leads & Pipeline window:
//   GET  /api/mac-app?a=people_board     both boards' columns, each column's follow-up cadence (days), and everyone on them (not archived)
//   GET  /api/mac-app?a=person&person_id=   one person: their card, what has been logged (notes and activity), and their contact record's relationship and tags
//   POST /api/mac-app?a=person_start     {group, name, phone?, email?, side?, stage?, follow_up?}   a new lead or pipeline card (source "Added manually")
//   POST /api/mac-app?a=person_update    {person_id, changes}   name, email, phone, side, source, stage (a column of their board), next follow-up
//   POST /api/mac-app?a=person_move      {person_id, stage}   to the next board: a lead goes to Pipeline, a pipeline person starts a deal
//   POST /api/mac-app?a=person_archive   {person_id, reason}      POST ?a=person_restore {person_id}
//   POST /api/mac-app?a=person_note      {person_id, kind, body}   a note or logged touch; a touch moves a due follow-up along by the column's cadence
// The Deals overview page and the "Email with a template" menu:
//   GET  /api/mac-app?a=deals_overview&today=   the open tasks of your open deals that fall due by two weeks from today (overdue ones included), each with its due day, and the waiting drafts
//   GET  /api/mac-app?a=deal_emails&deal_id=    the deal's email templates, grouped as in the dashboard's "Email with a template" menu, each already filled in from the deal and addressed
//                                               (to / cc), plus which checklist task offers which template. Nothing is sent; the app opens each in the person's own mail app.
// Starting a deal, as the dashboard's "Start a deal" does:
//   GET  /api/mac-app?a=deal_start_options   who a deal can be started for (you, and for a coordinator the agents in their office) and the columns each has
//   POST /api/mac-app?a=deal_start           {agent: "me" | agent id, name, side, property_address?, phone?, email?, price?, contract_date?, closing_date?, stage?}   returns {id, note}
// Editing a deal (its details, the people on it, money, key dates, earnest money, cash, side and stage), as the dashboard's Details and Overview tabs do:
//   POST /api/mac-app?a=deal_update    {deal_id, changes}   see DEAL_EDIT for the fields; `column` is a coordinator's own board column; returns the deal as ?a=deal does
// Adding and removing a deal's checklist tasks and documents (the dashboard's Tasks and Documents tabs):
//   POST /api/mac-app?a=deal_task_add   {deal_id, section, text}   adds a task to a section (it takes that section's due rule); returns the task
//   POST /api/mac-app?a=deal_task_delete {task_id}
//   POST /api/mac-app?a=deal_doc_add    {deal_id, section, text}   returns the document
//   POST /api/mac-app?a=deal_doc_done   {doc_id, done}
//   POST /api/mac-app?a=deal_doc_delete {doc_id}
// A deal's agent and sharing (the dashboard's three-dot menu on a deal, and a coordinator's "Update the agent"):
//   POST /api/mac-app?a=deal_archive       {deal_id, reason}   takes the deal off the agent's board too; nothing is deleted
//   POST /api/mac-app?a=deal_delete        {deal_id, confirm: true}   permanently, with its tasks, documents, messages, signatures and links
//   POST /api/mac-app?a=deal_agents        {deal_id}   the other agents in your office who use Deals (for Change the agent)
//   POST /api/mac-app?a=deal_change_agent  {deal_id, agent_id}   same as the dashboard's deal_change_agent; nobody is emailed
//   POST /api/mac-app?a=deal_links         {deal_id}   active client timeline links, and (a coordinator) your active update links, with the agent's site address if they have one
//   POST /api/mac-app?a=deal_link_create   {deal_id, kind: "timeline" | "update", message?}   returns the one-time token (the app builds the address); update links are a coordinator's only
//   POST /api/mac-app?a=deal_link_revoke   {link_id, kind}   turns a link off
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
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";
import { deviceFor } from "./_lib/macDevice.js";
import { effectiveDue } from "../src/lib/checklistDefaults.js";
import { touchDue } from "../src/lib/contacts.js";
import { nextDue } from "../src/lib/taskRecurrence.js";
import { cleanList, cleanSteps } from "../src/lib/taskLists.js";
import { EMAIL_GROUPS, STARTER_TEMPLATES, renderDealEmail, taskEmailKey, templatesForDeal } from "../src/lib/dealEmails.js";
import { fromAs, sendNotification, viaOrg } from "./_lib/inquiry.js";
import { buildDealStartedEmail } from "./_lib/dealEmail.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

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
// What may be edited on a deal, and how each value is cleaned (null = clear it). Anything else in `changes` is ignored.
const DEAL_TEXT = ["email", "phone", "property_address", "financing_type", "client2_name", "client2_email", "other_party_name", "other_agent", "other_agent_email", "other_agent_phone", "other_agent_company",
  "other_agent2", "other_agent2_email", "other_agent2_phone", "other_agent2_company", "other_agent_tc_name", "other_agent_tc_email", "title_company", "title_company_email", "title_phone",
  "title_processor_name", "title_processor_email", "escrow_officer", "escrow_officer_email", "lender", "lender_email", "lender_phone", "loan_processor_name", "loan_processor_email"];
const DEAL_NUMBERS = ["price", "commission", "earnest_money"];
const DEAL_DATES = ["contract_date", "inspection_date", "inspection_period_end", "appraisal_date", "financing_deadline", "closing_date"];
const DEAL_TIMES = ["inspection_time", "closing_time"];
const DEFAULT_PEOPLE_STAGES = { lead: ["New", "Contacted", "Nurturing", "Qualified"], pipeline: ["12+ Months", "6+ Months", "3-6 Months", "Coming Soon", "Active"] };
const DEFAULT_CADENCE = { lead: { New: 1, Contacted: 3, Nurturing: 14, Qualified: 3 }, pipeline: { "12+ Months": 90, "6+ Months": 60, "3-6 Months": 30, "Coming Soon": 7, Active: 3 } };
const PERSON_COLUMNS = "id, name, email, phone, stage_group, stage, source, next_follow_up, side, lead_id, first_response_at, created_at, updated_at, contact_id, board_position, archived, archived_reason";
const ARCHIVE_REASONS = ["Deal fell through", "Went with another agent", "Not interested", "Not responding", "Timing / no longer moving", "Other"];
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

/** The columns of the Leads and Pipeline boards for one agent, and each column's follow-up cadence (days; null = none): their settings over the defaults. */
async function peopleSettings(admin, who) {
  const { data } = await admin.from("people_settings").select("stages, cadence").eq("owner_id", who).maybeSingle();
  const stages = {}, cadence = {};
  for (const g of ["lead", "pipeline"]) {
    const list = data?.stages?.[g];
    stages[g] = Array.isArray(list) && list.length ? list : DEFAULT_PEOPLE_STAGES[g];
    cadence[g] = {};
    for (const st of stages[g]) {
      const custom = data?.cadence?.[g];
      if (custom && Object.prototype.hasOwnProperty.call(custom, st)) cadence[g][st] = Number(custom[st]) > 0 ? Number(custom[st]) : null;
      else cadence[g][st] = DEFAULT_CADENCE[g][st] ?? null;
    }
  }
  const tx = data?.stages?.transaction;
  stages.transaction = Array.isArray(tx) && tx.length ? tx : DEFAULT_DEAL_STAGES;
  return { stages, cadence };
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

    if (req.method === "GET" && a === "people_board") {
      const { stages, cadence } = await peopleSettings(admin, owner);
      const people = await readAll(() => admin.from("people").select(PERSON_COLUMNS).eq("owner_id", owner).in("stage_group", ["lead", "pipeline"]).eq("archived", false).order("id"));
      const { count } = await admin.from("people").select("id", { count: "exact", head: true }).eq("owner_id", owner).in("stage_group", ["lead", "pipeline"]).eq("archived", true);
      return res.status(200).json({ stages: { lead: stages.lead, pipeline: stages.pipeline }, deal_stages: stages.transaction, cadence, people, archived_count: count || 0 });
    }

    if (req.method === "GET" && a === "person") {
      const id = String(req.query?.person_id || "");
      if (!UUID.test(id)) return bad(res, "Missing person.");
      const { data: person } = await admin.from("people").select(PERSON_COLUMNS).eq("id", id).eq("owner_id", owner).in("stage_group", ["lead", "pipeline"]).maybeSingle();
      if (!person) return bad(res, "Person not found.", 404);
      const [notes, cnotes, contact, links] = await Promise.all([
        admin.from("people_notes").select("id, body, created_at").eq("person_id", id).order("created_at", { ascending: false }).limit(200),
        person.contact_id ? admin.from("contact_notes").select("id, kind, body, occurred_at").eq("contact_id", person.contact_id).eq("owner_id", owner).order("occurred_at", { ascending: false }).limit(200) : Promise.resolve({ data: [] }),
        person.contact_id ? admin.from("contacts").select("relationship, last_contacted_at, do_not_contact").eq("id", person.contact_id).eq("owner_id", owner).maybeSingle() : Promise.resolve({ data: null }),
        person.contact_id ? admin.from("contact_tag_links").select("tag_id").eq("contact_id", person.contact_id).eq("owner_id", owner) : Promise.resolve({ data: [] }),
      ]);
      const tagIds = (links.data || []).map((l) => l.tag_id);
      const { data: tagRows } = tagIds.length ? await admin.from("contact_tags").select("id, name").in("id", tagIds).eq("owner_id", owner) : { data: [] };
      const items = [
        ...(notes.data || []).map((n) => ({ id: `p${n.id}`, kind: "note", body: n.body, at: n.created_at })),
        ...(cnotes.data || []).map((n) => ({ id: `c${n.id}`, kind: n.kind, body: n.body, at: n.occurred_at })),
      ].sort((x, y) => y.at.localeCompare(x.at));
      return res.status(200).json({ person, activity: items, contact: contact.data ? { relationship: contact.data.relationship, last_contacted_at: contact.data.last_contacted_at, do_not_contact: contact.data.do_not_contact, tags: (tagRows || []).map((t) => t.name) } : null });
    }

    if (req.method === "GET" && a === "deals_overview") {
      const today = DATE.test(String(req.query?.today || "")) ? String(req.query.today) : todayKey();
      const horizon = new Date(new Date(`${today}T12:00:00Z`).getTime() + 14 * DAY).toISOString().slice(0, 10);
      const { deals } = await visibleDeals(admin, owner, "id, owner_id, contract_date, inspection_date, closing_date");
      const byId = new Map(deals.map((d) => [d.id, d]));
      const ids = [...byId.keys()];
      const tasks = [], drafts = [];
      for (let i = 0; i < ids.length; i += 100) {
        const part = ids.slice(i, i + 100);
        const rows = await readAll(() => admin.from("transaction_tasks").select("id, person_id, text, anchor, offset_days, due_override").in("person_id", part).eq("done", false).order("id"));
        for (const t of rows) { const due = effectiveDue(t, byId.get(t.person_id)); if (due && due <= horizon) tasks.push({ id: t.id, person_id: t.person_id, text: t.text || "Task", due }); }
        const { data: dr } = await admin.from("people_outreach").select("id, person_id, channel, subject").in("person_id", part).eq("status", "draft").limit(100);
        drafts.push(...(dr || []));
      }
      return res.status(200).json({ tasks: tasks.sort((a, b) => a.due.localeCompare(b.due)), drafts: drafts.slice(0, 100) });
    }

    if (req.method === "GET" && a === "deal_emails") {
      const id = String(req.query?.deal_id || "");
      if (!UUID.test(id)) return bad(res, "Missing deal.");
      const { deals } = await visibleDeals(admin, owner, "id, owner_id");
      if (!deals.some((d) => d.id === id)) return bad(res, "Deal not found.", 404);
      const { data: deal } = await admin.from("people").select("*").eq("id", id).maybeSingle();
      if (!deal) return bad(res, "Deal not found.", 404);
      // The same context the dashboard builds: who is sending, the deal's agent (and their office), and the deal's coordinators.
      const [{ data: me }, { data: agent }, { data: per }, { data: wide }, { data: saved }, { data: taskRows }] = await Promise.all([
        admin.from("profiles").select("full_name, email, phone").eq("id", owner).maybeSingle(),
        admin.from("profiles").select("full_name, email, phone, org_id").eq("id", deal.owner_id).maybeSingle(),
        admin.from("deal_tcs").select("tc_id").eq("person_id", id),
        admin.from("deal_team").select("tc_id").eq("agent_id", deal.owner_id),
        admin.from("deal_email_templates").select("*").eq("owner_id", owner).order("position").order("created_at"),
        admin.from("transaction_tasks").select("id, text, email_template").eq("person_id", id).order("position").limit(500),
      ]);
      const tcIds = [...new Set([...(per || []), ...(wide || [])].map((r) => r.tc_id))];
      const [{ data: tcs }, { data: org }] = await Promise.all([
        tcIds.length ? admin.from("profiles").select("full_name, email").in("id", tcIds) : Promise.resolve({ data: [] }),
        agent?.org_id ? admin.from("organizations").select("name").eq("id", agent.org_id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const ctx = {
        me: { name: me?.full_name || "", email: me?.email || "", phone: me?.phone || "" },
        agent: { name: agent?.full_name || "", email: agent?.email || "", phone: agent?.phone || "", company: org?.name || "" },
        coordinators: (tcs || []).map((t) => ({ name: t.full_name || "", email: t.email || "" })),
      };
      // The built-in starters with the person's own copies swapped in, then their own templates (what the dashboard's template list does).
      const copies = new Map((saved || []).filter((t) => t.base_key).map((t) => [t.base_key, t]));
      const all = STARTER_TEMPLATES.map((st) => { const c = copies.get(st.key); return c ? { ...c, key: st.key, group: st.group, starter: true, skipCash: st.skipCash } : { ...st, starter: true }; });
      for (const t of saved || []) if (!t.base_key) all.push({ ...t, key: t.id, starter: false });
      const forDeal = templatesForDeal(all, deal);
      const render = (t) => { const r = renderDealEmail(t, deal, ctx); return { key: t.key, name: t.name, to: r.to, cc: r.cc, subject: r.subject, body: r.body, missing: r.missing, no_email: r.noEmail }; };
      const groups = [...EMAIL_GROUPS.map((g) => ({ name: g, templates: forDeal.filter((t) => t.starter && t.group === g).map(render) })), { name: "My templates", templates: forDeal.filter((t) => !t.starter).map(render) }].filter((g) => g.templates.length);
      const keys = new Set(forDeal.map((t) => t.key));
      const taskEmails = {};
      for (const t of taskRows || []) { const k = taskEmailKey(t, deal.side); if (k && keys.has(k)) taskEmails[t.id] = k; }
      return res.status(200).json({ groups, task_emails: taskEmails });
    }

    if (req.method === "GET" && a === "deal_start_options") {
      const { data: me } = await admin.from("profiles").select("id, org_id, deals_role, people_enabled, full_name").eq("id", owner).maybeSingle();
      const stagesFor = async (who) => { const { data } = await admin.from("people_settings").select("stages").eq("owner_id", who).maybeSingle(); return Array.isArray(data?.stages?.transaction) && data.stages.transaction.length ? data.stages.transaction : DEFAULT_DEAL_STAGES; };
      let agents = [];
      if (me?.deals_role === "tc" && me.org_id) {
        const { data: list } = await admin.from("profiles").select("id, full_name").eq("org_id", me.org_id).eq("people_enabled", true).neq("id", owner).order("full_name");
        agents = await Promise.all((list || []).map(async (p) => ({ id: p.id, name: p.full_name || "Agent", stages: await stagesFor(p.id) })));
      }
      return res.status(200).json({ can_start_own: Boolean(me?.people_enabled), is_tc: me?.deals_role === "tc", my_stages: await stagesFor(owner), agents });
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
      // The deal's agent is copied on the team emails (the dashboard does the same).
      const { data: agentProfile } = await admin.from("profiles").select("email").eq("id", deal.owner_id).maybeSingle();
      return res.status(200).json({
        deal: { ...rest, column: _foreign ? _column || rest.stage : rest.stage, foreign: _foreign, agent: _agent, agent_email: agentProfile?.email || "" },
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

    // ---- Leads and Pipeline: add, edit, move between boards, archive, log activity
    if (a.startsWith("person_")) {
      const mineP = async (id) => {
        if (!UUID.test(String(id || ""))) return null;
        const { data } = await admin.from("people").select(PERSON_COLUMNS).eq("id", id).eq("owner_id", owner).in("stage_group", ["lead", "pipeline"]).maybeSingle();
        return data || null;
      };
      const out = async (id) => (await admin.from("people").select(PERSON_COLUMNS).eq("id", id).maybeSingle()).data;

      if (a === "person_start") {
        const group = body.group === "pipeline" ? "pipeline" : body.group === "lead" ? "lead" : null;
        if (!group) return bad(res, "Choose Leads or Pipeline.");
        const name = String(body.name || "").trim().slice(0, 200);
        if (!name) return bad(res, "Add a name.");
        const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, "That email address doesn't look right.");
        if (body.side && !["buyer", "seller", "both"].includes(body.side)) return bad(res, "Choose buyer, seller or both.");
        if (body.follow_up && !DATE.test(String(body.follow_up))) return bad(res, "That date doesn't look right.");
        const { stages } = await peopleSettings(admin, owner);
        const want = String(body.stage || "").trim().toLowerCase();
        const stage = want ? stages[group].find((x) => x.toLowerCase() === want) : stages[group][0];
        if (!stage) return bad(res, "That isn't one of the columns.");
        const row = { owner_id: owner, name, phone: String(body.phone || "").trim().slice(0, 40), email, stage_group: group, stage, source: "Added manually", ...(body.side ? { side: body.side } : {}), ...(body.follow_up ? { next_follow_up: body.follow_up } : {}) };
        const { data, error } = await admin.from("people").insert(row).select("id").single();
        if (error) return bad(res, "Couldn't save it.", 500);
        return res.status(200).json({ ok: true, person: await out(data.id) });
      }

      const person = await mineP(body.person_id);
      if (!person) return bad(res, "That person isn't yours.", 404);

      if (a === "person_update") {
        const ch = body.changes && typeof body.changes === "object" ? body.changes : {};
        const changes = {};
        if ("name" in ch) { const n = String(ch.name || "").trim().slice(0, 200); if (!n) return bad(res, "A person needs a name."); changes.name = n; }
        if ("phone" in ch) changes.phone = String(ch.phone ?? "").trim().slice(0, 40);
        if ("source" in ch) changes.source = String(ch.source ?? "").trim().slice(0, 60);
        if ("email" in ch) {
          const e = String(ch.email ?? "").trim().toLowerCase().slice(0, 254);
          if (e && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return bad(res, "That email address doesn't look right.");
          changes.email = e;
        }
        if ("side" in ch) { if (ch.side !== null && !["buyer", "seller", "both"].includes(ch.side)) return bad(res, "Choose buyer, seller or both."); changes.side = ch.side || null; }
        if ("next_follow_up" in ch) { if (ch.next_follow_up !== null && !DATE.test(String(ch.next_follow_up))) return bad(res, "That date doesn't look right."); changes.next_follow_up = ch.next_follow_up || null; }
        if ("stage" in ch) {
          const { stages } = await peopleSettings(admin, owner);
          const st = stages[person.stage_group].find((x) => x.toLowerCase() === String(ch.stage || "").trim().toLowerCase());
          if (!st) return bad(res, "That isn't one of the columns.");
          changes.stage = st;
        }
        if (!Object.keys(changes).length) return bad(res, "Nothing to change.");
        const { error } = await admin.from("people").update(changes).eq("id", person.id).eq("owner_id", owner);
        return error ? bad(res, "Couldn't save it.", 500) : res.status(200).json({ ok: true, person: await out(person.id) });
      }

      if (a === "person_move") {
        const { stages } = await peopleSettings(admin, owner);
        const toGroup = person.stage_group === "lead" ? "pipeline" : "transaction";
        const list = stages[toGroup];
        const want = String(body.stage || "").trim().toLowerCase();
        const stage = want ? list.find((x) => x.toLowerCase() === want) : list[0];
        if (!stage) return bad(res, "That isn't one of the columns.");
        // A person who becomes a deal can't be "both" (a deal is a buyer's or a seller's).
        const changes = { stage_group: toGroup, stage, ...(toGroup === "transaction" && person.side === "both" ? { side: null } : {}) };
        const { error } = await admin.from("people").update(changes).eq("id", person.id).eq("owner_id", owner);
        return error ? bad(res, "Couldn't move them.", 500) : res.status(200).json({ ok: true, moved_to: toGroup, id: person.id });
      }

      if (a === "person_archive") {
        const reason = ARCHIVE_REASONS.includes(body.reason) ? body.reason : "Other";
        const { error } = await admin.from("people").update({ archived: true, archived_reason: reason, archived_at: new Date().toISOString() }).eq("id", person.id).eq("owner_id", owner);
        return error ? bad(res, "Couldn't archive.", 500) : res.status(200).json({ ok: true });
      }
      if (a === "person_restore") {
        const { error } = await admin.from("people").update({ archived: false, archived_reason: "", archived_at: null }).eq("id", person.id).eq("owner_id", owner);
        return error ? bad(res, "Couldn't restore.", 500) : res.status(200).json({ ok: true });
      }

      if (a === "person_note") {
        const kind = NOTE_KINDS.includes(body.kind) ? body.kind : "note";
        const text = String(body.body || "").trim().slice(0, 5000);
        if (!text && kind === "note") return bad(res, "Write something first.");
        // On the contact record when the card has one (so it shows in Contacts and counts as being in touch), else on the card.
        const { error } = person.contact_id
          ? await admin.from("contact_notes").insert({ contact_id: person.contact_id, owner_id: owner, kind, body: text })
          : await admin.from("people_notes").insert({ person_id: person.id, owner_id: owner, body: text || kind.charAt(0).toUpperCase() + kind.slice(1) });
        if (error) return bad(res, "Couldn't save it.", 500);
        // Being in touch moves the next follow-up along (only when one is due or none is set), by the column's cadence.
        let nextFollowUp = person.next_follow_up;
        if (["call", "text", "email", "meeting", "showing"].includes(kind)) {
          const today = DATE.test(String(body.today || "")) ? body.today : todayKey();
          const { cadence } = await peopleSettings(admin, owner);
          const days = cadence[person.stage_group]?.[person.stage];
          if (days && (!person.next_follow_up || person.next_follow_up <= today)) {
            nextFollowUp = new Date(new Date(`${today}T12:00:00Z`).getTime() + days * DAY).toISOString().slice(0, 10);
            await admin.from("people").update({ next_follow_up: nextFollowUp }).eq("id", person.id).eq("owner_id", owner);
          }
        }
        return res.status(200).json({ ok: true, next_follow_up: nextFollowUp });
      }
      return bad(res, "Not found.", 404);
    }

    // ---- start a deal: your own, or (a coordinator) one for an agent in your office
    if (a === "deal_start") {
      const { data: me } = await admin.from("profiles").select("id, org_id, deals_role, people_enabled, full_name").eq("id", owner).maybeSingle();
      const name = String(body.name || "").trim().slice(0, 200);
      if (!name) return bad(res, "Add the client's name.");
      if (!["buyer", "seller"].includes(body.side)) return bad(res, "Choose buyer or seller.");
      const email = String(body.email || "").trim().toLowerCase().slice(0, 254);
      if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return bad(res, "That email address doesn't look right.");
      let price = null;
      if (body.price !== undefined && body.price !== null && body.price !== "") { price = Number(body.price); if (!Number.isFinite(price) || price < 0 || price > 1e12) return bad(res, "That price doesn't look right."); }
      for (const k of ["contract_date", "closing_date"]) if (body[k] && !DATE.test(String(body[k]))) return bad(res, "That date doesn't look right.");
      const fields = { name, side: body.side, property_address: String(body.property_address || "").trim().slice(0, 200), phone: String(body.phone || "").trim().slice(0, 40), email, price, contract_date: body.contract_date || null, closing_date: body.closing_date || null, stage_group: "transaction" };
      const stagesOf = async (who) => { const { data } = await admin.from("people_settings").select("stages").eq("owner_id", who).maybeSingle(); return Array.isArray(data?.stages?.transaction) && data.stages.transaction.length ? data.stages.transaction : DEFAULT_DEAL_STAGES; };
      const pickStage = (list) => { const want = String(body.stage || "").trim().toLowerCase(); if (!want) return list[0]; return list.find((x) => x.toLowerCase() === want) || null; };

      if (!body.agent || body.agent === "me") {
        if (!me?.people_enabled) return bad(res, "Deals isn't turned on for your account.", 403);
        const stage = pickStage(await stagesOf(owner));
        if (!stage) return bad(res, "That isn't one of your columns.");
        const { data, error } = await admin.from("people").insert({ ...fields, owner_id: owner, stage, source: "Added manually" }).select("id").single();
        return error ? bad(res, "Couldn't start it.", 500) : res.status(200).json({ ok: true, id: data.id, note: "" });
      }

      // For an agent: only a coordinator, only an agent in their own office who uses Deals (the dashboard's deal_start_for_agent does the same checks).
      if (me?.deals_role !== "tc") return bad(res, "Only a transaction coordinator can start a deal for an agent.", 403);
      if (!UUID.test(String(body.agent)) || body.agent === owner) return bad(res, "Pick an agent in your office who uses Deals.");
      const { data: agent } = await admin.from("profiles").select("id, org_id, people_enabled, full_name, email").eq("id", body.agent).maybeSingle();
      if (!agent || !me.org_id || agent.org_id !== me.org_id || !agent.people_enabled) return bad(res, "Pick an agent in your office who uses Deals.");
      const stage = pickStage(await stagesOf(agent.id));
      if (!stage) return bad(res, "That column isn't one of this agent's Deals columns.");
      const { data: row, error } = await admin.from("people").insert({ ...fields, owner_id: agent.id, stage, source: "" }).select("id, name, property_address, side, contract_date, closing_date").single();
      if (error) return bad(res, "Couldn't start it.", 500);
      await admin.from("deal_tcs").insert({ person_id: row.id, tc_id: owner, assigned_by: owner, started_by_tc: true });
      await admin.from("deal_messages").insert({ person_id: row.id, author_id: owner, kind: "message", body: `${me.full_name || "The coordinator"} started this deal and is coordinating it.` });
      // Telling the agent is a courtesy: the deal is made either way, and a problem only comes back as a note.
      let note = "";
      const key = process.env.RESEND_API_KEY;
      if (!key) note = `The deal is on ${agent.full_name || "the agent"}'s board, but email isn't set up here, so they weren't told.`;
      else if (!agent.email) note = `The deal is on ${agent.full_name || "the agent"}'s board, but they have no email on file.`;
      else {
        const { data: org } = await admin.from("organizations").select("name").eq("id", agent.org_id).maybeSingle();
        const { data: tc } = await admin.from("profiles").select("full_name, email").eq("id", owner).maybeSingle();
        const mail = buildDealStartedEmail({ deal: row, tcName: tc?.full_name || "", agentName: agent.full_name || "", orgName: org?.name, url: `${SITE_ORIGIN}/dashboard/deals?deal=${row.id}` });
        const sent = await sendNotification(key, { from: fromAs(viaOrg(tc?.full_name, org?.name), "Deals", "deals"), to: [agent.email], replyTo: tc?.email || undefined, subject: mail.subject, text: mail.text, html: mail.html });
        if (sent) await admin.from("deal_tcs").update({ agent_emailed_at: new Date().toISOString() }).eq("person_id", row.id).eq("tc_id", owner);
        else note = `The deal is on ${agent.full_name || "the agent"}'s board, but the email to them didn't go out.`;
      }
      return res.status(200).json({ ok: true, id: row.id, note });
    }

    // Can this person work this deal? Their own, or (a coordinator) one they coordinate: the same rule that puts it on their board.
    const canWork = async (personId) => {
      const { data: p } = await admin.from("people").select("id, owner_id, stage_group, contract_date, inspection_date, closing_date").eq("id", personId).eq("stage_group", "transaction").maybeSingle();
      if (!p) return null;
      if (p.owner_id === owner) return p;
      const { data: profile } = await admin.from("profiles").select("deals_role").eq("id", owner).maybeSingle();
      if (profile?.deals_role !== "tc") return null;
      const [{ data: per }, { data: team }] = await Promise.all([
        admin.from("deal_tcs").select("person_id").eq("tc_id", owner).eq("person_id", p.id).limit(1),
        admin.from("deal_team").select("agent_id").eq("tc_id", owner).eq("agent_id", p.owner_id).limit(1),
      ]);
      return per?.length || team?.length ? p : null;
    };

    // ---- a deal's agent and sharing: archive, delete, change the agent, the client timeline link, and a coordinator's update link for the agent
    if (["deal_links", "deal_agents", "deal_archive", "deal_delete", "deal_change_agent", "deal_link_create", "deal_link_revoke"].includes(a)) {
      const dealId = String(body.deal_id || req.query?.deal_id || "");
      const linkId = String(body.link_id || "");
      let deal = null;
      if (a === "deal_link_revoke") {
        if (!UUID.test(linkId)) return bad(res, "Missing link.");
        const table = body.kind === "update" ? "deal_update_links" : "transaction_timeline_links";
        const { data: link } = await admin.from(table).select("id, person_id, created_by").eq("id", linkId).maybeSingle();
        if (!link || !(deal = await canWork(link.person_id)) || (table === "deal_update_links" && link.created_by !== owner)) return bad(res, "That isn't yours.", 404);
        const { error } = await admin.from(table).update({ revoked_at: new Date().toISOString() }).eq("id", link.id).is("revoked_at", null);
        return error ? bad(res, "Couldn't turn it off.", 500) : res.status(200).json({ ok: true });
      }
      if (!UUID.test(dealId)) return bad(res, "Missing deal.");
      deal = await canWork(dealId);
      if (!deal) return bad(res, "That deal isn't yours.", 404);
      const mine = deal.owner_id === owner;   // the agent's own deal; otherwise you coordinate it
      const { data: me } = await admin.from("profiles").select("id, org_id, full_name, people_enabled").eq("id", owner).maybeSingle();
      const { data: agent } = await admin.from("profiles").select("id, org_id, full_name, email").eq("id", deal.owner_id).maybeSingle();

      if (a === "deal_links") {
        const [t, u, site] = await Promise.all([
          admin.from("transaction_timeline_links").select("id, token_hint, created_at, expires_at, view_count, last_viewed_at").eq("person_id", dealId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
          mine ? Promise.resolve({ data: [] }) : admin.from("deal_update_links").select("id, token_hint, created_at, expires_at, view_count, last_viewed_at").eq("person_id", dealId).eq("created_by", owner).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
          admin.from("agent_sites").select("custom_domain").eq("agent_id", deal.owner_id).not("custom_domain", "is", null).limit(1).maybeSingle(),
        ]);
        return res.status(200).json({ timeline: t.data || [], update: u.data || [], can_update: !mine, site_domain: site.data?.custom_domain || "", agent_name: agent?.full_name || "", agent_email: agent?.email || "", origin: SITE_ORIGIN });
      }

      if (a === "deal_agents") {
        if (!me?.org_id) return res.status(200).json({ agents: [] });
        const { data: list } = await admin.from("profiles").select("id, full_name").eq("org_id", me.org_id).eq("people_enabled", true).neq("id", deal.owner_id).order("full_name");
        return res.status(200).json({ agents: (list || []).map((p) => ({ id: p.id, name: p.full_name || "Agent" })), current: agent?.full_name || "" });
      }

      if (a === "deal_archive") {
        const reason = ARCHIVE_REASONS.includes(body.reason) ? body.reason : "Other";
        const { error } = await admin.from("people").update({ archived: true, archived_reason: reason, archived_at: new Date().toISOString() }).eq("id", dealId).eq("stage_group", "transaction");
        return error ? bad(res, "Couldn't archive it.", 500) : res.status(200).json({ ok: true });
      }

      if (a === "deal_delete") {
        // The app asks first; this is the second lock. Tasks, documents, messages, signatures and links go with the deal (they cascade).
        if (body.confirm !== true) return bad(res, "Confirm the delete first.");
        const { error } = await admin.from("people").delete().eq("id", dealId).eq("stage_group", "transaction");
        return error ? bad(res, "Couldn't delete it.", 500) : res.status(200).json({ ok: true });
      }

      if (a === "deal_change_agent") {
        const toId = String(body.agent_id || "");
        if (!UUID.test(toId)) return bad(res, "Choose an agent.");
        const { data: target } = await admin.from("profiles").select("id, org_id, full_name, people_enabled").eq("id", toId).maybeSingle();
        if (!target || !target.org_id || target.org_id !== agent?.org_id || !target.people_enabled) return bad(res, "Pick an agent in your office who uses Deals.");
        if (target.id === deal.owner_id) return bad(res, `${target.full_name || "That agent"} already has this deal.`);
        const { data: cur } = await admin.from("people").select("stage").eq("id", dealId).maybeSingle();
        const { data: st } = await admin.from("people_settings").select("stages").eq("owner_id", toId).maybeSingle();
        const names = Array.isArray(st?.stages?.transaction) && st.stages.transaction.length ? st.stages.transaction : ["Pending", "Closing Soon", "Closed"];
        const stage = names.includes(cur?.stage) ? cur.stage : names[0];
        const { error } = await admin.from("people").update({ owner_id: toId, stage, contact_id: null, board_position: null }).eq("id", dealId);
        if (error) return bad(res, "Couldn't move it.", 500);
        for (const t of ["transaction_tasks", "transaction_documents", "people_notes", "people_outreach"]) await admin.from(t).update({ owner_id: toId }).eq("person_id", dealId);
        await admin.from("plan_enrollments").update({ status: "stopped", stop_reason: "The deal moved to another agent.", updated_at: new Date().toISOString() }).eq("person_id", dealId).in("status", ["active", "paused"]);
        await admin.from("deal_messages").insert({ person_id: dealId, author_id: owner, kind: "message", body: `${me?.full_name || "Someone"} moved this deal from ${agent?.full_name || "the previous agent"} to ${target.full_name || "a new agent"}.` });
        return res.status(200).json({ ok: true, to: target.full_name || "", stage, column_changed: stage !== cur?.stage });
      }

      // deal_link_create: a client timeline (the agent's own deal, or one you coordinate) or an update link for the agent (a coordinator only)
      const kind = body.kind === "update" ? "update" : "timeline";
      if (kind === "update" && mine) return bad(res, "An update link can only be made for a deal you coordinate.");
      if (kind === "timeline" && mine && !me?.people_enabled) return bad(res, "A timeline can only be shared for one of your own transactions or one you coordinate.");
      if (!me?.org_id) return bad(res, "Sign in to share a link.");
      const table = kind === "update" ? "deal_update_links" : "transaction_timeline_links";
      const limit = kind === "update" ? 10 : 5;
      let count = admin.from(table).select("id", { count: "exact", head: true }).eq("person_id", dealId).is("revoked_at", null).gt("expires_at", new Date().toISOString());
      if (kind === "update") count = count.eq("created_by", owner);
      if (((await count).count || 0) >= limit) return bad(res, kind === "update" ? "This deal has 10 active update links. Turn some off first." : "This transaction has 5 active timeline links. Turn some off first.");
      const token = (kind === "update" ? "du" : "tl") + (crypto.randomUUID() + crypto.randomUUID()).replace(/-/g, "");
      const days = kind === "update" ? 60 : 120;
      const { data: row, error } = await admin.from(table).insert({
        org_id: me.org_id, person_id: dealId, created_by: owner, token_hash: crypto.createHash("sha256").update(token).digest("hex"), token_hint: token.slice(-4),
        message: String(body.message || "").trim().slice(0, 600), expires_at: new Date(Date.now() + days * 86400000).toISOString(),
      }).select("id, token_hint, created_at, expires_at, view_count, last_viewed_at").single();
      if (error) return bad(res, "Couldn't make the link.", 500);
      return res.status(200).json({ ok: true, kind, token, link: row });
    }

    // ---- a deal's checklist tasks and documents: add, tick, delete; and the deal's own fields
    if (["deal_update", "deal_task_add", "deal_task_delete", "deal_doc_add", "deal_doc_done", "deal_doc_delete"].includes(a)) {
      if (a === "deal_update") {
        if (!UUID.test(String(body.deal_id || ""))) return bad(res, "Missing deal.");
        const deal = await canWork(body.deal_id);
        if (!deal) return bad(res, "That deal isn't yours.", 404);
        const ch = body.changes && typeof body.changes === "object" ? body.changes : {};
        const changes = {};
        const fail = (m) => bad(res, m);
        for (const k of DEAL_TEXT) if (k in ch) changes[k] = String(ch[k] ?? "").trim().slice(0, 200);
        if ("name" in ch) { const n = String(ch.name ?? "").trim().slice(0, 200); if (!n) return fail("A deal needs a client name."); changes.name = n; }
        for (const k of ["email", "client2_email", "other_agent_email", "other_agent2_email", "other_agent_tc_email", "title_company_email", "title_processor_email", "escrow_officer_email", "lender_email", "loan_processor_email"]) {
          if (changes[k]) { changes[k] = changes[k].toLowerCase(); if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(changes[k])) return fail("That email address doesn't look right."); }
        }
        for (const k of DEAL_NUMBERS) if (k in ch) {
          if (ch[k] === null || ch[k] === "") changes[k] = null;
          else { const n = Number(ch[k]); if (!Number.isFinite(n) || n < 0 || n > 1e12) return fail(`That ${k.replace(/_/g, " ")} doesn't look right.`); changes[k] = n; }
        }
        for (const k of DEAL_DATES) if (k in ch) {
          if (ch[k] !== null && !DATE.test(String(ch[k]))) return fail("That date doesn't look right.");
          changes[k] = ch[k] || null;
        }
        for (const k of DEAL_TIMES) if (k in ch) {
          if (ch[k] !== null && !/^\d{2}:\d{2}(:\d{2})?$/.test(String(ch[k]))) return fail("That time doesn't look right.");
          changes[k] = ch[k] || null;
        }
        if ("is_cash" in ch) { if (typeof ch.is_cash !== "boolean") return fail("Cash purchase must be yes or no."); changes.is_cash = ch.is_cash; }
        if ("earnest_money_delivered" in ch) {
          if (typeof ch.earnest_money_delivered !== "boolean") return fail("Earnest money delivered must be yes or no.");
          changes.earnest_money_delivered = ch.earnest_money_delivered;
          changes.earnest_money_delivered_at = ch.earnest_money_delivered ? new Date().toISOString() : null;
        }
        if ("side" in ch) { if (ch.side !== null && !["buyer", "seller"].includes(ch.side)) return fail("Choose buyer or seller."); changes.side = ch.side || null; }
        let column = null;
        if ("stage" in ch || "column" in ch) {
          const stagesOf = async (who) => { const { data } = await admin.from("people_settings").select("stages").eq("owner_id", who).maybeSingle(); return Array.isArray(data?.stages?.transaction) && data.stages.transaction.length ? data.stages.transaction : DEFAULT_DEAL_STAGES; };
          if ("stage" in ch) {
            const stage = String(ch.stage || "").trim().slice(0, 60);
            const { data: cur } = await admin.from("people").select("stage").eq("id", deal.id).maybeSingle();
            if (!stage || (stage !== cur?.stage && !(await stagesOf(deal.owner_id)).includes(stage))) return fail("That isn't one of the stages.");
            changes.stage = stage;
          }
          if ("column" in ch) {
            if (deal.owner_id === owner) return fail("Only a deal you coordinate has your own column.");
            column = String(ch.column || "").trim().slice(0, 60);
            if (!column || !(await stagesOf(owner)).includes(column)) return fail("That isn't one of your columns.");
          }
        }
        if (!Object.keys(changes).length && !column) return fail("Nothing to change.");
        if (Object.keys(changes).length) {
          const { error } = await admin.from("people").update(changes).eq("id", deal.id);
          if (error) return bad(res, "Couldn't save it.", 500);
        }
        if (column) {
          const { error } = await admin.from("deal_tc_stages").upsert({ person_id: deal.id, tc_id: owner, stage: column, updated_at: new Date().toISOString() }, { onConflict: "person_id,tc_id" });
          if (error) return bad(res, "Couldn't save it.", 500);
        }
        const { data: p } = await admin.from("people").select(`${DEAL_COLUMNS}, ${DEAL_PARTY_COLUMNS}`).eq("id", deal.id).maybeSingle();
        const foreign = p.owner_id !== owner;
        const [{ data: agent }, { data: placed }] = await Promise.all([
          admin.from("profiles").select("full_name, email").eq("id", p.owner_id).maybeSingle(),
          foreign ? admin.from("deal_tc_stages").select("stage").eq("person_id", deal.id).eq("tc_id", owner).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        return res.status(200).json({ ok: true, deal: { ...p, column: foreign ? placed?.stage || p.stage : p.stage, foreign, agent: agent?.full_name || "", agent_email: agent?.email || "" } });
      }

      const taskOutRow = (t, deal) => ({ id: t.id, section: t.section, position: t.position, text: t.text, done: t.done, done_at: t.done_at, due_override: t.due_override, due: effectiveDue(t, deal) || null });

      if (a === "deal_task_add" || a === "deal_doc_add") {
        if (!UUID.test(String(body.deal_id || ""))) return bad(res, "Missing deal.");
        const deal = await canWork(body.deal_id);
        if (!deal) return bad(res, "That deal isn't yours.", 404);
        const text = String(body.text || "").trim().slice(0, 300);
        if (!text) return bad(res, "Write what it is first.");
        const section = String(body.section || "").trim().slice(0, 60);
        const table = a === "deal_task_add" ? "transaction_tasks" : "transaction_documents";
        const { data: existing } = await admin.from(table).select("position, section" + (table === "transaction_tasks" ? ", anchor, offset_days" : "")).eq("person_id", deal.id).order("position").limit(500);
        if ((existing || []).length >= 500) return bad(res, "That's the most this list can hold.");
        const position = (existing || []).reduce((m, r) => Math.max(m, r.position), -1) + 1;
        if (table === "transaction_documents") {
          const { data, error } = await admin.from(table).insert({ person_id: deal.id, owner_id: owner, section, position, text }).select("id, section, position, text, done, review_status").single();
          return error ? bad(res, "Couldn't save it.", 500) : res.status(200).json({ ok: true, doc: data });
        }
        // A new task takes its section's due rule (the dashboard does the same); a brand new section starts on the contract date.
        const rule = (existing || []).find((r) => r.section === section);
        const { data, error } = await admin.from(table).insert({ person_id: deal.id, owner_id: owner, section, position, text, anchor: rule?.anchor || "contract_date", offset_days: rule?.offset_days ?? 0 }).select("id, section, position, text, done, done_at, due_override, anchor, offset_days").single();
        return error ? bad(res, "Couldn't save it.", 500) : res.status(200).json({ ok: true, task: taskOutRow(data, deal) });
      }

      const table = a.startsWith("deal_task") ? "transaction_tasks" : "transaction_documents";
      const idKey = table === "transaction_tasks" ? "task_id" : "doc_id";
      if (!UUID.test(String(body[idKey] || ""))) return bad(res, "Missing item.");
      const { data: row } = await admin.from(table).select("id, person_id").eq("id", body[idKey]).maybeSingle();
      if (!row || !(await canWork(row.person_id))) return bad(res, "That isn't yours.", 404);
      if (a === "deal_doc_done") {
        const done = body.done !== false;
        const { error } = await admin.from(table).update({ done, done_at: done ? new Date().toISOString() : null }).eq("id", row.id);
        return error ? bad(res, "Couldn't save it.", 500) : res.status(200).json({ ok: true });
      }
      const { error } = await admin.from(table).delete().eq("id", row.id);
      return error ? bad(res, "Couldn't delete it.", 500) : res.status(200).json({ ok: true });
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
