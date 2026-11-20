// Web push for the dashboard (phone and desktop alerts). The server signs pushes with one VAPID key pair, made the first time it is needed and kept in
// push_config (service role only), so there is nothing to set up. See supabase/push-alerts.sql and api/push.js.
import { generateVAPIDKeys, sendNotification } from "web-push";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

/** The key pair, made and saved on first use. */
export async function vapidKeys(admin) {
  const read = async () => (await admin.from("push_config").select("public_key, private_key").eq("id", 1).maybeSingle()).data;
  let row = await read();
  if (!row) {
    const k = generateVAPIDKeys();
    await admin.from("push_config").insert({ id: 1, public_key: k.publicKey, private_key: k.privateKey }); // a racing insert just loses to the first
    row = await read();
  }
  return row ? { publicKey: row.public_key, privateKey: row.private_key } : null;
}

/**
 * Sends `payload` ({ title, body, url, tag }) to every subscription of the given people. A subscription the browser says is gone (404 or 410) is deleted.
 * Returns { sent, removed }. Never throws.
 */
export async function sendPushTo(admin, userIds, payload) {
  const result = { sent: 0, removed: 0 };
  try {
    const keys = await vapidKeys(admin);
    if (!keys || !userIds.length) return result;
    const { data: subs } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").in("user_id", userIds);
    const body = JSON.stringify({ title: String(payload.title || "").slice(0, 80), body: String(payload.body || "").slice(0, 240), url: payload.url || "/dashboard", tag: payload.tag || "deadlines" });
    for (const s of subs || []) {
      try {
        // The contact address of a push sender is public to the push services, so it is the site address, never a person's email.
        await sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, body, { vapidDetails: { subject: SITE_ORIGIN, publicKey: keys.publicKey, privateKey: keys.privateKey }, TTL: 6 * 3600, urgency: "normal" });
        result.sent += 1;
        await admin.from("push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", s.id);
      } catch (err) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          result.removed += 1;
        } else console.error("Push failed:", err?.statusCode, err?.body || err?.message);
      }
    }
  } catch (err) {
    console.error("Push error:", err);
  }
  return result;
}
