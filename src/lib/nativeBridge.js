// The dashboard's side of the handoff to the Latchpoint Mac app. Inside the app (and nowhere else) the page has window.latchpoint; this tells the
// app when someone signs in, when the session is refreshed, and when they sign out, so the app can make its own calls later (text sync, alerts).
// Kept free of imports so it can be tested on its own; src/main.jsx wires it to the real sign-in client.
const sessionMessage = (s) => ({ type: "session", access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, user_id: s.user?.id, email: s.user?.email });

/** native: window.latchpoint; auth: supabase.auth. Returns a function that stops listening. */
export function connectNativeBridge({ native, auth }) {
  if (!native || typeof native.postMessage !== "function" || !auth) return () => {};
  const sendSession = (s) => {
    if (s?.access_token && s?.refresh_token) native.postMessage(sessionMessage(s));
  };
  auth.getSession().then(({ data }) => sendSession(data?.session)).catch(() => {});
  const { data } = auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT") native.postMessage({ type: "signed_out" });
    else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") sendSession(session);
  });
  return () => data?.subscription?.unsubscribe();
}
