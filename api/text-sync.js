// The Mac app's side of text sync (see supabase/text-sync.sql). No browser sign-in: the app sends the device token the agent made in the
// dashboard (Contacts > Text sync), compared only by its hash.
//   GET  /api/text-sync?a=contacts   the contacts switched on for sync (name, phone numbers, emails) and the newest text/call already saved
//                                    for each, so the app only sends what is newer
//   POST /api/text-sync?a=messages   {items:[{contact_id, kind, direction, body, occurred_at, external_id, duration_seconds}]} up to 500 at a time
// Only contacts that are switched on, and that belong to the device's owner, accept messages. Anything else is ignored.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^ts_[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 500;
const COLS = "id, first_name, last_name, company, phone, other_phones, email, other_emails";

/** Digits only, and for a US number with a country code the last ten, so "+1 (405) 555-0142" and "4055550142" are the same. */
export const phoneKey = (v) => {
  const d = String(v || "").replace(/\D/g, "");
  if (d.length < 7) return "";
  return d.length > 10 ? d.slice(-10) : d;
};

async function device(admin, req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN.test(token)) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: dev } = await admin.from("text_sync_devices").select("id, owner_id, last_seen_at").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
  if (!dev) return null;
  const { data: owner } = await admin.from("profiles").select("people_enabled").eq("id", dev.owner_id).maybeSingle();
  if (!owner?.people_enabled) return null;
  return dev;
}

async function syncedContacts(admin, ownerId) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("contacts").select(COLS).eq("owner_id", ownerId).eq("text_sync", true).eq("archived", false).order("id").range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const dev = await device(admin, req);
  if (!dev) return res.status(401).json({ error: "This Mac isn't connected anymore. Make a new connection code in the dashboard." });
  const a = String(req.query?.a || "");
  const now = new Date().toISOString();

  if (req.method === "GET" && a === "contacts") {
    try {
      const [rows, latestRes] = await Promise.all([syncedContacts(admin, dev.owner_id), admin.rpc("text_sync_latest", { p_owner: dev.owner_id })]);
      const latest = new Map();
      for (const r of latestRes.data || []) latest.set(r.contact_id, { ...(latest.get(r.contact_id) || {}), [r.kind]: r.latest });
      const contacts = rows.map((c) => ({
        id: c.id,
        name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || "Contact",
        phones: [...new Set([c.phone, ...(c.other_phones || [])].map(phoneKey).filter(Boolean))],
        emails: [...new Set([c.email, ...(c.other_emails || [])].map((e) => String(e || "").trim().toLowerCase()).filter(Boolean))],
        latest: latest.get(c.id) || {},
      }));
      await admin.from("text_sync_devices").update({ last_seen_at: now }).eq("id", dev.id);
      return res.status(200).json({ contacts });
    } catch (err) {
      console.error("text-sync contacts:", err);
      return res.status(500).json({ error: "Couldn't load contacts." });
    }
  }

  if (req.method === "POST" && a === "messages") {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length === 0) return res.status(200).json({ saved: 0 });
    if (items.length > MAX_ITEMS) return res.status(400).json({ error: `Send at most ${MAX_ITEMS} at a time.` });
    const ids = [...new Set(items.map((i) => String(i?.contact_id || "")).filter((id) => UUID.test(id)))];
    const { data: ok } = ids.length ? await admin.from("contacts").select("id").eq("owner_id", dev.owner_id).eq("text_sync", true).in("id", ids) : { data: [] };
    const allowed = new Set((ok || []).map((c) => c.id));
    const soon = Date.now() + 24 * 60 * 60 * 1000;
    const rows = [];
    for (const i of items) {
      const when = new Date(i?.occurred_at);
      const kind = i?.kind;
      const direction = i?.direction;
      const externalId = String(i?.external_id || "");
      if (!allowed.has(i?.contact_id) || !["text", "call"].includes(kind) || !["in", "out", "missed"].includes(direction)) continue;
      if (!externalId || externalId.length > 200 || Number.isNaN(when.getTime()) || when.getTime() > soon) continue;
      const secs = Number(i?.duration_seconds);
      rows.push({
        contact_id: i.contact_id,
        owner_id: dev.owner_id,
        kind,
        direction,
        body: kind === "text" ? String(i?.body || "").slice(0, 10000) : "",
        duration_seconds: Number.isFinite(secs) && secs >= 0 ? Math.round(secs) : null,
        occurred_at: when.toISOString(),
        external_id: externalId,
      });
    }
    if (rows.length) {
      const { error } = await admin.from("contact_messages").upsert(rows, { onConflict: "owner_id,external_id", ignoreDuplicates: true });
      if (error) {
        console.error("text-sync messages:", error);
        return res.status(500).json({ error: "Couldn't save them." });
      }
    }
    await admin.from("text_sync_devices").update({ last_seen_at: now, last_synced_at: now }).eq("id", dev.id);
    return res.status(200).json({ saved: rows.length, ignored: items.length - rows.length });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(404).json({ error: "Not found." });
}
