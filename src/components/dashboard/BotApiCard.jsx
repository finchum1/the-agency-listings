import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const SCOPES = [
  { key: "blog", label: "Blog posts", hint: "Add and edit blog posts on any agent site in the office" },
  { key: "agents", label: "Agents", hint: "Add new agents (a profile only, unless told to send an invite)" },
  { key: "sites", label: "Agent websites", hint: "Create and change agent websites, areas and testimonials" },
  { key: "listings", label: "Listings", hint: "Create and change property listings, from a link, an MLS number or details" },
  { key: "people", label: "People (your leads, pipeline and deals)", hint: "Add leads, notes, pipeline moves, transactions and to-dos in your own People. Messages are drafts you approve; nothing is sent or deleted" },
  { key: "monitoring", label: "Monitoring (what's wrong)", hint: "See which property-site domains aren't responding, and get a webhook the moment one stops. It can fix a mistyped domain on a listing if it also has Listings" },
];
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");
const label = (key) => SCOPES.find((s) => s.key === key)?.label || key;

function CopyBox({ title, text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* the text is selectable, so it can still be copied by hand */
    }
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{title}</p>
        <button type="button" onClick={copy} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap break-all font-mono select-all">{text}</pre>
    </div>
  );
}

// Admin-only: scoped tokens for bots (api/bots.js, /v1/...). One token per bot, each with only the scopes it needs.
// The token is shown once when made; only a hash is kept. Revoking cuts that bot off immediately.
export default function BotApiCard() {
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(null);
  const [hooks, setHooks] = useState({}); // token id -> { url, last_status, last_attempt_at }
  const [hookDraft, setHookDraft] = useState({}); // token id -> text being typed
  const [hookSecret, setHookSecret] = useState(null); // { tokenId, secret } shown once
  const [hookError, setHookError] = useState("");
  const base = `${window.location.origin}/v1`;

  const load = useCallback(async () => {
    const { data } = await supabase.from("api_tokens").select("id, name, scopes, token_hint, created_at, last_used_at, revoked_at").is("revoked_at", null).order("created_at", { ascending: false });
    setTokens(data || []);
    const { data: wh } = await supabase.from("api_token_webhooks").select("token_id, url, last_status, last_attempt_at");
    setHooks(Object.fromEntries((wh || []).map((h) => [h.token_id, h])));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const toggle = (key) => setScopes((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || scopes.length === 0 || busy) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_api_token", { p_name: name.trim(), p_scopes: scopes });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFresh({ name: name.trim(), scopes, token: data });
    setName("");
    setScopes([]);
    load();
  };

  const revoke = async (t) => {
    if (!confirm(`Revoke “${t.name}”? The bot using it will stop working right away.`)) return;
    await supabase.rpc("revoke_api_token", { p_id: t.id });
    if (fresh && fresh.token.endsWith(t.token_hint)) setFresh(null);
    load();
  };

  const saveHook = async (t, url) => {
    setHookError("");
    const { data, error: err } = await supabase.rpc("set_token_webhook", { p_token: t.id, p_url: url });
    if (err) return setHookError(err.message);
    setHookSecret(url ? { tokenId: t.id, secret: data } : null);
    setHookDraft((d) => ({ ...d, [t.id]: undefined }));
    load();
  };

  const curl = fresh ? `curl ${base}/me \\\n  -H "Authorization: Bearer ${fresh.token}"` : "";

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
      <h2 className="font-display text-lg font-semibold">Bot API access</h2>
      <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
        Let a bot (for example a Grok bot) add and edit blog posts, add agents, create agent websites, or create listings. Make one token per bot and give it only what it
        needs. Everything a bot creates starts as a draft, and bots can't delete anything. Every call is logged.
      </p>
      <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-2">
        Give the bot the token and this address, which describes every endpoint: <span className="font-mono select-all">{base}/openapi.json</span>
      </p>

      {fresh && (
        <div className="mt-5 rounded-xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] p-4 space-y-4">
          <p className="text-sm font-semibold">
            Token for “{fresh.name}” ({fresh.scopes.map(label).join(", ")}) — copy it now, it won't be shown again.
          </p>
          <CopyBox title="Token" text={fresh.token} />
          <CopyBox title="Test it from a terminal" text={curl} />
          <button type="button" onClick={() => setFresh(null)} className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">
            I've saved it, hide this
          </button>
        </div>
      )}

      <form onSubmit={create} className="mt-5 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name the bot, e.g. Blog bot" aria-label="Bot name" className={inputClass} />
        <fieldset>
          <legend className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-2">What can it do?</legend>
          <div className="grid sm:grid-cols-2 gap-2">
            {SCOPES.map((s) => (
              <label key={s.key} className={`flex items-start gap-2.5 rounded-lg border p-3 cursor-pointer text-sm ${scopes.includes(s.key) ? "border-[#ed2127] dark:border-[#f2454b] bg-[#ed2127]/[0.04]" : "border-black/10 dark:border-white/15"}`}>
                <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} className="mt-0.5 h-4 w-4 accent-[#ed2127]" />
                <span>
                  <span className="block font-medium">{s.label}</span>
                  <span className="block text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{s.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" disabled={!name.trim() || scopes.length === 0 || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {busy ? "Creating…" : "Create token"}
        </button>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </form>

      {tokens.length > 0 && (
        <ul className="mt-5 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="font-mono text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">…{t.token_hint}</span>
              <span className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{t.scopes.map(label).join(", ")}</span>
              <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Created {fmt(t.created_at)} · last used {fmt(t.last_used_at)}</span>
              <button type="button" onClick={() => revoke(t)} className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                Revoke
              </button>
              {t.scopes.includes("monitoring") && (
                <div className="basis-full mt-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] p-3 space-y-2">
                  <p className="text-xs font-medium text-[#1c1a17]/70 dark:text-[#faf9f7]/70">Tell this bot right away when something breaks (webhook)</p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveHook(t, (hookDraft[t.id] ?? hooks[t.id]?.url ?? "").trim());
                    }}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input
                      value={hookDraft[t.id] ?? hooks[t.id]?.url ?? ""}
                      onChange={(e) => setHookDraft((d) => ({ ...d, [t.id]: e.target.value }))}
                      placeholder="https://your-bot.example.com/webhook"
                      aria-label={`Webhook address for ${t.name}`}
                      className={`${inputClass} !py-2 flex-1 min-w-[16rem]`}
                    />
                    <button type="submit" className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2">
                      {hooks[t.id] ? "Save (new secret)" : "Save webhook"}
                    </button>
                    {hooks[t.id] && (
                      <button type="button" onClick={() => saveHook(t, "")} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                        Remove
                      </button>
                    )}
                  </form>
                  {hooks[t.id]?.last_status && (
                    <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">
                      Last delivery: {hooks[t.id].last_status}
                      {hooks[t.id].last_attempt_at ? ` · ${new Date(hooks[t.id].last_attempt_at).toLocaleString()}` : ""}
                    </p>
                  )}
                  {hookSecret?.tokenId === t.id && (
                    <div className="space-y-2">
                      <CopyBox title="Signing secret (shown once). The bot uses it to check each event really came from here." text={hookSecret.secret} />
                      <button type="button" onClick={() => setHookSecret(null)} className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">
                        I've saved it, hide this
                      </button>
                    </div>
                  )}
                  {hookError && <p className="text-xs text-red-600 dark:text-red-400">{hookError}</p>}
                  <p className="text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
                    Events: domain.down and domain.recovered. The bot can try it with POST /v1/alerts/test, and read everything wrong right now with GET /v1/alerts.
                  </p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
