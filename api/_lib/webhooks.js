// Webhooks for bot tokens that have the monitoring scope. When something breaks (or recovers) the server POSTs a signed JSON event to the
// address the admin set on the token (My Profile > Bot API access):
//   headers  X-Webhook-Event, X-Webhook-Id, X-Webhook-Timestamp (unix seconds),
//            X-Webhook-Signature: sha256=<hex HMAC-SHA256 of "<timestamp>.<raw body>" with the token's signing secret>
//   body     { id, event, created_at, data }
// Events: domain.down, domain.recovered, test. A failed delivery is retried once; the last result is shown next to the webhook.
import crypto from "node:crypto";
import { assertPublicUrl } from "./safeFetch.js";

export const sign = (secret, timestamp, body) => crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");

async function post(hook, event, id, body) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const url = await assertPublicUrl(hook.url);
  const res = await fetch(url, {
    method: "POST",
    redirect: "manual",
    signal: AbortSignal.timeout(8000),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "LatchpointWebhooks/1.0",
      "X-Webhook-Event": event,
      "X-Webhook-Id": id,
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": `sha256=${sign(hook.secret, timestamp, body)}`,
    },
    body,
  });
  return res.status;
}

/** Sends one event to one webhook ({ token_id, url, secret }). Never throws. Returns { ok, status }. */
export async function deliver(admin, hook, event, data) {
  const id = crypto.randomUUID();
  const body = JSON.stringify({ id, event, created_at: new Date().toISOString(), data });
  let result = { ok: false, status: "no response" };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const status = await post(hook, event, id, body);
      result = { ok: status >= 200 && status < 300, status: String(status) };
      if (result.ok || (status >= 400 && status < 500)) break;
    } catch (err) {
      result = { ok: false, status: String(err?.message || "failed").slice(0, 120) };
    }
    if (attempt === 0) await new Promise((r) => setTimeout(r, 2000));
  }
  try {
    await admin.from("api_token_webhooks").update({ last_status: result.ok ? `delivered (${result.status})` : `failed: ${result.status}`, last_attempt_at: new Date().toISOString() }).eq("token_id", hook.token_id);
  } catch {
    /* the status note is a convenience */
  }
  return result;
}

/** Every webhook an organization's monitoring bots have set. */
export async function monitoringHooks(admin, orgId) {
  const { data: tokens } = await admin.from("api_tokens").select("id, owner_id").contains("scopes", ["monitoring"]).is("revoked_at", null);
  if (!tokens?.length) return [];
  const [{ data: owners }, { data: hooks }] = await Promise.all([
    admin.from("profiles").select("id").in("id", [...new Set(tokens.map((t) => t.owner_id))]).eq("role", "admin").eq("org_id", orgId),
    admin.from("api_token_webhooks").select("token_id, url, secret").in("token_id", tokens.map((t) => t.id)),
  ]);
  const okOwner = new Set((owners || []).map((o) => o.id));
  const allowed = new Set(tokens.filter((t) => okOwner.has(t.owner_id)).map((t) => t.id));
  return (hooks || []).filter((h) => allowed.has(h.token_id));
}

export async function sendToOrgBots(admin, orgId, event, data) {
  const hooks = await monitoringHooks(admin, orgId);
  await Promise.all(hooks.map((h) => deliver(admin, h, event, data)));
  return hooks.length;
}
