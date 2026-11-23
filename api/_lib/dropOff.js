// Gift drop-off lists (supabase/drop-off-lists.sql), for the places that act for the agent with the service key: the AI connection
// (api/_lib/mcpListTools.js) and the Mac app (api/mac-app.js). The dashboard makes its lists through the create_drop_off_list function instead;
// this does the same work (same limits, same token shape: "do" + 64 hex, kept as a hash for the public page and in full for the agent's own copy).
// `db` is the service client, so every query here is filtered by `owner`. A stop is only a name, an address and a note; nothing else about a
// contact ever goes on a list.
import crypto from "node:crypto";
import { HttpError, bad, isUuid } from "./bots/util.js";
import { addressIsThin, mapAddress, sortForRoute } from "../../src/lib/directions.js";

export const MAX_STOPS = 150;
const MAX_ACTIVE = 50;
const cname = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "(no name)";
const clip = (v, n) => String(v ?? "").trim().slice(0, n);

export const dropOffLink = (origin, token) => `${String(origin).replace(/\/+$/, "")}/dropoff/${token}`;

/** Contacts -> stop rows (name, address as a map would search for it, whether it looks too thin to find), nearby ones together. */
export async function prepareStops(db, owner, contactIds, { keepOrder = false } = {}) {
  const ids = [...new Set(contactIds || [])];
  if (!ids.length) throw bad("Pick at least one contact.");
  if (ids.length > MAX_STOPS) throw bad(`A list can have up to ${MAX_STOPS} stops.`);
  if (!ids.every(isUuid)) throw bad("Those contact ids aren't valid. Use list_contacts or find_contact to get them.");
  const { data, error } = await db.from("contacts").select("id, first_name, last_name, company, address_line1, city, state, zip").eq("owner_id", owner).in("id", ids);
  if (error) throw new HttpError(500, error.message);
  const byId = new Map((data || []).map((c) => [c.id, c]));
  const missing = ids.filter((i) => !byId.has(i));
  if (missing.length) throw new HttpError(404, `${missing.length} of those aren't contacts of yours.`);
  let rows = [];
  const leftOut = [];
  for (const id of ids) {
    const c = byId.get(id);
    const address = mapAddress(c);
    if (!address) leftOut.push(cname(c));
    else rows.push({ contact_id: id, name: cname(c), address, thin: addressIsThin(address) });
  }
  if (!keepOrder) rows = sortForRoute(rows);
  return { rows, leftOut };
}

/** Makes a list from stops [{ contact_id?, name, address, note? }] in the order given. Returns { id, token }. */
export async function createList(db, owner, { title, note, days, stops }) {
  if (!Array.isArray(stops) || !stops.length) throw bad("Pick at least one stop.");
  if (stops.length > MAX_STOPS) throw bad(`A list can have up to ${MAX_STOPS} stops.`);
  const clean = stops.map((s) => ({ contact_id: isUuid(s?.contact_id) ? s.contact_id : null, name: clip(s?.name, 120), address: clip(s?.address, 300), note: clip(s?.note, 300) })).filter((s) => s.address);
  if (!clean.length) throw bad("None of those stops has an address.");
  const { count } = await db.from("drop_off_lists").select("id", { count: "exact", head: true }).eq("owner_id", owner).is("revoked_at", null).gt("expires_at", new Date().toISOString());
  if ((count || 0) >= MAX_ACTIVE) throw bad(`You have ${MAX_ACTIVE} active drop-off lists. Turn some off first.`);

  // Only contacts that really are this agent's stay linked.
  const linkIds = [...new Set(clean.map((s) => s.contact_id).filter(Boolean))];
  let own = new Set();
  if (linkIds.length) {
    const { data } = await db.from("contacts").select("id").eq("owner_id", owner).in("id", linkIds);
    own = new Set((data || []).map((c) => c.id));
  }

  const token = `do${crypto.randomBytes(32).toString("hex")}`;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const span = Math.max(1, Math.min(Number(days) || 30, 180));
  const { data: list, error } = await db
    .from("drop_off_lists")
    .insert({ owner_id: owner, token_hash: hash, token, title: clip(title, 100), note: clip(note, 1000), expires_at: new Date(Date.now() + span * 864e5).toISOString() })
    .select("id")
    .single();
  if (error) throw new HttpError(500, error.message);
  const { error: stopErr } = await db.from("drop_off_stops").insert(clean.map((s, i) => ({ list_id: list.id, position: i + 1, contact_id: s.contact_id && own.has(s.contact_id) ? s.contact_id : null, name: s.name, address: s.address, note: s.note })));
  if (stopErr) {
    await db.from("drop_off_lists").delete().eq("id", list.id);
    throw new HttpError(500, stopErr.message);
  }
  return { id: list.id, token, stops: clean.length, days: span };
}

const statusOf = (l) => (l.revoked_at ? "off" : new Date(l.expires_at) < new Date() ? "expired" : "open");

/** The agent's lists, newest first, each with how many stops are delivered. */
export async function listLists(db, owner, limit = 40) {
  const { data: lists, error } = await db.from("drop_off_lists").select("id, token, title, note, created_at, expires_at, revoked_at, last_viewed_at, view_count").eq("owner_id", owner).order("created_at", { ascending: false }).limit(limit);
  if (error) throw new HttpError(500, error.message);
  const ids = (lists || []).map((l) => l.id);
  const counts = new Map();
  if (ids.length) {
    const { data: stops } = await db.from("drop_off_stops").select("list_id, done_at").in("list_id", ids);
    for (const s of stops || []) {
      const c = counts.get(s.list_id) || { total: 0, done: 0 };
      c.total++;
      if (s.done_at) c.done++;
      counts.set(s.list_id, c);
    }
  }
  return (lists || []).map((l) => ({ ...l, status: statusOf(l), total: counts.get(l.id)?.total || 0, done: counts.get(l.id)?.done || 0 }));
}

/** One list with its stops. */
export async function getList(db, owner, listId) {
  if (!isUuid(listId)) throw bad("That isn't a valid drop-off list id. Use list_drop_off_lists to get one.");
  const { data: l } = await db.from("drop_off_lists").select("id, token, title, note, created_at, expires_at, revoked_at, last_viewed_at, view_count").eq("id", listId).eq("owner_id", owner).maybeSingle();
  if (!l) throw new HttpError(404, "No drop-off list with that id.");
  const { data: stops } = await db.from("drop_off_stops").select("id, position, contact_id, name, address, note, done_at").eq("list_id", l.id).order("position");
  return { ...l, status: statusOf(l), stops: stops || [], total: (stops || []).length, done: (stops || []).filter((s) => s.done_at).length };
}

/** Turns a list's link off, or back on for `days` more days. */
export async function setActive(db, owner, listId, on, days = 30) {
  const l = await getList(db, owner, listId);
  const patch = on ? { revoked_at: null, expires_at: new Date(Date.now() + Math.max(1, Math.min(Number(days) || 30, 180)) * 864e5).toISOString() } : { revoked_at: l.revoked_at || new Date().toISOString() };
  const { error } = await db.from("drop_off_lists").update(patch).eq("id", l.id).eq("owner_id", owner);
  if (error) throw new HttpError(500, error.message);
  return { ...l, ...patch, status: on ? "open" : "off" };
}

/** Permanently removes a list and its stops (the stops go with it). */
export async function deleteList(db, owner, listId) {
  const l = await getList(db, owner, listId);
  const { error } = await db.from("drop_off_lists").delete().eq("id", l.id).eq("owner_id", owner);
  if (error) throw new HttpError(500, error.message);
  return l;
}
