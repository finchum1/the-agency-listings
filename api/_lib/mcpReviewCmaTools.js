// AI connection tools for review requests and for CMAs (api/mcp.js). Same rules as the other tools: they run as the agent through row-level security,
// are validated, logged and rate limited, delete nothing, and SEND nothing. A review request is only ever a message for the agent to send themselves.
//   reviews:  list_reviews, review_request_message (read); add_to_review_list, update_review_status, record_review, add_review_to_website  (scope write_tasks)
//   CMAs:     list_cmas, get_cma (read); update_cma_net_sheet, update_cma_presentation, attach_cma_to_listing, detach_cma, set_cma_sold_price  (scope write_people)
import { HttpError, bad, isUuid } from "./bots/util.js";
import { WRITES, bool, change, dayText, int, obj, str } from "./mcpWriteTools.js";
import { adjustedPrice, computeCma, factsLine, subjectAddress, toNumber } from "../../src/lib/cma.js";
import { hasNetSheet, netScenarios } from "../../src/lib/netSheet.js";
import { MAX_PLAN_ITEMS, withDefaults as presentationDefaults } from "../../src/lib/presentation.js";
import { compareAttached, diffText } from "../../src/lib/cmaAttach.js";
import { attachCma as attachOp, cmaName, detachCma as detachOp, GUIDE_THEME_KEYS, loadCma as loadCmaOp, saveNetSheet, savePresentation, setSoldPrice } from "./cmaOps.js";
import { bylineOf, reviewMessage, testimonialHtml } from "../../src/lib/reviews.js";
import { formatPrice } from "../../src/lib/format.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const id = (v, what) => {
  if (!isUuid(v)) throw bad(`That isn't a valid ${what} id. Use the list tool to get one.`);
  return v;
};
const cname = (c) => [c?.first_name, c?.last_name].filter(Boolean).join(" ") || c?.company || "(no name)";
const day = (iso) => (iso ? dayText(String(iso).slice(0, 10)) : "");
const money = (n) => (n == null ? "—" : formatPrice(n));

// ------------------------------------------------------------------------------------------------------ reviews

const REVIEW_STATUSES = ["to_ask", "asked", "skipped"];
const STATUS_TEXT = { to_ask: "to ask", asked: "asked, waiting", received: "got a review", skipped: "skipped" };

async function loadReview(sb, userId, reviewId) {
  const { data } = await sb.from("contact_reviews").select("*, contact:contacts(id, first_name, last_name, company, phone, email, do_not_contact)").eq("id", id(reviewId, "review")).eq("owner_id", userId).maybeSingle();
  if (!data) throw new HttpError(404, "No review request with that id. Use list_reviews.");
  return data;
}
const reviewLine = (r) =>
  `${cname(r.contact)} | ${STATUS_TEXT[r.status]}${r.status === "received" ? ` | ${r.rating || "?"} stars${r.testimonial_id ? " | on the website" : ""}` : ""}${r.asked_at ? ` | asked ${day(r.asked_at)}` : ""} | review id ${r.id} | contact id ${r.contact_id}`;

async function listReviews(sb, userId, a) {
  let q = sb.from("contact_reviews").select("*, contact:contacts(id, first_name, last_name, company, do_not_contact)").eq("owner_id", userId).order("created_at", { ascending: false }).limit(60);
  if (a.status) {
    if (![...REVIEW_STATUSES, "received"].includes(a.status)) throw bad("status must be to_ask, asked, received or skipped.");
    q = q.eq("status", a.status);
  }
  const { data, error } = await q;
  if (error) throw new HttpError(500, error.message);
  const { data: prof } = await sb.from("profiles").select("review_url").eq("id", userId).maybeSingle();
  const head = prof?.review_url ? "" : "No Google review link is saved yet (the agent sets it in Marketing > Reviews), so closings are not adding requests.\n";
  if (!data.length) return `${head}No review requests${a.status ? ` with status ${a.status}` : ""}.`;
  return `${head}${data.length} review request${data.length === 1 ? "" : "s"}:\n${data.map((r) => `- ${reviewLine(r)}${r.contact?.do_not_contact ? " | DO NOT CONTACT" : ""}`).join("\n")}`;
}

// The wording for one request, ready for the AGENT to text or email. Nothing is sent.
async function reviewRequestMessage(sb, userId, a) {
  const r = await loadReview(sb, userId, a.review_id);
  const { data: prof } = await sb.from("profiles").select("full_name, review_url, review_message").eq("id", userId).maybeSingle();
  if (!prof?.review_url) throw bad("No Google review link is saved yet. The agent adds it in Marketing > Reviews.");
  if (r.contact?.do_not_contact) throw bad(`${cname(r.contact)} is marked do not contact. Don't ask them.`);
  const message = reviewMessage({ template: prof.review_message, contact: r.contact, agent: prof, link: prof.review_url });
  const how = [r.contact?.phone && `Phone: ${r.contact.phone}`, r.contact?.email && `Email: ${r.contact.email}`].filter(Boolean).join("\n");
  return `Review request for ${cname(r.contact)} (nothing was sent; the agent sends it themselves):\n\n${message}${how ? `\n\n${how}` : ""}`;
}

async function addToReviewList(sb, userId, a) {
  return change("add_to_review_list", sb, userId, async () => {
    const contactId = id(a.contact_id, "contact");
    const { data: c } = await sb.from("contacts").select("id, first_name, last_name, company, do_not_contact").eq("id", contactId).eq("owner_id", userId).maybeSingle();
    if (!c) throw new HttpError(404, "No contact with that id in your Contacts.");
    if (c.do_not_contact) throw bad(`${cname(c)} is marked do not contact.`);
    const row = { contact_id: c.id, person_id: a.deal_id ? id(a.deal_id, "deal") : null };
    const { data, error } = await sb.from("contact_reviews").insert(row).select("id").single();
    if (error) throw new HttpError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "That deal is already on the review list." : error.message);
    return { text: `Added ${cname(c)} to the review list (review id ${data.id}). Use review_request_message to get the wording; the agent sends it.`, audit: `review ${data.id} added` };
  });
}

async function updateReviewStatus(sb, userId, a) {
  return change("update_review_status", sb, userId, async () => {
    const r = await loadReview(sb, userId, a.review_id);
    if (!REVIEW_STATUSES.includes(a.status)) throw bad("status must be asked, skipped or to_ask.");
    if (r.status === "received") throw bad("That one already got a review.");
    const patch = { status: a.status, ...(a.status === "asked" ? { asked_at: new Date().toISOString() } : {}) };
    const { error } = await sb.from("contact_reviews").update(patch).eq("id", r.id);
    if (error) throw new HttpError(500, error.message);
    if (a.status === "asked") await sb.from("contact_notes").insert({ contact_id: r.contact_id, kind: "other", body: "Asked for a Google review." });
    return { text: `${cname(r.contact)}: ${STATUS_TEXT[a.status]}.${a.status === "asked" ? " Only mark someone asked once the agent has actually sent the request." : ""}`, audit: `review ${r.id} ${a.status}` };
  });
}

async function recordReview(sb, userId, a) {
  return change("record_review", sb, userId, async () => {
    const r = await loadReview(sb, userId, a.review_id);
    const rating = Number(a.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw bad("rating must be a whole number from 1 to 5.");
    const body = String(a.text || "").trim().slice(0, 3000);
    const reviewer = String(a.reviewer || "").trim().slice(0, 120) || bylineOf(cname(r.contact));
    const { error } = await sb.from("contact_reviews").update({ status: "received", received_at: new Date().toISOString(), rating, body, reviewer }).eq("id", r.id);
    if (error) throw new HttpError(500, error.message);
    await sb.from("contact_notes").insert({ contact_id: r.contact_id, kind: "other", body: "Left a review." });
    return { text: `Recorded a ${rating}-star review from ${cname(r.contact)} (signed "${reviewer}"). add_review_to_website puts it on the agent's website.`, audit: `review ${r.id} recorded` };
  });
}

async function addReviewToWebsite(sb, userId, a) {
  return change("add_review_to_website", sb, userId, async () => {
    const r = await loadReview(sb, userId, a.review_id);
    if (r.status !== "received" || !r.body) throw bad("Only a review that came in with its words can go on the website.");
    if (r.testimonial_id) throw bad("That review is already on the website.");
    const { data: site } = await sb.from("agent_sites").select("id").eq("agent_id", userId).maybeSingle();
    if (!site) throw bad("The agent has no website set up yet.");
    const { data: t, error } = await sb.from("agent_site_testimonials").insert({ agent_site_id: site.id, quote: testimonialHtml(r.body), author: r.reviewer || bylineOf(cname(r.contact)) || "A client", sort_order: 1000 }).select("id").single();
    if (error) throw new HttpError(500, error.message);
    await sb.from("contact_reviews").update({ testimonial_id: t.id }).eq("id", r.id);
    return { text: `Added ${cname(r.contact)}'s review to the website's testimonials, signed "${r.reviewer || bylineOf(cname(r.contact))}".`, audit: `review ${r.id} on website` };
  });
}

// ------------------------------------------------------------------------------------------------------ CMAs

const loadCma = (sb, userId, cmaId) => loadCmaOp(sb, userId, cmaId);

async function listCmas(sb, userId) {
  const { data, error } = await sb.from("cmas").select("id, title, subject, comps, price_low, price_high, suggested_price, listing_id, attach, shared_at, updated_at").eq("owner_id", userId).order("updated_at", { ascending: false }).limit(40);
  if (error) throw new HttpError(500, error.message);
  if (!data.length) return "No CMAs yet.";
  return `${data.length} CMA${data.length === 1 ? "" : "s"}, newest first:\n${data
    .map((c) => {
      const m = computeCma(c);
      return `- ${cmaName(c)} | ${m.suggested != null ? `suggested ${money(m.suggested)} (${money(m.low)} to ${money(m.high)})` : "no price yet"} | ${c.comps?.length || 0} comps${c.listing_id ? " | attached to a listing" : ""}${c.shared_at ? " | shared with the client" : ""} | id ${c.id}`;
    })
    .join("\n")}`;
}

async function getCma(sb, userId, a) {
  const c = await loadCma(sb, userId, a.id);
  const m = computeCma(c);
  const lines = [`${cmaName(c)} (id ${c.id})${c.title && subjectAddress(c.subject) ? ` — ${c.title}` : ""}`];
  if (factsLine(c.subject)) lines.push(`Home: ${factsLine(c.subject)}`);
  lines.push(m.suggested != null ? `Price opinion: suggested ${money(m.suggested)}, range ${money(m.low)} to ${money(m.high)}${m.overridden ? " (the agent set some numbers themselves)" : ""}; built from ${m.basisCount} ${m.basisKind} home${m.basisCount === 1 ? "" : "s"}.` : "No price opinion yet (needs sold homes with prices).");
  const comps = (c.comps || []).filter((x) => x.include !== false);
  if (comps.length) {
    lines.push(`Comparable homes (${comps.length}):`);
    for (const x of comps.slice(0, 25)) lines.push(`- ${x.status}: ${x.address || "no address"} ${money(toNumber(x.price))}${x.status !== "active" && adjustedPrice(x) != null && adjustedPrice(x) !== toNumber(x.price) ? ` (adjusted ${money(adjustedPrice(x))})` : ""}`);
  }
  if (hasNetSheet(c.net_sheet)) {
    const rows = netScenarios(c.net_sheet, m);
    lines.push(`Seller net sheet (${c.net_sheet.show ? "shown on the client page" : "not shown on the client page"}):`);
    if (!rows.length) lines.push("- (no prices to work out yet)");
    for (const r of rows) lines.push(`- ${r.label} ${money(r.price)}: costs ${money(r.costs)}, loan payoff ${money(r.payoff)}, seller walks away with ${money(r.net)}`);
  } else lines.push("Seller net sheet: not started.");
  if (c.listing_id) {
    const { data: listing } = await sb.from("listings").select("address_line1, price, status").eq("id", c.listing_id).maybeSingle();
    const snap = c.attach || {};
    lines.push(`Attached to listing ${listing?.address_line1 || c.listing_id} (frozen ${day(snap.at)}): CMA said ${money(snap.suggested)}, listed at ${money(snap.list_price)}, list price now ${money(toNumber(listing?.price))}, sold for ${money(snap.sold_price)}.`);
    for (const r of compareAttached(snap, listing?.price)) lines.push(`  ${r.label}: ${diffText(r.diff)}`);
  }
  const p = presentationDefaults(c.presentation);
  lines.push(`Listing presentation: look ${p.theme}, ${p.plan.filter((i) => i.on !== false).length} marketing steps, ${p.intro ? "has a note to the sellers" : "no note yet"}, ${p.about ? "has an about-me" : "no about-me yet"}, net sheet ${p.include_net ? "included" : "left out"}. The agent downloads the PDF from the CMA page.`);
  if (c.shared_at) lines.push(`Shared with the client; seen ${c.view_count || 0} time${c.view_count === 1 ? "" : "s"}.`);
  return lines.join("\n");
}

async function updateCmaNetSheet(sb, userId, a) {
  return change("update_cma_net_sheet", sb, userId, async () => {
    const c = await saveNetSheet(sb, userId, a.id, a);
    const rows = netScenarios(c.net_sheet, computeCma(c));
    const summary = rows.map((r) => `${r.label} ${money(r.price)} → seller walks away with ${money(r.net)}`).join("; ");
    return { text: `Net sheet saved for ${cmaName(c)}. ${summary || "No prices to work out yet."}${c.net_sheet.show ? " It is shown on the client page." : " It is not shown on the client page (turn that on with show: true)."}`, audit: `cma ${c.id} net sheet` };
  });
}

async function updateCmaPresentation(sb, userId, a) {
  return change("update_cma_presentation", sb, userId, async () => {
    const c = await savePresentation(sb, userId, a.id, a);
    return { text: `Listing presentation saved for ${cmaName(c)}: look ${c.presentation.theme}, ${c.presentation.plan.filter((i) => i.on).length} marketing steps. The agent downloads the PDF from the CMA page.`, audit: `cma ${c.id} presentation` };
  });
}

async function attachCma(sb, userId, a) {
  return change("attach_cma_to_listing", sb, userId, async () => {
    const { cma, listing } = await attachOp(sb, userId, a.id, a.listing_id);
    return { text: `Attached ${cmaName(cma)} to ${listing.address_line1}, frozen today: CMA says ${money(cma.attach.suggested)}, listed at ${money(cma.attach.list_price)}.`, audit: `cma ${cma.id} attached` };
  });
}

async function detachCma(sb, userId, a) {
  return change("detach_cma", sb, userId, async () => {
    const c = await detachOp(sb, userId, a.id);
    return { text: `${cmaName(c)} is no longer attached to a listing.`, audit: `cma ${c.id} detached` };
  });
}

async function setCmaSoldPrice(sb, userId, a) {
  return change("set_cma_sold_price", sb, userId, async () => {
    const c = await setSoldPrice(sb, userId, a.id, a.sold_price);
    const sold = c.attach?.sold_price ?? null;
    const rows = compareAttached(c.attach, null).filter((r) => r.label.startsWith("Sold"));
    return { text: `${sold == null ? "Cleared the sold price" : `Sold price ${money(sold)} saved`} on ${cmaName(c)}.${rows.length ? ` ${rows.map((r) => `${r.label}: ${diffText(r.diff)}`).join("; ")}.` : ""}`, audit: `cma ${c.id} sold price` };
  });
}

// -------------------------------------------------------------------------------------------------------- tools

const NET_FIELDS = {
  id: str("CMA id from list_cmas"),
  payoff: str("The seller's loan payoff, in dollars"),
  listing_pct: str("The listing agent's commission, as a percent (3 = 3%)"),
  buyer_pct: str("The buyer's agent commission, as a percent"),
  concessions: str("Seller concessions, in dollars"),
  title_fee: str("Title, escrow and closing fees, in dollars"),
  stamps_pct: str("Documentary stamp tax as a percent (Oklahoma is 0.15)"),
  taxes: str("Property taxes owed at closing, in dollars"),
  warranty: str("Home warranty, in dollars"),
  repairs: str("Repairs and prep, in dollars"),
  other_costs: { type: "array", items: { type: "object", properties: { label: str("What it is"), amount: str("Dollars") }, required: ["label", "amount"], additionalProperties: false }, description: "Other costs (up to 8); replaces the list" },
  extra_prices: { type: "array", items: { type: "string" }, description: "Up to 3 more sale prices to work out besides the CMA's low, suggested and high; replaces the list" },
  show: bool("true shows the net sheet on the client page (it includes the seller's loan payoff, so only when the agent wants that)"),
};

export const REVIEW_CMA_TOOLS = [
  {
    name: "list_reviews", title: "List review requests", scope: "read", annotations: READ, run: listReviews,
    description: "The agent's review requests (asking clients for a Google review after a closing): who is still to ask, who was asked, who left a review. Closings add people to the list automatically once the agent saved their Google review link.",
    inputSchema: obj({ status: { type: "string", enum: ["to_ask", "asked", "received", "skipped"], description: "Only this status" } }),
  },
  {
    name: "review_request_message", title: "Get the review request wording", scope: "read", annotations: READ, run: reviewRequestMessage,
    description: "The ready-to-send review request for one person, with their name and the agent's Google review link filled in. NOTHING is sent: show it to the agent, who texts or emails it themselves.",
    inputSchema: obj({ review_id: str("Review id from list_reviews") }, ["review_id"]),
  },
  {
    name: "add_to_review_list", title: "Add someone to the review list", scope: "write_tasks", annotations: WRITES, run: addToReviewList,
    description: "Put a contact on the review list (a past client the agent wants to ask). Pass deal_id to tie it to a closed deal. Refuses a do-not-contact contact.",
    inputSchema: obj({ contact_id: str("Contact id from find_contact"), deal_id: str("Optional: the closed deal's person id") }, ["contact_id"]),
  },
  {
    name: "update_review_status", title: "Mark a review request asked or skipped", scope: "write_tasks", annotations: WRITES, run: updateReviewStatus,
    description: "Mark a request asked (ONLY after the agent says they sent it; this does not send anything), skipped, or back to to_ask. Marking asked leaves a note on the contact.",
    inputSchema: obj({ review_id: str("Review id from list_reviews"), status: { type: "string", enum: REVIEW_STATUSES } }, ["review_id", "status"]),
  },
  {
    name: "record_review", title: "Record a review someone left", scope: "write_tasks", annotations: WRITES, run: recordReview,
    description: "Save a review a client left (what the agent tells you or pastes): stars, their words and how to sign it. Then add_review_to_website can show it on the agent's site.",
    inputSchema: obj({ review_id: str("Review id from list_reviews"), rating: int("1 to 5 stars"), text: str("Their words, exactly as written"), reviewer: str("How to sign it, e.g. Sam R. (default: first name and last initial)") }, ["review_id", "rating"]),
  },
  {
    name: "add_review_to_website", title: "Put a review on the website", scope: "write_tasks", annotations: WRITES, run: addReviewToWebsite,
    description: "Add a received review to the agent's website as a testimonial. Public: ask the agent first.",
    inputSchema: obj({ review_id: str("Review id from list_reviews") }, ["review_id"]),
  },
  {
    name: "list_cmas", title: "List CMAs", scope: "read", annotations: READ, run: listCmas,
    description: "The agent's comparative market analyses, newest first, with the price opinion, number of comps and whether one is attached to a listing.",
    inputSchema: obj({}),
  },
  {
    name: "get_cma", title: "Get a CMA", scope: "read", annotations: READ, run: getCma,
    description: "One CMA in full: the price opinion, comparable homes, the seller net sheet worked out at each price, how an attached listing compares (list price and sold price against the CMA) and the listing presentation settings.",
    inputSchema: obj({ id: str("CMA id from list_cmas") }, ["id"]),
  },
  {
    name: "update_cma_net_sheet", title: "Set a CMA's seller net sheet", scope: "write_people", annotations: WRITES, run: updateCmaNetSheet,
    description: "Fill in or change the seller net sheet on a CMA (what the seller walks away with after commissions, fees and their loan payoff). Only the fields you send change. Returns what the seller nets at each price.",
    inputSchema: obj(NET_FIELDS, ["id"]),
  },
  {
    name: "update_cma_presentation", title: "Set a CMA's listing presentation", scope: "write_people", annotations: WRITES, run: updateCmaPresentation,
    description: "Write the words around a CMA for a listing appointment: a note to the sellers, an about-me, the marketing plan steps and the look of the PDF. Only what you send changes. The agent downloads the PDF from the CMA page.",
    inputSchema: obj({
      id: str("CMA id from list_cmas"), intro: str("A note to the sellers"), about: str("About the agent"), include_net: bool("Include the net sheet in the presentation"),
      theme: str(`The PDF look: "site" (match the agent's website) or ${GUIDE_THEME_KEYS.join(", ")}`),
      marketing_plan: { type: "array", items: { type: "object", properties: { title: str("The step"), detail: str("A sentence about it"), on: bool("false leaves it out") }, required: ["title"], additionalProperties: false }, description: `The whole marketing plan (up to ${MAX_PLAN_ITEMS} steps); replaces the list` },
    }, ["id"]),
  },
  {
    name: "attach_cma_to_listing", title: "Attach a CMA to a listing", scope: "write_people", annotations: WRITES, run: attachCma,
    description: "Tie a CMA to one of the agent's listings. What the CMA said and the listing's price are frozen today so the agent can compare them later with the price now and the sold price.",
    inputSchema: obj({ id: str("CMA id from list_cmas"), listing_id: str("Listing id from list_listings") }, ["id", "listing_id"]),
  },
  {
    name: "detach_cma", title: "Detach a CMA from its listing", scope: "write_people", annotations: WRITES, run: detachCma,
    description: "Remove a CMA's link to a listing (and its frozen numbers).",
    inputSchema: obj({ id: str("CMA id from list_cmas") }, ["id"]),
  },
  {
    name: "set_cma_sold_price", title: "Record what an attached CMA's home sold for", scope: "write_people", annotations: WRITES, run: setCmaSoldPrice,
    description: "Enter (or clear, with null) the price the home finally sold for on an attached CMA, so it can be compared with the CMA's suggested price and the last list price.",
    inputSchema: obj({ id: str("CMA id from list_cmas"), sold_price: { type: ["number", "null"], description: "Sold price in dollars, or null to clear" } }, ["id", "sold_price"]),
  },
];
