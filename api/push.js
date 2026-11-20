// Phone / desktop alerts: subscribing this browser, and a test. Signed-in people only, except the public key.
//   GET  /api/push?key=1                        -> { publicKey }   (what the browser needs to subscribe)
//   POST { action: "subscribe", subscription }   saves this browser's subscription for the signed-in person
//   POST { action: "unsubscribe", endpoint }     removes it
//   POST { action: "test" }                      sends a test notification to the person's own subscriptions
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { sendPushTo, vapidKeys } from "./_lib/push.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  if (req.method === "GET") {
    const keys = await vapidKeys(admin);
    if (!keys) return res.status(503).json({ error: "Alerts aren't available right now." });
    return res.status(200).json({ publicKey: keys.publicKey });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const body = req.body || {};

  if (body.action === "subscribe") {
    const s = body.subscription || {};
    const endpoint = String(s.endpoint || "");
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !s.keys?.p256dh || !s.keys?.auth) return res.status(400).json({ error: "That subscription isn't valid." });
    const { count } = await admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", auth.user.id);
    if ((count || 0) >= 10) return res.status(400).json({ error: "This account has too many devices set up for alerts. Turn some off first." });
    const { error } = await admin.from("push_subscriptions").upsert(
      { user_id: auth.user.id, endpoint, p256dh: String(s.keys.p256dh), auth: String(s.keys.auth), user_agent: String(req.headers["user-agent"] || "").slice(0, 200) },
      { onConflict: "endpoint" },
    );
    if (error) {
      console.error("Push subscribe failed:", error);
      return res.status(500).json({ error: "Couldn't turn alerts on. Please try again." });
    }
    return res.status(200).json({ ok: true });
  }
  if (body.action === "unsubscribe") {
    await admin.from("push_subscriptions").delete().eq("user_id", auth.user.id).eq("endpoint", String(body.endpoint || ""));
    return res.status(200).json({ ok: true });
  }
  if (body.action === "test") {
    const r = await sendPushTo(admin, [auth.user.id], { title: "Alerts are on", body: "You'll get a short note here on mornings when something is due on a deal.", url: "/dashboard/deals", tag: "test" });
    return res.status(200).json({ ok: r.sent > 0, ...r });
  }
  return res.status(400).json({ error: "Unknown action." });
}
