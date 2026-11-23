// AI connection tools for seeing the agent's Contacts as GROUPS, and for gift drop-off lists (api/mcp.js). Until now an AI could only search contacts by a typed
// name (find_contact); it could not list them, see tags, or open a saved smart list. Same rules as the other tools: they run as the agent, are validated, logged and
// rate limited, delete nothing and SEND nothing. A drop-off list is only a private link for the agent to hand to whoever is delivering.
//   see (scope read):   contact_groups, list_contacts, list_smart_lists, list_households, list_drop_off_lists, get_drop_off_list
//   change (write_tasks): create_drop_off_list, set_drop_off_list_active
import { bad } from "./bots/util.js";
import { WRITES, bool, change, ctxFor, int, obj, str } from "./mcpWriteTools.js";
import { cname, contactsOn } from "./mcpTaskTools.js";
import { applyFilters, EMPTY_FILTERS, relationshipLabel, sortContacts, touchDue } from "../../src/lib/contacts.js";
import { loadContactBook, describeFilters } from "./contactBook.js";
import { mapAddress } from "../../src/lib/directions.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";
import * as drop from "./dropOff.js";

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const RELATIONSHIPS = ["client", "past_client", "lead", "sphere", "referral_partner", "vendor", "agent", "lender", "other"];
const BOARDS = ["lead", "pipeline", "transaction", "none"];
const when = (iso) => (iso ? String(iso).slice(0, 10) : "");

const readCtx = async (sb, userId) => {
  const ctx = ctxFor(sb, userId, "AI connection");
  await contactsOn(ctx);
};

// Finds a saved smart list by id or by name (case-insensitive; a unique partial name works too).
function pickList(book, ref) {
  const r = String(ref || "").trim();
  if (!r) return null;
  const exact = book.lists.find((l) => l.id === r || l.name.toLowerCase() === r.toLowerCase());
  if (exact) return exact;
  const partial = book.lists.filter((l) => l.name.toLowerCase().includes(r.toLowerCase()));
  if (partial.length === 1) return partial[0];
  throw bad(`${partial.length > 1 ? `More than one smart list matches "${r}"` : `No smart list called "${r}"`}. Use list_smart_lists for the exact names.`);
}
function tagIds(book, names) {
  const ids = [];
  for (const n of names) {
    const t = book.tags.find((x) => x.name.toLowerCase() === String(n).trim().toLowerCase());
    if (!t) throw bad(`No tag called "${n}". Use contact_groups to see the tags.`);
    ids.push(t.id);
  }
  return ids;
}

/** The contacts a request selects, in the dashboard's order, from the filters given (or a saved smart list's own). */
function select(book, a) {
  let f = { ...EMPTY_FILTERS };
  const list = pickList(book, a.smart_list);
  if (list) f = { ...f, ...list.filters, tags: [...(list.filters?.tags || [])] };
  if (a.query !== undefined) f.q = String(a.query).slice(0, 80);
  if (a.relationship) {
    if (!RELATIONSHIPS.includes(a.relationship)) throw bad(`relationship must be one of: ${RELATIONSHIPS.join(", ")}.`);
    f.relationship = a.relationship;
  }
  if (Array.isArray(a.tags) && a.tags.length) f.tags = tagIds(book, a.tags);
  if (a.board) {
    if (!BOARDS.includes(a.board)) throw bad(`board must be one of: ${BOARDS.join(", ")}.`);
    f.board = a.board;
  }
  if (a.not_contacted_days !== undefined) f.contacted = a.not_contacted_days === 0 ? "never" : String(Math.max(1, Math.min(3650, Math.round(Number(a.not_contacted_days)) || 1)));
  if (a.touch_due === true) f.touch = true;
  if (a.archived === true) f.archived = true;
  let rows = applyFilters(book.contacts, f, book.ctx);
  // "match all tags" narrows the dashboard's any-of tag filter.
  if (a.match_all_tags === true && f.tags.length > 1) rows = rows.filter((c) => f.tags.every((t) => (book.ctx.tagsByContact.get(c.id) || []).includes(t)));
  if (a.has_address === true) rows = rows.filter((c) => mapAddress(c));
  if (a.has_address === false) rows = rows.filter((c) => !mapAddress(c));
  if (a.city) rows = rows.filter((c) => String(c.city || c.address_line1 || "").toLowerCase().includes(String(a.city).toLowerCase()));
  if (a.in_household === true) rows = rows.filter((c) => c.household_id);
  rows = sortContacts(rows, a.sort_by === "recent" ? "recent" : "name", book.ctx);
  return { rows, filters: f, list };
}

const line = (c, book) => {
  const tags = (book.ctx.tagsByContact.get(c.id) || []).map((id) => book.tagById.get(id)?.name).filter(Boolean);
  const place = [c.city, c.state].filter(Boolean).join(", ") || (mapAddress(c) ? "address on file" : "");
  return `${cname(c)}${c.company && (c.first_name || c.last_name) ? ` (${c.company})` : ""} | ${relationshipLabel(c.relationship)}${c.email ? ` | ${c.email}` : ""}${c.phone ? ` | ${c.phone}` : ""}${place ? ` | ${place}` : ""}${tags.length ? ` | tags: ${tags.join(", ")}` : ""}${c.do_not_contact ? " | DO NOT CONTACT" : ""} | id ${c.id}`;
};

// -------------------------------------------------------------------------------------------------- seeing groups

async function contactGroups(sb, userId) {
  await readCtx(sb, userId);
  const book = await loadContactBook(sb, userId);
  const active = book.contacts.filter((c) => !c.archived);
  const lines = [`Contacts: ${active.length.toLocaleString()} active, ${(book.contacts.length - active.length).toLocaleString()} archived.`];

  const rel = new Map();
  for (const c of active) rel.set(c.relationship, (rel.get(c.relationship) || 0) + 1);
  lines.push("", "Relationships:", ...RELATIONSHIPS.filter((r) => rel.get(r)).map((r) => `- ${relationshipLabel(r)} (${r}): ${rel.get(r)}`));

  const tagCount = new Map();
  for (const c of active) for (const t of book.ctx.tagsByContact.get(c.id) || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  lines.push("", `Tags (${book.tags.length}):`, ...(book.tags.length ? book.tags.map((t) => `- ${t.name}: ${tagCount.get(t.id) || 0}`) : ["- none yet"]));

  lines.push("", `Saved smart lists (${book.lists.length}), each a saved filter:`);
  if (!book.lists.length) lines.push("- none saved");
  for (const l of book.lists) lines.push(`- ${l.name}: ${select(book, { smart_list: l.id }).rows.length} people (${describeFilters(l.filters || {}, book.tagById)})`);

  const inHouse = active.filter((c) => c.household_id).length;
  lines.push("", `Households: ${book.households.length} (${inHouse} people in one).`);

  const onBoard = (g) => active.filter((c) => book.ctx.boardsByContact.get(c.id)?.has(g)).length;
  lines.push(`On the boards: Leads ${onBoard("lead")}, Pipeline ${onBoard("pipeline")}, Deals ${onBoard("transaction")}.`);
  lines.push(`Due for a touch: ${active.filter((c) => touchDue(c)).length}. With an address: ${active.filter((c) => mapAddress(c)).length}.`);
  lines.push("", "Use list_contacts (smart_list, tags, relationship, board…) to see the people in any group.");
  return lines.join("\n");
}

async function listContacts(sb, userId, a) {
  await readCtx(sb, userId);
  const book = await loadContactBook(sb, userId);
  const { rows, filters, list } = select(book, a);
  const limit = Math.max(1, Math.min(Number(a.limit) || 50, 100));
  const offset = Math.max(0, Number(a.offset) || 0);
  const page = rows.slice(offset, offset + limit);
  const head = `${rows.length.toLocaleString()} contact${rows.length === 1 ? "" : "s"}${list ? ` in the smart list "${list.name}"` : ""} (${describeFilters(filters, book.tagById)})${rows.length > limit ? `; showing ${offset + 1}–${offset + page.length}` : ""}:`;
  if (!rows.length) return `${head}\nNo one matches.`;
  const more = offset + page.length < rows.length ? `\n…${rows.length - offset - page.length} more. Call again with offset ${offset + page.length}.` : "";
  return `${head}\n${page.map((c) => `- ${line(c, book)}`).join("\n")}${more}`;
}

async function listSmartLists(sb, userId) {
  await readCtx(sb, userId);
  const book = await loadContactBook(sb, userId);
  if (!book.lists.length) return "No smart lists are saved yet. (They are saved filters on the Contacts page: Save this view as a smart list.)";
  return `${book.lists.length} saved smart list${book.lists.length === 1 ? "" : "s"} (pass the name as smart_list to list_contacts):\n${book.lists.map((l) => `- ${l.name} | ${select(book, { smart_list: l.id }).rows.length} people | ${describeFilters(l.filters || {}, book.tagById)} | id ${l.id}`).join("\n")}`;
}

async function listHouseholds(sb, userId, a) {
  await readCtx(sb, userId);
  const book = await loadContactBook(sb, userId);
  const members = new Map();
  for (const c of book.contacts) if (c.household_id && !c.archived) members.set(c.household_id, [...(members.get(c.household_id) || []), c]);
  const rows = book.households.filter((h) => members.get(h.id)?.length).map((h) => ({ h, m: members.get(h.id) }));
  const term = String(a.query || "").toLowerCase().trim();
  const shown = (term ? rows.filter(({ h, m }) => `${h.name} ${m.map(cname).join(" ")}`.toLowerCase().includes(term)) : rows).slice(0, Math.min(Number(a.limit) || 40, 100));
  if (!shown.length) return "No households.";
  return `${rows.length} household${rows.length === 1 ? "" : "s"}${term ? `; ${shown.length} match` : ""} (people who share one history):\n${shown.map(({ h, m }) => `- ${h.name || m.map((c) => c.first_name || cname(c)).join(" & ")}: ${m.map((c) => `${cname(c)} (id ${c.id})`).join("; ")}`).join("\n")}`;
}

// -------------------------------------------------------------------------------------------- drop-off lists

const statusText = { open: "open", off: "turned off", expired: "expired" };
const dropLine = (l) => `${l.title || "Gift drop-offs"} | ${l.done} of ${l.total} delivered | ${statusText[l.status]}${l.status === "open" ? ` until ${when(l.expires_at)}` : ""} | ${l.view_count ? `opened ${l.view_count}×` : "not opened yet"} | made ${when(l.created_at)} | id ${l.id}`;

async function listDropOffLists(sb, userId) {
  const ctx = ctxFor(sb, userId, "AI connection");
  const lists = await drop.listLists(ctx.admin, userId);
  if (!lists.length) return "No drop-off lists yet. Use create_drop_off_list.";
  return `${lists.length} drop-off list${lists.length === 1 ? "" : "s"}, newest first:\n${lists.map((l) => `- ${dropLine(l)}`).join("\n")}`;
}

async function getDropOffList(sb, userId, a) {
  const ctx = ctxFor(sb, userId, "AI connection");
  const l = await drop.getList(ctx.admin, userId, a.id);
  const out = [dropLine(l)];
  if (l.note) out.push(`Instructions for the helper: ${l.note}`);
  if (l.status === "open") out.push(`Link for the helper: ${drop.dropOffLink(SITE_ORIGIN, l.token)}`);
  out.push("Stops:", ...l.stops.map((s) => `${s.position}. ${s.done_at ? "✓ delivered" : "○ to do"} | ${s.name} | ${s.address}${s.note ? ` | note: ${s.note}` : ""}${s.done_at ? ` | ${when(s.done_at)}` : ""}`));
  return out.join("\n");
}

async function createDropOffList(sb, userId, a) {
  return change("create_drop_off_list", sb, userId, async (ctx) => {
    await contactsOn(ctx);
    let ids = Array.isArray(a.contact_ids) ? a.contact_ids : [];
    let source = "";
    if (a.smart_list || (Array.isArray(a.tags) && a.tags.length)) {
      const book = await loadContactBook(sb, userId);
      const sel = select(book, { smart_list: a.smart_list, tags: a.tags, match_all_tags: a.match_all_tags });
      ids = [...new Set([...ids, ...sel.rows.filter((c) => !c.do_not_contact).map((c) => c.id)])];
      source = a.smart_list ? ` from the smart list "${sel.list?.name}"` : ` tagged ${a.tags.join(", ")}`;
    }
    if (!ids.length) throw bad("Give contact_ids, or a smart_list or tags to pick the people from.");
    const { rows, leftOut } = await drop.prepareStops(ctx.admin, userId, ids, { keepOrder: a.keep_order === true });
    if (!rows.length) throw bad(`None of those ${ids.length} people has an address on file, so there is nothing to deliver to.`);
    const made = await drop.createList(ctx.admin, userId, { title: a.title || "Gift drop-offs", note: a.note, days: a.days, stops: rows });
    const link = drop.dropOffLink(SITE_ORIGIN, made.token);
    const thin = rows.filter((r) => r.thin);
    const out = [
      `Made the drop-off list "${a.title || "Gift drop-offs"}"${source} with ${made.stops} stop${made.stops === 1 ? "" : "s"}${a.keep_order === true ? " in the order given" : ", nearby addresses together"}. The link works for ${made.days} days and shows only names, addresses and notes (no phone numbers):`,
      link,
      "Nothing was sent. Give the link to whoever is making the deliveries; they tap a stop for directions and tick it off when delivered.",
    ];
    if (leftOut.length) out.push(`Left out (no address on file): ${leftOut.join(", ")}.`);
    if (thin.length) out.push(`These addresses look incomplete (no city or zip), so a map may guess wrong; update the contact and make the list again if it matters: ${thin.map((r) => `${r.name} (${r.address})`).join("; ")}.`);
    return { text: out.join("\n"), audit: `drop-off list ${made.id} made with ${made.stops} stops` };
  });
}

async function setDropOffListActive(sb, userId, a) {
  return change("set_drop_off_list_active", sb, userId, async (ctx) => {
    if (typeof a.active !== "boolean") throw bad("active must be true (turn the link on) or false (turn it off).");
    const l = await drop.setActive(ctx.admin, userId, a.id, a.active, a.days);
    return { text: a.active ? `The link for "${l.title || "Gift drop-offs"}" is on again until ${when(l.expires_at)}.` : `The link for "${l.title || "Gift drop-offs"}" is turned off. Anyone who opens it now sees that it isn't available.`, audit: `drop-off list ${l.id} ${a.active ? "on" : "off"}` };
  });
}

// ------------------------------------------------------------------------------------------------- the tools

const FILTERS = {
  smart_list: str("A saved smart list's name or id (see list_smart_lists), such as \"Past Clients\""),
  tags: { type: "array", items: { type: "string" }, description: "Tag names; people with any of them (or all, with match_all_tags)" },
  match_all_tags: bool("With several tags, require every one instead of any"),
  relationship: { type: "string", enum: RELATIONSHIPS },
  board: { type: "string", enum: BOARDS, description: "lead / pipeline / transaction = on that board; none = on no board" },
  not_contacted_days: int("Not in touch for at least this many days (0 = never contacted)"),
  touch_due: bool("Only people due for a keep-in-touch reminder"),
  has_address: bool("true = has an address on file, false = none"),
  city: str("Part of the city or address to match"),
  in_household: bool("true = only people in a household"),
};

export const LIST_TOOLS = [
  {
    name: "contact_groups", title: "Contact groups overview", scope: "read", annotations: READ, run: contactGroups,
    description: "START HERE to see how the agent's Contacts are grouped: counts by relationship, every tag with how many people have it, every saved smart list (their saved filtered lists, with how many people are in each), households, who is on the Leads/Pipeline/Deals boards, and who is due for a touch. Then use list_contacts to see the people in any group.",
    inputSchema: obj({}),
  },
  {
    name: "list_contacts", title: "List contacts", scope: "read", annotations: READ, run: listContacts,
    description: "List the agent's contacts (not just search): everyone, or filtered by a saved smart list, tags, relationship, board, how long since contact, address or city. Gives name, relationship, email, phone, city and tags for each, plus the id for get_contact. Pages of up to 100; use offset for more.",
    inputSchema: obj({ ...FILTERS, query: str("Optional words to match in the name, email, phone, company or address"), archived: bool("true = archived contacts instead"), sort_by: { type: "string", enum: ["name", "recent"] }, limit: int("Page size (default 50, up to 100)"), offset: int("Skip this many (for the next page)") }),
  },
  {
    name: "list_smart_lists", title: "List saved smart lists", scope: "read", annotations: READ, run: listSmartLists,
    description: "The agent's saved smart lists on the Contacts page (saved filters such as Past Clients, SOI, or everyone with a tag), each with how many people it holds and what it selects. Pass a name as smart_list to list_contacts to see the people.",
    inputSchema: obj({}),
  },
  {
    name: "list_households", title: "List households", scope: "read", annotations: READ, run: listHouseholds,
    description: "Households: couples or families linked so they share one history. Each with its members and their contact ids.",
    inputSchema: obj({ query: str("Optional name to look for"), limit: int("Up to 100 (default 40)") }),
  },
  {
    name: "list_drop_off_lists", title: "List gift drop-off lists", scope: "read", annotations: READ, run: listDropOffLists,
    description: "The agent's gift drop-off lists (private links for a helper delivering gifts): each with how many stops are delivered, whether the link is open, and whether the helper has opened it.",
    inputSchema: obj({}),
  },
  {
    name: "get_drop_off_list", title: "Get a gift drop-off list", scope: "read", annotations: READ, run: getDropOffList,
    description: "One drop-off list: the link for the helper, instructions, and every stop with its address, note and whether it is delivered.",
    inputSchema: obj({ id: str("List id from list_drop_off_lists") }, ["id"]),
  },
  {
    name: "create_drop_off_list", title: "Make a gift drop-off list", scope: "write_tasks", annotations: WRITES, run: createDropOffList,
    description: "Make a private drop-off link for a helper who delivers gifts: pick people by contact_ids, a saved smart_list, or tags. Each stop is a name and address only (no phone numbers), nearby addresses grouped by zip unless keep_order is true. People with no address are left out and thin addresses are flagged. Nothing is sent; the agent gives the link to the helper.",
    inputSchema: obj({ contact_ids: { type: "array", items: { type: "string" }, description: "Contact ids (from list_contacts or find_contact), in the order you want if keep_order is true" }, smart_list: str("Or: every person in this saved smart list"), tags: { type: "array", items: { type: "string" }, description: "Or: everyone with these tags" }, match_all_tags: bool("With several tags, require every one"), title: str("A title for the list, such as \"Thanksgiving pies\""), note: str("Instructions for the helper, such as \"Leave on the porch\""), days: int("How many days the link stays open (default 30, up to 180)"), keep_order: bool("true = keep the order of contact_ids instead of grouping by zip") }),
  },
  {
    name: "set_drop_off_list_active", title: "Turn a drop-off link on or off", scope: "write_tasks", annotations: WRITES, run: setDropOffListActive,
    description: "Turn a drop-off list's link off (the helper can no longer open it) or back on for more days.",
    inputSchema: obj({ id: str("List id from list_drop_off_lists"), active: bool("true = on, false = off"), days: int("When turning on: days to stay open (default 30)") }, ["id", "active"]),
  },
];
