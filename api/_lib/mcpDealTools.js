// AI connection tools for deals (scope write_deals to change, read to look) and for drafts (scope write_drafts). They wrap the same logic as the
// People bot API: a deal is a person on the Deals board. Changes are limited to what an agent does day to day: dates, who is on the deal, earnest
// money, notes and the checklist. Nothing here submits to compliance, sends to e-sign, emails anyone or deletes anything.
import * as people from "./bots/people.js";
import * as posts from "./bots/posts.js";
import * as listings from "./bots/listings.js";
import { HttpError, bad } from "./bots/util.js";
import { listingFields, postFields } from "./toolFields.js";
import { WRITES, bool, int, obj, str } from "./mcpWriteTools.js";
import { act, idOf, look, render, strip } from "./mcpAct.js";
import { RECIPIENT_ROLES, STARTER_TEMPLATES, renderDealEmail, taskEmailKey, templatesForDeal } from "../../src/lib/dealEmails.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const own = { needAdmin: false };

const DATES = {
  contract_date: str("YYYY-MM-DD"), inspection_date: str("YYYY-MM-DD, the home inspection day"), inspection_time: str("HH:MM, the time of the home inspection"),
  inspection_period_end: str("YYYY-MM-DD, when the inspection period ends"), appraisal_date: str("YYYY-MM-DD (not for cash deals)"),
  financing_deadline: str("YYYY-MM-DD (not for cash deals)"), closing_date: str("YYYY-MM-DD"), closing_time: str("HH:MM, the time of the closing"),
};
const MONEY = {
  price: { type: "number", description: "Contract price in dollars" }, commission: { type: "number", description: "Commission in dollars" },
  earnest_money: { type: "number", description: "Earnest money in dollars" }, earnest_money_delivered: bool("true once it is at the title company (shows on the client and agent timelines)"),
  is_cash: bool("A cash purchase: no appraisal or financing dates, no lender"),
};
const WHO = {
  name: str("The client's name"), email: str("The client's email"), phone: str("The client's phone"),
  client2_name: str("Second client"), client2_email: str("Second client's email"),
  other_agent: str("The other agent (the listing agent on a buyer's deal)"), other_agent_email: str(""),
  other_agent2: str("A second agent on the other side, e.g. a co-listing agent"), other_agent2_email: str(""),
  other_agent_company: str("The other agent's brokerage"), other_agent_phone: str(""), other_agent2_company: str(""), other_agent2_phone: str(""),
  other_party_name: str("The other side's client: the seller on a buyer deal, the buyer on a seller deal"), financing_type: str("The loan type, e.g. Conventional, FHA, VA (leave empty for cash)"), title_phone: str("A phone number for the escrow officer"), lender_phone: str("A phone number for the lender contact"), other_agent_tc_name: str("The other agent's transaction coordinator"), other_agent_tc_email: str(""),
  title_company: str("The title company (no email of its own)"), escrow_officer: str("The escrow officer at the title company"), escrow_officer_email: str(""), title_processor_name: str(""), title_processor_email: str(""),
  lender: str(""), lender_email: str(""), loan_processor_name: str(""), loan_processor_email: str(""),
};
const DEAL_FIELDS = { property_address: str("The home"), side: { type: "string", enum: ["buyer", "seller"] }, ...DATES, ...MONEY, ...WHO };
const ANCHORS = ["contract_date", "inspection_date", "closing_date"];

// The person must be a deal; a lead or pipeline person is changed with the people tools.
async function dealOf(ctx, id) {
  const { person } = await people.getPerson(ctx, id);
  if (person.stage_group !== "transaction") throw new HttpError(400, `${person.name} isn't a deal (they're on the ${person.stage_group} board). Use the people tools for them.`);
  return person;
}
const dealName = (p) => p.property_address || p.name;

const reader = (name, title, scope, description, inputSchema, fn, opts = own) => ({ name, title, scope, description, inputSchema, annotations: READ, run: (sb, u, a, x) => look(sb, u, x, opts, (ctx, req) => fn(ctx, a || {}, req)) });
const writer = (name, title, scope, description, inputSchema, fn, opts = own) => ({
  name, title, scope, description, inputSchema, annotations: WRITES,
  run: (sb, u, a, x) => act(name, sb, u, x, opts, async (ctx, req) => {
    const r = await fn(ctx, a || {}, req);
    return { text: render(`Done: ${title}.`, r), audit: `${name}${idOf(r) ? ` ${idOf(r)}` : ""}` };
  }),
});

// ------------------------------------------------------------------------------------------------ coordinators
// A deal's transaction coordinator is picked from the office's TCs (profiles.deals_role = 'tc'). A pick (deal_tcs) lets that coordinator see
// and work this one deal, the same as choosing them in the deal panel. Unlike the panel, nothing is emailed: they find it in their Deals page.
const COORD = {
  coordinator_id: str("A coordinator's id from list_coordinators"),
  coordinator: str("Or the coordinator's name, as in list_coordinators"),
};
async function officeCoordinators(ctx) {
  const { data, error } = await ctx.client.from("profiles").select("id, full_name").eq("org_id", ctx.profile.org_id).eq("deals_role", "tc").order("full_name");
  if (error) throw new HttpError(500, error.message);
  return (data || []).map((p) => ({ id: p.id, name: p.full_name || "Coordinator" }));
}
// Finds the coordinator an id or a name points to, or says exactly why not (so a typo never assigns the wrong person).
async function pickCoordinator(ctx, a) {
  const all = await officeCoordinators(ctx);
  const list = all.length ? all.map((c) => c.name).join(", ") : "none set up yet; an admin adds them on the Agents page";
  if (a.coordinator_id) {
    const hit = all.find((c) => c.id === a.coordinator_id);
    if (!hit) throw new HttpError(404, `That isn't a transaction coordinator in your office. Coordinators: ${list}.`);
    return hit;
  }
  const q = String(a.coordinator || "").trim().toLowerCase();
  if (!q) throw bad("Say which coordinator: coordinator_id or coordinator (a name). Use list_coordinators to see them.");
  const exact = all.filter((c) => c.name.toLowerCase() === q);
  const hits = exact.length ? exact : all.filter((c) => c.name.toLowerCase().includes(q));
  if (hits.length === 0) throw new HttpError(404, `No coordinator matches "${a.coordinator}". Coordinators: ${list}.`);
  if (hits.length > 1) throw new HttpError(409, `More than one coordinator matches "${a.coordinator}": ${hits.map((c) => c.name).join(", ")}. Use coordinator_id.`);
  return hits[0];
}
// The agents a deal can be handed to: others in the office who use Deals.
async function dealAgents(ctx) {
  const { data, error } = await ctx.client.from("profiles").select("id, full_name").eq("org_id", ctx.profile.org_id).eq("people_enabled", true).order("full_name");
  if (error) throw new HttpError(500, error.message);
  return (data || []).map((p) => ({ id: p.id, name: p.full_name || "Agent" }));
}
async function pickAgent(ctx, a) {
  const all = await dealAgents(ctx);
  const list = all.map((c) => c.name).join(", ") || "none";
  if (a.agent_id) {
    const hit = all.find((c) => c.id === a.agent_id);
    if (!hit) throw new HttpError(404, `That isn't an agent in your office who uses Deals. Agents: ${list}.`);
    return hit;
  }
  const q = String(a.agent || "").trim().toLowerCase();
  if (!q) throw bad("Say which agent: agent_id or agent (a name). Use list_deal_agents to see them.");
  const exact = all.filter((c) => c.name.toLowerCase() === q);
  const hits = exact.length ? exact : all.filter((c) => c.name.toLowerCase().includes(q));
  if (hits.length === 0) throw new HttpError(404, `No agent matches "${a.agent}". Agents: ${list}.`);
  if (hits.length > 1) throw new HttpError(409, `More than one agent matches "${a.agent}": ${hits.map((c) => c.name).join(", ")}. Use agent_id.`);
  return hits[0];
}
const changeDealAgent = async (ctx, a) => {
  const agent = await pickAgent(ctx, a);
  const { data, error } = await ctx.client.rpc("deal_change_agent", { p_person: a.deal_id, p_agent: agent.id });
  if (error) throw new HttpError(/Only the deal|Sign in/.test(error.message) ? 403 : 400, error.message);
  return { deal: { id: a.deal_id, now_belongs_to: data.to, was: data.from, column: data.stage }, note: `${data.to} now has this deal${data.column_changed ? `, in their "${data.stage}" column` : ""}. Nobody was emailed.${ctx.ownerId === agent.id ? "" : " You can still work it if you are its coordinator; if not, it has left your Deals."}` };
};
const wantsCoordinator = (a) => !!(a.coordinator_id || a.coordinator);
async function assignCoordinator(ctx, dealId, tc) {
  const { error } = await ctx.client.from("deal_tcs").insert({ person_id: dealId, tc_id: tc.id });
  if (error && error.code !== "23505") throw new HttpError(error.code === "42501" ? 403 : 500, error.code === "42501" ? "You can only give a coordinator your own deals." : error.message);
  return { already: error?.code === "23505" };
}

// ------------------------------------------------------------------------------------------------ email templates
// The same templates the deal's Email button uses: the built-in starters, with this person's own copies swapped in, then their own. Nothing is sent.
async function emailTemplates(ctx) {
  const { data } = await ctx.client.from("deal_email_templates").select("*").order("position").order("created_at");
  const saved = data || [];
  const copies = new Map(saved.filter((s) => s.base_key).map((s) => [s.base_key, s]));
  const list = STARTER_TEMPLATES.map((st) => {
    const copy = copies.get(st.key);
    return copy ? { ...copy, key: st.key, group: st.group, skipCash: st.skipCash } : { ...st, id: null };
  });
  for (const s of saved) if (!s.base_key) list.push({ ...s, key: s.id });
  return list;
}
const listEmailTemplates = async (ctx) => {
  const all = await emailTemplates(ctx);
  const roles = Object.fromEntries(RECIPIENT_ROLES.map((r) => [r.key, r.label]));
  return render(`${all.length} email templates (use draft_deal_email to fill one in for a deal):`, all.map((t) => ({ id: t.id || t.key, name: t.name, for: t.side === "both" ? "buyer and seller deals" : `${t.side} deals`, to: t.to_roles.map((k) => roles[k] || k), cc: t.cc_roles.map((k) => roles[k] || k) })));
};
// Fills a template in for a deal: who it goes to, the subject and the body, with anything missing flagged. The agent sends it from their own email.
const draftDealEmail = async (ctx, a) => {
  const { data: deal } = await ctx.client.from("people").select("*").eq("id", a.deal_id).eq("stage_group", "transaction").maybeSingle();
  if (!deal) throw new HttpError(404, "No deal with that id that you can see.");
  const all = await emailTemplates(ctx);
  const q = String(a.template || "").trim().toLowerCase();
  const pool = templatesForDeal(all, deal);
  const hit = pool.find((t) => t.id === a.template || t.key === a.template) || pool.find((t) => t.name.toLowerCase() === q) || pool.filter((t) => t.name.toLowerCase().includes(q))[0];
  if (!hit) throw new HttpError(404, `No email template matches "${a.template}" for this deal. Templates: ${pool.map((t) => t.name).join("; ")}.`);
  const [{ data: me }, { data: agent }, { data: per }, { data: wide }] = await Promise.all([
    ctx.client.from("profiles").select("full_name, email, phone").eq("id", ctx.ownerId).maybeSingle(),
    ctx.client.from("profiles").select("full_name, email, phone, org_id").eq("id", deal.owner_id).maybeSingle(),
    ctx.client.from("deal_tcs").select("tc_id").eq("person_id", deal.id),
    ctx.client.from("deal_team").select("tc_id").eq("agent_id", deal.owner_id),
  ]);
  const ids = [...new Set([...(per || []), ...(wide || [])].map((r) => r.tc_id))];
  const { data: tcs } = ids.length ? await ctx.client.from("profiles").select("full_name, email").in("id", ids) : { data: [] };
  const { data: org } = agent?.org_id ? await ctx.client.from("organizations").select("name").eq("id", agent.org_id).maybeSingle() : { data: null };
  const email = renderDealEmail(hit, deal, {
    me: { name: me?.full_name, email: me?.email, phone: me?.phone },
    agent: { name: agent?.full_name, email: agent?.email, phone: agent?.phone, company: org?.name },
    coordinators: (tcs || []).map((t) => ({ name: t.full_name, email: t.email })),
  });
  return render(`Draft from "${hit.name}". Nothing was sent: show it to the agent, who opens it in their own email app from the deal's "Email with a template" button, or copies it.${email.missing.length ? ` Still blank: ${email.missing.join(", ")}.` : ""}${email.noEmail.length ? ` No email address yet for: ${email.noEmail.join(", ")}.` : ""}`, { to: email.to, cc: email.cc, subject: email.subject, body: email.body });
};

// ------------------------------------------------------------------------------------------------ deals
const listDeals = async (ctx, a) => {
  const { people: rows } = await people.listPeople(ctx, { group: "transaction", archived: a.include_archived ? "all" : "false", q: a.query, limit: a.limit || 50, order: "updated" });
  const slim = rows.map((p) => ({ id: p.id, name: p.name, property: p.property_address, side: p.side, column: p.stage, price: p.price, contract: p.contract_date, inspection: p.inspection_date, closing: p.closing_date, archived: p.archived }));
  // Deals other agents own that this person coordinates (row-level security only returns the ones they may see).
  let q = ctx.client.from("people").select("id, name, property_address, side, stage, price, contract_date, inspection_date, closing_date, archived, owner:profiles!people_owner_id_fkey(full_name)").eq("stage_group", "transaction").neq("owner_id", ctx.ownerId).order("updated_at", { ascending: false }).limit(a.limit || 50);
  if (!a.include_archived) q = q.eq("archived", false);
  if (a.query) q = q.or(`name.ilike.%${String(a.query).replace(/[%,()]/g, " ")}%,property_address.ilike.%${String(a.query).replace(/[%,()]/g, " ")}%`);
  const { data: others } = await q;
  const coordinated = (others || []).map((p) => ({ id: p.id, agent: p.owner?.full_name || "Another agent", name: p.name, property: p.property_address, side: p.side, column: p.stage, price: p.price, contract: p.contract_date, inspection: p.inspection_date, closing: p.closing_date, archived: p.archived }));
  const head = `${slim.length} deal${slim.length === 1 ? "" : "s"}:`;
  return coordinated.length ? `${render(head, slim)}\n${render(`${coordinated.length} more you coordinate for other agents (work them with the same deal tools):`, coordinated)}` : render(head, slim);
};
const getDeal = async (ctx, a) => {
  const [{ person, notes }, checklist] = await Promise.all([people.getPerson(ctx, a.deal_id), people.getChecklist(ctx, a.deal_id)]);
  if (person.stage_group !== "transaction") throw new HttpError(400, `${person.name} isn't a deal.`);
  const keep = ["id", "name", "email", "phone", "property_address", "side", "stage", "price", "commission", "contract_date", "inspection_date", "inspection_time", "inspection_period_end", "appraisal_date", "financing_deadline", "closing_date", "closing_time", "earnest_money", "earnest_money_delivered", "is_cash", "compliance_status", "other_agent", "other_agent_email", "other_agent_company", "other_agent_phone", "other_agent2", "other_agent2_email", "other_agent2_company", "other_agent2_phone", "other_party_name", "financing_type", "title_phone", "lender_phone", "other_agent_tc_name", "other_agent_tc_email", "title_company", "escrow_officer", "escrow_officer_email", "title_processor_name", "title_processor_email", "lender", "lender_email", "loan_processor_name", "loan_processor_email", "client2_name", "client2_email"];
  const deal = Object.fromEntries(keep.filter((k) => person[k] !== null && person[k] !== undefined && person[k] !== "").map((k) => [k, person[k]]));
  const [{ data: picked }, { data: wide }, office] = await Promise.all([ctx.client.from("deal_tcs").select("tc_id").eq("person_id", a.deal_id), ctx.client.from("deal_team").select("tc_id").eq("agent_id", ctx.ownerId), officeCoordinators(ctx)]);
  const nameOf = (id) => office.find((c) => c.id === id)?.name || "Coordinator";
  const coordinators = (picked || []).map((r) => ({ id: r.tc_id, name: nameOf(r.tc_id) }));
  const coordinators_on_all_your_deals = (wide || []).map((r) => nameOf(r.tc_id));
  // Tasks that are an email name their template, so draft_deal_email can fill it in.
  const [emailTemplatesAll, { data: links }] = await Promise.all([emailTemplates(ctx), ctx.client.from("transaction_tasks").select("id, email_template").eq("person_id", a.deal_id)]);
  const linkOf = new Map((links || []).map((l) => [l.id, l.email_template]));
  const emailFor = (t) => {
    const key = taskEmailKey({ text: t.text, email_template: linkOf.get(t.id) }, person.side);
    return key ? emailTemplatesAll.find((x) => x.key === key || x.id === key)?.name : undefined;
  };
  return render("Deal:", { deal, coordinators, coordinators_on_all_your_deals, tasks: checklist.tasks.map((t) => ({ id: t.id, text: t.text, section: t.section, due: t.due, done: t.done, email_template: emailFor(t) })), documents: checklist.documents.map(({ id, text, done }) => ({ id, text, done })), recent_notes: notes.slice(0, 5).map((n) => ({ at: n.created_at.slice(0, 10), note: n.body })) });
};
// A coordinator named on a new deal is looked up first, so a name that doesn't match fails before anything is created.
const addDeal = async (ctx, a) => {
  const tc = wantsCoordinator(a) ? await pickCoordinator(ctx, a) : null;
  const made = await people.createPerson(ctx, { ...strip(a, "coordinator_id", "coordinator"), stage_group: "transaction" });
  if (!tc) return made;
  try {
    await assignCoordinator(ctx, made.person.id, tc);
    return { ...made, coordinator: tc };
  } catch (err) {
    return { ...made, coordinator_not_assigned: `${tc.name} couldn't be added (${err.message}). The deal is saved; use assign_deal_coordinator to try again.` };
  }
};
const assignDealCoordinator = async (ctx, a) => {
  const deal = await dealOf(ctx, a.deal_id);
  const tc = await pickCoordinator(ctx, a);
  const { already } = await assignCoordinator(ctx, deal.id, tc);
  return { deal: { id: deal.id, name: dealName(deal) }, coordinator: tc, note: already ? `${tc.name} was already on this deal.` : `${tc.name} can now see and work this deal in their Deals page. They were not emailed.` };
};
const removeDealCoordinator = async (ctx, a) => {
  const deal = await dealOf(ctx, a.deal_id);
  const tc = await pickCoordinator(ctx, a);
  const { data, error } = await ctx.client.from("deal_tcs").delete().eq("person_id", deal.id).eq("tc_id", tc.id).select("tc_id");
  if (error) throw new HttpError(500, error.message);
  return { deal: { id: deal.id, name: dealName(deal) }, coordinator: tc, note: data?.length ? `${tc.name} no longer has this deal.` : `${tc.name} wasn't picked for this deal. (A coordinator an admin set up for all of your deals stays on it; that is changed on the Agents page.)` };
};
const updateDeal = async (ctx, a) => {
  const deal = await dealOf(ctx, a.deal_id);
  const body = strip(a, "deal_id");
  if (!Object.keys(body).length) throw bad("Nothing to change. Send at least one field.");
  const { person } = await people.updatePerson(ctx, deal.id, body);
  return { deal: { id: person.id, name: dealName(person), closing_date: person.closing_date } };
};

export const DEAL_TOOLS = [
  reader("list_deals", "List deals", "read", "The agent's deals (transactions) with side, column, price and key dates. query searches name, email, phone or address.", obj({ query: str("Name, email or address fragment"), include_archived: bool("Include archived deals"), limit: int("Max deals (default 50)") }), listDeals),
  reader("get_deal", "Get a deal", "read", "One deal in full: dates, price, earnest money, everyone on it, the checklist tasks (with due dates and ids) and documents, and recent notes.", obj({ deal_id: str("Deal id from list_deals") }, ["deal_id"]), getDeal),
  reader("list_coordinators", "List transaction coordinators", "read", "The transaction coordinators (TCs) in the agent's office, with ids. Pick one for a deal with assign_deal_coordinator, or name one when starting a deal with add_deal.", obj(), async (ctx) => {
    const all = await officeCoordinators(ctx);
    return render(`${all.length} coordinator${all.length === 1 ? "" : "s"}${all.length ? "" : " (an admin adds them on the Agents page)"}:`, all);
  }),
  writer("add_deal", "start a deal", "write_deals",
    "Start a deal (a transaction) for the agent: the client's name, the side (buyer or seller) and the property, with any dates. Name the transaction coordinator with coordinator or coordinator_id (see list_coordinators) to assign them in the same step. Refuses a duplicate email unless the agent confirmed. Afterwards, apply_deal_checklist adds the standard tasks.",
    obj({ ...DEAL_FIELDS, ...COORD, allow_duplicate: bool("Only if the agent confirmed a second person with this email is right"), note: str("A first note") }, ["name", "side"]), addDeal),
  writer("update_deal", "update a deal", "write_deals", "Change a deal's key dates, price, commission, earnest money (and whether it was delivered), cash purchase flag, and who is on it (second client, the other agent and their coordinator, title company and processor, lender and loan processor, each with an email). Send only what changes.", obj({ deal_id: str("Deal id from list_deals"), ...DEAL_FIELDS }, ["deal_id"]), updateDeal),
  reader("list_email_templates", "List email templates", "read", "The agent's deal email templates (the built-in starters plus their own): what each is for and who it goes to. Fill one in for a deal with draft_deal_email.", obj(), listEmailTemplates),
  reader("draft_deal_email", "fill in an email template for a deal", "read", "Fill an email template in from a deal: the people it goes to (To and Cc, picked from who is on the deal), the subject and the body with the deal's details. Anything the deal doesn't have yet is reported and left as [blank] in the text. NOTHING is sent: the agent opens it in their own email app from the deal's Email button. Send template as its name or id from list_email_templates.", obj({ deal_id: str("Deal id from list_deals"), template: str("Template name or id, e.g. \"Open the file with title\"") }, ["deal_id", "template"]), draftDealEmail),
  reader("list_deal_agents", "List agents who use Deals", "read", "The agents in the office who use Deals, with ids. A deal can be handed to any of them with change_deal_agent.", obj(), async (ctx) => {
    const all = await dealAgents(ctx);
    return render(`${all.length} agent${all.length === 1 ? "" : "s"}:`, all);
  }),
  writer("change_deal_agent", "change a deal's agent", "write_deals", "Hand a deal to a different agent in the office, for a deal that was started under the wrong person. Works for the deal's agent or a coordinator on it (a coordinator stays on it). The deal, its checklist, documents and notes move to the new agent's Deals board, in the same column if they have it. It leaves the previous agent's board. Nobody is emailed. Send agent_id or the agent's name (see list_deal_agents).", obj({ deal_id: str("Deal id from list_deals"), agent_id: str("The new agent's id from list_deal_agents"), agent: str("Or the new agent's name") }, ["deal_id"]), changeDealAgent),
  writer("assign_deal_coordinator", "assign a coordinator", "write_deals", "Put a transaction coordinator on one of the agent's deals. They can then see and work that deal (only that one) in their Deals page. Not emailed. Use list_coordinators for the choices; send coordinator_id or the coordinator's name.", obj({ deal_id: str("Deal id from list_deals"), ...COORD }, ["deal_id"]), assignDealCoordinator),
  writer("remove_deal_coordinator", "remove a coordinator", "write_deals", "Take a transaction coordinator off one deal. Nothing is deleted from the deal.", obj({ deal_id: str("Deal id from list_deals"), ...COORD }, ["deal_id"]), removeDealCoordinator),
  writer("add_deal_note", "add a deal note", "write_deals", "Add a note to a deal.", obj({ deal_id: str("Deal id"), text: str("The note") }, ["deal_id", "text"]), async (ctx, a) => {
    const deal = await dealOf(ctx, a.deal_id);
    try {
      await people.addNote(ctx, deal.id, { body: a.text });
    } catch (err) {
      // Notes are the deal's agent's own; a coordinator on someone else's deal keeps in touch through the deal's message thread in the dashboard.
      if (/row-level security/i.test(err.message)) throw new HttpError(403, "Notes on this deal belong to its agent, so a coordinator can't add one here. Use the deal's Messages tab in the dashboard.");
      throw err;
    }
    return { note_added_to: dealName(deal) };
  }),
  writer("apply_deal_checklist", "apply the checklist", "write_deals", "Fill an empty deal with the agent's standard checklist for its side (tasks, documents or both). Refuses if it already has one.", obj({ deal_id: str("Deal id"), kind: { type: "string", enum: ["tasks", "documents", "both"] } }, ["deal_id"]), async (ctx, a) => {
    await dealOf(ctx, a.deal_id);
    return people.applyChecklist(ctx, a.deal_id, { kind: a.kind });
  }),
  writer("add_deal_task", "add a deal task", "write_deals", "Add a task to a deal's checklist. Its due date can follow a deal date (anchor + offset_days) or be pinned (due_override).", obj({ deal_id: str("Deal id"), text: str("The task"), section: str("A heading to group it under"), anchor: { type: "string", enum: ANCHORS }, offset_days: int("Days after (positive) or before (negative) the anchor"), due_override: str("YYYY-MM-DD") }, ["deal_id", "text"]), async (ctx, a) => {
    await dealOf(ctx, a.deal_id);
    return people.addChecklistTask(ctx, a.deal_id, strip(a, "deal_id"));
  }),
  writer("update_deal_task", "change a deal task", "write_deals", "Change a deal checklist task: its wording, section or due date.", obj({ task_id: str("Task id from get_deal"), text: str(""), section: str(""), anchor: { type: "string", enum: ANCHORS }, offset_days: int(""), due_override: str("YYYY-MM-DD, or an empty string to clear") }, ["task_id"]), (ctx, a) => people.updateChecklistTask(ctx, a.task_id, strip(a, "task_id"))),
  writer("complete_deal_task", "tick off a deal task", "write_deals", "Mark a deal checklist task done.", obj({ task_id: str("Task id from get_deal") }, ["task_id"]), (ctx, a) => people.updateChecklistTask(ctx, a.task_id, { done: true })),
  writer("reopen_deal_task", "reopen a deal task", "write_deals", "Mark a deal checklist task as not done.", obj({ task_id: str("Task id from get_deal") }, ["task_id"]), (ctx, a) => people.updateChecklistTask(ctx, a.task_id, { done: false })),
  writer("update_deal_document", "mark a deal document", "write_deals", "Mark a document on a deal's checklist collected (or not), or change its wording. Adds a document with deal_id and text instead.", obj({ document_id: str("Document id from get_deal"), deal_id: str("Deal id, to add a new document"), done: bool("Collected"), text: str("Wording") }), async (ctx, a) => {
    if (a.document_id) return people.updateChecklistDocument(ctx, a.document_id, { done: a.done, text: a.text });
    if (!a.deal_id || !a.text) throw bad("Send document_id to change one, or deal_id and text to add one.");
    await dealOf(ctx, a.deal_id);
    return people.addChecklistDocument(ctx, a.deal_id, { text: a.text });
  }),
];

// ------------------------------------------------------------------------------------------------ drafts
// Messages are drafts the agent reviews and sends themselves from the dashboard. A regular agent drafts blog posts on their OWN site and listings of
// their OWN, always as drafts; the owner's manage_ tools can do the same for any agent and publish.
async function ownSite(ctx) {
  const { data } = await ctx.client.from("agent_sites").select("id").eq("agent_id", ctx.ownerId).maybeSingle();
  if (!data) throw new HttpError(404, "You don't have a website yet.");
  return data.id;
}
const draftsOnly = { grant: ["blog", "listings"] };

// Publishing is its own permission (publish_blog): an agent's AI can write drafts without it, and with it can also put their OWN posts live.
async function ownPost(ctx, id, req) {
  const { post } = await posts.getPost(ctx, id, req);
  if (post.agent_site_id !== (await ownSite(ctx))) throw new HttpError(403, "That post isn't on your website.");
  return post;
}

export const DRAFT_TOOLS = [
  reader("list_drafts", "List waiting drafts", "read", "Messages drafted for the agent to review and send, newest first (status draft by default).", obj({ status: { type: "string", enum: ["draft", "sent", "discarded"] }, person_id: str("Only this person's drafts"), limit: int("Max drafts") }), async (ctx, a) => render("Drafts:", (await people.listOutreach(ctx, a)).outreach)),
  writer("draft_message", "draft a message", "write_drafts",
    "Write a draft email, text or call talking points for a person (lead, pipeline person or deal) for the agent to review. NOTHING is sent: the draft waits on the person's card in the dashboard, where the agent opens it in their own mail or messages app. An email needs an email on file; a text or call needs a phone. At most 10 waiting per person.",
    obj({ person_id: str("Person id from find_person or list_deals"), channel: { type: "string", enum: ["email", "text", "call"] }, subject: str("Email subject"), body: str("The message, or for a call the talking points") }, ["person_id", "channel", "body"]),
    (ctx, a) => people.createOutreach(ctx, a.person_id, strip(a, "person_id"))),
  writer("update_draft", "edit a draft", "write_drafts", "Reword a draft message that hasn't been sent.", obj({ draft_id: str("Draft id from list_drafts"), subject: str(""), body: str("") }, ["draft_id"]), (ctx, a) => people.updateOutreach(ctx, a.draft_id, strip(a, "draft_id"))),
  writer("discard_draft", "discard a draft", "write_drafts", "Throw away a draft message. (It is marked discarded, not deleted.)", obj({ draft_id: str("Draft id from list_drafts") }, ["draft_id"]), (ctx, a) => people.updateOutreach(ctx, a.draft_id, { status: "discarded" })),
  writer("draft_blog_post", "draft a blog post", "write_drafts", "Write a blog post on the agent's own website, saved as a DRAFT (they publish it from the dashboard). Write the body in markdown (## for sections).", obj({ ...strip(postFields, "status", "scheduled_at", "featured_order") }, ["title"]), async (ctx, a, req) => posts.createPost(ctx, await ownSite(ctx), { ...a, status: "draft" }, req), draftsOnly),
  writer("edit_blog_draft", "edit a blog draft", "write_drafts", "Edit one of the agent's own blog posts that is still a draft. (A published post is changed in the dashboard.)", obj({ post_id: str("Post id from list_blog_posts"), ...strip(postFields, "status", "scheduled_at", "featured_order") }, ["post_id"]), async (ctx, a, req) => {
    const { post } = await posts.getPost(ctx, a.post_id, req);
    if (post.status !== "draft") throw new HttpError(409, "That post isn't a draft any more. Published and scheduled posts are changed in the dashboard.");
    return posts.updatePost(ctx, a.post_id, { ...strip(a, "post_id"), status: "draft" }, req);
  }, draftsOnly),
  writer("publish_blog_post", "publish a blog post", "publish_blog", "Publish one of the agent's OWN blog posts (a draft they or you wrote) so it goes live on their website now, or schedule it with scheduled_at. Only publish when the agent asks, and tell them the post's address afterwards.", obj({ post_id: str("Post id from list_blog_posts"), scheduled_at: str("ISO date-time to publish later, e.g. 2026-11-05T09:00:00-06:00; leave out to publish now") }, ["post_id"]), async (ctx, a, req) => {
    await ownPost(ctx, a.post_id, req);
    return posts.updatePost(ctx, a.post_id, a.scheduled_at ? { status: "scheduled", scheduled_at: a.scheduled_at } : { status: "published" }, req);
  }, draftsOnly),
  writer("unpublish_blog_post", "take a blog post offline", "publish_blog", "Take one of the agent's own published or scheduled blog posts back to a draft. Nothing is deleted.", obj({ post_id: str("Post id from list_blog_posts") }, ["post_id"]), async (ctx, a, req) => {
    await ownPost(ctx, a.post_id, req);
    return posts.updatePost(ctx, a.post_id, { status: "draft" }, req);
  }, draftsOnly),
  writer("edit_my_blog_post", "edit a blog post", "publish_blog", "Edit one of the agent's own blog posts whatever its status (a published post changes on their site straight away). Does not change whether it is published; use publish_blog_post or unpublish_blog_post for that.", obj({ post_id: str("Post id from list_blog_posts"), ...strip(postFields, "status", "scheduled_at", "featured_order") }, ["post_id"]), async (ctx, a, req) => {
    await ownPost(ctx, a.post_id, req);
    return posts.updatePost(ctx, a.post_id, strip(a, "post_id"), req);
  }, draftsOnly),
  writer("draft_listing", "draft a listing", "write_drafts", "Create a listing for the agent saved as a DRAFT (not public until they publish it in the dashboard). Photos are picture addresses that get downloaded and stored.", obj({ ...strip(listingFields, "status") }, ["address_line1", "city", "state", "zip"]), (ctx, a, req) => listings.createListing(ctx, { ...a, agent_id: ctx.ownerId, status: "draft" }, req), draftsOnly),
  writer("edit_listing_draft", "edit a listing draft", "write_drafts", "Edit one of the agent's own listings that is still a draft, including adding photos.", obj({ listing_id: str("Listing id"), ...strip(listingFields, "status") }, ["listing_id"]), async (ctx, a, req) => {
    const { listing } = await listings.getListing(ctx, a.listing_id, req);
    if (listing.status !== "draft" || listing.agent_id !== ctx.ownerId) throw new HttpError(409, "That isn't one of your draft listings. Published listings are changed in the dashboard.");
    return listings.updateListing(ctx, a.listing_id, { ...strip(a, "listing_id"), status: "draft" }, req);
  }, draftsOnly),
];
