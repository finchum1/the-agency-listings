// The Latchpoint Mac app's own key (a text_sync_devices row; see supabase/text-sync.sql). Only a hash is stored. Shared by api/text-sync.js and api/mac-app.js.
import crypto from "node:crypto";

const TOKEN = /^ts_[0-9a-f]{64}$/;

/** The device row behind "Authorization: Bearer ts_...", or null. The agent must still have People turned on. */
export async function deviceFor(admin, req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  if (!TOKEN.test(token)) return null;
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: dev } = await admin.from("text_sync_devices").select("id, owner_id, last_seen_at").eq("token_hash", hash).is("revoked_at", null).maybeSingle();
  if (!dev) return null;
  const { data: owner } = await admin.from("profiles").select("people_enabled").eq("id", dev.owner_id).maybeSingle();
  if (!owner?.people_enabled) return null;
  return dev;
}
