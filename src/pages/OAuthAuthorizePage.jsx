import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "../hooks/useAuth";
import BrandLogo from "../components/BrandLogo";

// Where an AI app (Claude, ChatGPT, a Grok bot, ...) sends an agent to connect it. The app has already registered itself and started an OAuth
// sign-in with PKCE; this page shows who is asking and what they would be allowed to do, and records the agent's answer through api/oauth.js,
// which hands back the address to send the browser on to (with a one-time code, or an "access denied").
const SCOPE_TEXT = {
  read: ["See your data", "Tasks, people, contacts, deals, listings, your schedule and website. Always included."],
  write_people: ["Add and update people", "Add leads and pipeline people, move them between stages, set follow-ups, add notes."],
  write_tasks: ["Tasks and contacts", "Add and tick off tasks, add and update contacts and tags."],
  write_deals: ["Deals", "Update deal dates and contacts, tick off deal tasks, add deal notes."],
  write_drafts: ["Drafts", "Write draft messages, blog posts and listings for you to review. Nothing is sent or published."],
};
const ORDER = ["read", "write_people", "write_tasks", "write_deals", "write_drafts"];

export default function OAuthAuthorizePage() {
  const { session, loading } = useAuth();
  const location = useLocation();
  const q = useMemo(() => Object.fromEntries(new URLSearchParams(location.search)), [location.search]);
  const [info, setInfo] = useState(null); // { client_name, allowed, you }
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [chosen, setChosen] = useState(null);

  const call = async (body) => {
    const {
      data: { session: s },
    } = await supabase.auth.getSession();
    const res = await fetch("/api/oauth", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` }, body: JSON.stringify({ client_id: q.client_id, redirect_uri: q.redirect_uri, state: q.state, code_challenge: q.code_challenge, code_challenge_method: q.code_challenge_method, ...body }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "Something went wrong. Try again.");
    return json;
  };

  useEffect(() => {
    if (!session) return;
    if (q.response_type !== "code" || !q.client_id || !q.redirect_uri) {
      setError("This connection request is incomplete. Start it again from the app.");
      return;
    }
    call({ action: "info" })
      .then((r) => {
        setInfo(r);
        const asked = String(q.scope || "").split(/[\s,]+/).filter((x) => ORDER.includes(x));
        // What the app asked for starts ticked; with no request at all, everything starts ticked (the agent can untick any of it).
        setChosen(new Set(["read", ...(asked.length ? asked : ORDER)]));
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  if (loading) return <Shell><p className="text-sm text-[#1c1a17]/50">Loading…</p></Shell>;
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;

  const answer = async (action) => {
    setBusy(true);
    setError("");
    try {
      const r = await call({ action, scopes: [...chosen] });
      window.location.assign(r.redirect);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };
  const toggle = (scope) => setChosen((c) => {
    const n = new Set(c);
    if (n.has(scope)) n.delete(scope);
    else n.add(scope);
    return n;
  });

  return (
    <Shell>
      {!info && !error && <p className="text-sm text-[#1c1a17]/50">Checking this request…</p>}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
      {info && !info.allowed && (
        <div className="space-y-3">
          <h1 className="font-display text-xl font-semibold">AI connections aren't on for your account</h1>
          <p className="text-sm text-[#1c1a17]/65">Ask an admin to turn on AI access for you, then connect {info.client_name} again.</p>
        </div>
      )}
      {info && info.allowed && chosen && (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/45">Connect an AI app</p>
            <h1 className="mt-1 font-display text-xl font-semibold">{info.client_name} wants to work in your dashboard</h1>
            <p className="mt-1.5 text-sm text-[#1c1a17]/65">It will act as you ({info.you}), only on your own data, and only for what you allow below. You can disconnect it any time under My Profile.</p>
          </div>
          <ul className="space-y-2">
            {ORDER.map((scope) => (
              <li key={scope}>
                <label className={`flex items-start gap-3 rounded-xl border border-black/10 px-3.5 py-3 ${scope === "read" ? "" : "cursor-pointer hover:bg-black/[0.02]"}`}>
                  <input type="checkbox" checked={chosen.has(scope)} disabled={scope === "read"} onChange={() => toggle(scope)} className="mt-1 h-4 w-4 accent-[#ed2127]" />
                  <span>
                    <span className="block text-sm font-semibold">{SCOPE_TEXT[scope][0]}</span>
                    <span className="block text-xs text-[#1c1a17]/55">{SCOPE_TEXT[scope][1]}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-xs text-[#1c1a17]/50">What you allow is shared with {info.client_name}, which has its own privacy terms. It can never send messages, delete anything or publish for you.</p>
          <div className="flex items-center gap-3">
            <button type="button" disabled={busy} onClick={() => answer("approve")} className="rounded-full bg-[#1c1a17] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1c1a17]/90 disabled:opacity-60">
              {busy ? "Connecting…" : "Allow"}
            </button>
            <button type="button" disabled={busy} onClick={() => answer("deny")} className="text-sm text-[#1c1a17]/55 hover:text-[#1c1a17]">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="min-h-screen bg-[#faf9f7] px-4 py-10 text-[#1c1a17] scheme-light">
      <div className="mx-auto max-w-md">
        <div className="mb-6 flex justify-center">
          <BrandLogo name="Dashboard" className="h-9 w-auto" />
        </div>
        <div className="rounded-2xl border border-black/5 bg-white p-6 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
