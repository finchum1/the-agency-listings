// The page a gift-delivery helper opens (see supabase/drop-off-lists.sql and src/pages/DropOffPage.jsx).
//   GET  /api/drop-off?token=do...                       -> the list: title, note, who it is from, and each stop's name, address and note
//   POST /api/drop-off  { token, stop_id, done: true|false } -> mark one stop delivered (or undo it)
// No sign-in: the long random token in the link is the credential, compared only by its hash. A stop is just a name and an address
// (a snapshot taken when the list was made); phone numbers and emails never go through here.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";

const TOKEN = /^do[0-9a-f]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  const token = String((req.method === "GET" ? req.query?.token : req.body?.token) || "");
  if (!TOKEN.test(token)) return res.status(404).json({ error: "This link isn't valid anymore." });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: list } = await admin.from("drop_off_lists").select("id, owner_id, title, note, expires_at, revoked_at, view_count").eq("token_hash", hash).maybeSingle();
  if (!list || list.revoked_at || new Date(list.expires_at) < new Date()) return res.status(404).json({ error: "This link isn't valid anymore." });

  if (req.method === "POST") {
    const stopId = String(req.body?.stop_id || "");
    if (!UUID.test(stopId) || typeof req.body?.done !== "boolean") return res.status(400).json({ error: "Say which stop, and whether it is delivered." });
    const { data, error } = await admin
      .from("drop_off_stops")
      .update({ done_at: req.body.done ? new Date().toISOString() : null })
      .eq("id", stopId)
      .eq("list_id", list.id)
      .select("id, done_at")
      .maybeSingle();
    if (error) return res.status(500).json({ error: "Couldn't save that. Try again." });
    if (!data) return res.status(404).json({ error: "That stop isn't on this list." });
    return res.status(200).json({ id: data.id, done_at: data.done_at });
  }

  const [{ data: stops }, { data: agent }] = await Promise.all([
    admin.from("drop_off_stops").select("id, position, name, address, note, done_at").eq("list_id", list.id).order("position"),
    admin.from("profiles").select("full_name").eq("id", list.owner_id).maybeSingle(),
  ]);
  await admin.from("drop_off_lists").update({ last_viewed_at: new Date().toISOString(), view_count: (list.view_count || 0) + 1 }).eq("id", list.id);
  return res.status(200).json({ title: list.title, note: list.note, from: agent?.full_name || "", expires_at: list.expires_at, stops: stops || [] });
}
