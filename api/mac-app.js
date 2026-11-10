// What the Latchpoint Mac app asks of the dashboard besides text sync (api/text-sync.js): the "Today" list for notifications and the menu bar, marking a
// website lead as answered, and quick add. Signed with the Mac's own device key (Authorization: Bearer ts_...), never a browser session, so the app needs no
// sign-in handling of its own. Every read and write is filtered to the key's owner here, because this uses the service role.
//   GET  /api/mac-app?a=today        leads waiting for a first reply, follow-ups due, deal tasks due
//   POST /api/mac-app?a=responded    {person_id}   the agent called or texted a waiting lead from a notification
//   GET  /api/mac-app?a=search&q=    contacts matching a name, phone number or email (for quick add)
//   POST /api/mac-app?a=note         {contact_id, kind, body}
//   POST /api/mac-app?a=task         {title, due_date?, contact_id?}
//   POST /api/mac-app?a=contact      {first_name, last_name, company, phone, email, relationship?, force?}   a duplicate is reported, not created, unless force
import { serviceClient } from "./_lib/authUser.js";
import { deviceFor } from "./_lib/macDevice.js";
import { effectiveDue } from "../src/lib/checklistDefaults.js";
import { touchDue } from "../src/lib/contacts.js";

const TZ = "America/Chicago";
const DAY = 24 * 60 * 60 * 1000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOTE_KINDS = ["note", "call", "text", "email", "meeting", "showing", "other"];
const RELATIONSHIPS = ["client", "past_client", "lead", "sphere", "referral_partner", "vendor", "agent", "lender", "other"];

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

    if (req.method !== "POST") return bad(res, "Not found.", 404);

    if (a === "responded") {
      if (!UUID.test(String(body.person_id || ""))) return bad(res, "Missing person.");
      await admin.from("people").update({ first_response_at: new Date().toISOString() }).eq("id", body.person_id).eq("owner_id", owner).not("lead_id", "is", null).is("first_response_at", null);
      return res.status(200).json({ ok: true });
    }

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
      const due = DATE.test(String(body.due_date || "")) ? body.due_date : null;
      let contactId = null;
      if (body.contact_id) {
        const contact = await ownsContact(body.contact_id);
        if (!contact) return bad(res, "That contact isn't yours.");
        contactId = contact.id;
      }
      const { error } = await admin.from("agent_tasks").insert({ owner_id: owner, title, due_date: due, recurrence: "none", ...(contactId ? { contact_id: contactId } : {}) });
      if (error) return bad(res, "Couldn't save it.", 500);
      return res.status(200).json({ ok: true });
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

    return bad(res, "Not found.", 404);
  } catch (err) {
    console.error("mac-app:", a, err);
    return bad(res, "Something went wrong.", 500);
  }
}
