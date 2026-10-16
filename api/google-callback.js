// Vercel serverless function: where Google sends the browser back after an agent approves access. It is not called by
// the dashboard directly. The "state" was signed by api/google.js when the agent clicked Connect, so it proves which agent
// this is without a session. Stores the account and its (encrypted) refresh token, then returns to the dashboard.
import { serviceClient } from "./_lib/authUser.js";
import { allowedReturnOrigin, encryptToken, exchangeCode, forgetAccessToken, googleConfigured, siteOrigin, verifyState } from "./_lib/googleCalendar.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).send("Method not allowed");
  }
  res.setHeader("Cache-Control", "no-store");
  const host = req.headers.host;
  let origin = siteOrigin(host);
  const back = (query) => res.redirect(302, `${origin}/dashboard?${query}`);

  try {
    if (!googleConfigured()) throw new Error("Google sign-in isn't set up on this server yet.");
    const state = verifyState(req.query?.state);
    origin = allowedReturnOrigin(state.ret, host);
    if (req.query?.error) return back("google=cancelled");
    if (!req.query?.code) throw new Error("Google didn't send a sign-in code.");

    const t = await exchangeCode(String(req.query.code), host);
    const admin = serviceClient();
    const { data: profile } = await admin.from("profiles").select("id").eq("id", state.uid).maybeSingle();
    if (!profile) throw new Error("That account no longer exists.");

    const { data: existing } = await admin.from("google_connections").select("id").eq("owner_id", state.uid).eq("email", t.email).maybeSingle();
    let id = existing?.id;
    if (id) {
      await admin.from("google_connections").update({ status: "active" }).eq("id", id);
    } else {
      const { data: created, error } = await admin.from("google_connections").insert({ owner_id: state.uid, email: t.email }).select("id").single();
      if (error) throw new Error("Couldn't save the Google account.");
      id = created.id;
    }

    if (t.refreshToken) {
      const { error } = await admin.from("google_tokens").upsert({ connection_id: id, refresh_token_enc: encryptToken(t.refreshToken), scopes: t.scope, updated_at: new Date().toISOString() });
      if (error) throw new Error("Couldn't save the Google access.");
    } else if (!existing) {
      await admin.from("google_connections").delete().eq("id", id);
      throw new Error("Google didn't allow ongoing access. Remove this app at myaccount.google.com/permissions, then connect again.");
    }
    forgetAccessToken(id);
    return back(`google=connected&connection=${id}`);
  } catch (err) {
    return back(`google=error&message=${encodeURIComponent(err.message || "Couldn't connect Google.")}`);
  }
}
