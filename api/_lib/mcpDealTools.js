// AI connection tools for deals (scope write_deals to change, read to look) and for drafts (scope write_drafts). They wrap the same logic as the
// People bot API: a deal is a person on the Deals board. Changes are limited to what an agent does day to day: dates, who is on the deal, earnest
// money, notes and the checklist. Nothing here submits to compliance, sends to e-sign, emails anyone or deletes anything.
import * as people from "./bots/people.js";
import * as posts from "./bots/posts.js";
import * as listings from "./bots/listings.js";
import { HttpError, bad } from "./bots/util.js";
import { listingFields, postFields } from "./bots/openapi.js";
import { WRITES, bool, int, obj, str } from "./mcpWriteTools.js";
import { act, idOf, look, render, strip } from "./mcpAct.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const own = { needAdmin: false };

const DATES = {
  contract_date: str("YYYY-MM-DD"), inspection_date: str("YYYY-MM-DD, the home inspection day"), inspection_time: str("HH:MM, the time of the home inspection"),
  inspection_period_end: str("YYYY-MM-DD, when the inspection period ends"), appraisal_date: str("YYYY-MM-DD (not for cash deals)"),
  financing_deadline: str("YYYY-MM-DD (not for cash deals)"), closing_date: str("YYYY-MM-DD"),
};
const MONEY = {
  price: { type: "number", description: "Contract price in dollars" }, commission: { type: "number", description: "Commission in dollars" },
  earnest_money: { type: "number", description: "Earnest money in dollars" }, earnest_money_delivered: bool("true once it is at the title company (shows on the client and agent timelines)"),
  is_cash: bool("A cash purchase: no appraisal or financing dates, no lender"),
};
const WHO = {
  name: str("The client's name"), email: str("The client's email"), phone: str("The client's phone"),
  client2_name: str("Second client"), client2_email: str("Second client's email"),
  other_agent: str("The other agent"), other_agent_email: str(""), other_agent_tc_name: str("The other agent's transaction coordinator"), other_agent_tc_email: str(""),
  title_company: str(""), title_company_email: str(""), title_processor_name: str(""), title_processor_email: str(""),
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

// ------------------------------------------------------------------------------------------------ deals
const listDeals = async (ctx, a) => {
  const { people: rows } = await people.listPeople(ctx, { group: "transaction", archived: a.include_archived ? "all" : "false", q: a.query, limit: a.limit || 50, order: "updated" });
  const slim = rows.map((p) => ({ id: p.id, name: p.name, property: p.property_address, side: p.side, column: p.stage, price: p.price, contract: p.contract_date, inspection: p.inspection_date, closing: p.closing_date, archived: p.archived }));
  return render(`${slim.length} deal${slim.length === 1 ? "" : "s"}:`, slim);
};
const getDeal = async (ctx, a) => {
  const [{ person, notes }, checklist] = await Promise.all([people.getPerson(ctx, a.deal_id), people.getChecklist(ctx, a.deal_id)]);
  if (person.stage_group !== "transaction") throw new HttpError(400, `${person.name} isn't a deal.`);
  const keep = ["id", "name", "email", "phone", "property_address", "side", "stage", "price", "commission", "contract_date", "inspection_date", "inspection_time", "inspection_period_end", "appraisal_date", "financing_deadline", "closing_date", "earnest_money", "earnest_money_delivered", "is_cash", "compliance_status", "other_agent", "other_agent_email", "other_agent_tc_name", "other_agent_tc_email", "title_company", "title_company_email", "title_processor_name", "title_processor_email", "lender", "lender_email", "loan_processor_name", "loan_processor_email", "client2_name", "client2_email"];
  const deal = Object.fromEntries(keep.filter((k) => person[k] !== null && person[k] !== undefined && person[k] !== "").map((k) => [k, person[k]]));
  return render("Deal:", { deal, tasks: checklist.tasks.map(({ id, text, section, due, done }) => ({ id, text, section, due, done })), documents: checklist.documents.map(({ id, text, done }) => ({ id, text, done })), recent_notes: notes.slice(0, 5).map((n) => ({ at: n.created_at.slice(0, 10), note: n.body })) });
};
const addDeal = (ctx, a) => people.createPerson(ctx, { ...a, stage_group: "transaction" });
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
  writer("add_deal", "start a deal", "write_deals",
    "Start a deal (a transaction) for the agent: the client's name, the side (buyer or seller) and the property, with any dates. Refuses a duplicate email unless the agent confirmed. Afterwards, apply_deal_checklist adds the standard tasks.",
    obj({ ...DEAL_FIELDS, allow_duplicate: bool("Only if the agent confirmed a second person with this email is right"), note: str("A first note") }, ["name", "side"]), addDeal),
  writer("update_deal", "update a deal", "write_deals", "Change a deal's key dates, price, commission, earnest money (and whether it was delivered), cash purchase flag, and who is on it (second client, the other agent and their coordinator, title company and processor, lender and loan processor, each with an email). Send only what changes.", obj({ deal_id: str("Deal id from list_deals"), ...DEAL_FIELDS }, ["deal_id"]), updateDeal),
  writer("add_deal_note", "add a deal note", "write_deals", "Add a note to a deal.", obj({ deal_id: str("Deal id"), text: str("The note") }, ["deal_id", "text"]), async (ctx, a) => {
    const deal = await dealOf(ctx, a.deal_id);
    await people.addNote(ctx, deal.id, { body: a.text });
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
  writer("draft_listing", "draft a listing", "write_drafts", "Create a listing for the agent saved as a DRAFT (not public until they publish it in the dashboard). Photos are picture addresses that get downloaded and stored.", obj({ ...strip(listingFields, "status") }, ["address_line1", "city", "state", "zip"]), (ctx, a, req) => listings.createListing(ctx, { ...a, agent_id: ctx.ownerId, status: "draft" }, req), draftsOnly),
  writer("edit_listing_draft", "edit a listing draft", "write_drafts", "Edit one of the agent's own listings that is still a draft, including adding photos.", obj({ listing_id: str("Listing id"), ...strip(listingFields, "status") }, ["listing_id"]), async (ctx, a, req) => {
    const { listing } = await listings.getListing(ctx, a.listing_id, req);
    if (listing.status !== "draft" || listing.agent_id !== ctx.ownerId) throw new HttpError(409, "That isn't one of your draft listings. Published listings are changed in the dashboard.");
    return listings.updateListing(ctx, a.listing_id, { ...strip(a, "listing_id"), status: "draft" }, req);
  }, draftsOnly),
];
