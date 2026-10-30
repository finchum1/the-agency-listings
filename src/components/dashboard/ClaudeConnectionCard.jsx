import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");

function CopyBox({ label, text }) {
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
        <p className="text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{label}</p>
        <button type="button" onClick={copy} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-3 text-[11.5px] leading-relaxed whitespace-pre-wrap break-all font-mono select-all">{text}</pre>
    </div>
  );
}

const SCOPES = [
  ["read", "See my data", "Always on"],
  ["write_people", "Add and update people", "People, follow-ups, notes"],
  ["write_tasks", "Tasks and contacts", "Add and tick off tasks, update contacts"],
  ["write_deals", "Deals", "Deal dates, contacts, deal tasks"],
  ["write_drafts", "Drafts", "Draft messages, posts and listings. Nothing is sent or published"],
];
const scopeLabel = (scopes) => scopes.filter((s) => s !== "read").map((s) => SCOPES.find((x) => x[0] === s)?.[1]).filter(Boolean).join(", ") || "Read only";

// AI connections, for an admin or an agent an admin has switched AI access on for. Two ways in:
//   - Connected apps: an AI app (Claude, ChatGPT, ...) the person approved by signing in (api/oauth.js). Listed here; Disconnect cuts it off at once.
//   - Personal tokens, for bots that can't sign in (a Grok bot, a script): shown once when made, only a hash is kept, each with the permissions picked.
// Whatever connects acts as this person, through the dashboard's own access rules, and can never send, delete or publish.
export default function ClaudeConnectionCard() {
  const [apps, setApps] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState("");
  const [picked, setPicked] = useState(new Set(["read"]));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(null); // { name, token } shown once
  const endpoint = `${window.location.origin}/api/mcp`;

  const load = useCallback(async () => {
    const [{ data: a }, { data: t }] = await Promise.all([
      supabase.rpc("my_ai_connections"),
      supabase.from("mcp_tokens").select("id, name, token_hint, scopes, created_at, last_used_at, revoked_at").is("revoked_at", null).order("created_at", { ascending: false }),
    ]);
    setApps(a || []);
    setTokens(t || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_mcp_token", { p_name: name.trim(), p_scopes: [...picked] });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFresh({ name: name.trim(), token: data });
    setName("");
    load();
  };

  const revoke = async (t) => {
    if (!confirm(`Revoke “${t.name}”? Anything using it will stop working right away.`)) return;
    await supabase.rpc("revoke_mcp_token", { p_id: t.id });
    if (fresh && fresh.token.endsWith(t.token_hint)) setFresh(null);
    load();
  };
  const disconnect = async (a) => {
    if (!confirm(`Disconnect ${a.client_name}? It loses access to your dashboard right away.`)) return;
    await supabase.rpc("revoke_ai_connection", { p_id: a.id });
    load();
  };
  const toggle = (scope) =>
    setPicked((c) => {
      const n = new Set(c);
      if (n.has(scope)) n.delete(scope);
      else n.add(scope);
      n.add("read");
      return n;
    });

  const code = fresh ? `claude mcp add --transport http latchpoint ${endpoint} --header "Authorization: Bearer ${fresh.token}"` : "";
  const desktop = fresh
    ? JSON.stringify({ mcpServers: { latchpoint: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:Bearer ${fresh.token}`] } } }, null, 2)
    : "";
  const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
      <h2 className="font-display text-lg font-semibold">AI connections</h2>
      <p className={`text-sm mt-1 ${muted}`}>
        Work in your dashboard from your own AI: Claude, ChatGPT or a Grok bot. It acts as you, only on your own data, and only for what you allow. It can never send a
        message, delete anything or publish.
      </p>

      <div className="mt-5 space-y-3">
        <CopyBox label="Connector address (add this as a custom connector in Claude or ChatGPT, then sign in when asked)" text={endpoint} />
      </div>

      <h3 className="mt-6 text-sm font-semibold">Connected apps</h3>
      {apps.length === 0 ? (
        <p className={`mt-1 text-sm ${muted}`}>None yet. Add the connector address in your AI app and sign in to approve it.</p>
      ) : (
        <ul className="mt-2 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
          {apps.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="text-sm font-medium">{a.client_name}</span>
              <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Can: {scopeLabel(a.scopes)}</span>
              <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Connected {fmt(a.created_at)} · last used {fmt(a.last_used_at)}</span>
              <button type="button" onClick={() => disconnect(a)} className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                Disconnect
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="mt-6 text-sm font-semibold">Personal tokens (for bots that can't sign in)</h3>
      {fresh && (
        <div className="mt-3 rounded-xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] p-4 space-y-4">
          <p className="text-sm font-semibold">Your token for “{fresh.name}” — copy it now, it won't be shown again.</p>
          <CopyBox label="Token (send it as: Authorization: Bearer …)" text={fresh.token} />
          <CopyBox label="Claude Code: run this once in a terminal" text={code} />
          <CopyBox label="Claude Desktop: add this to claude_desktop_config.json (needs Node installed), then restart Claude" text={desktop} />
          <button type="button" onClick={() => setFresh(null)} className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">
            I've saved it, hide this
          </button>
        </div>
      )}

      <form onSubmit={create} className="mt-3 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name it, e.g. My Grok bot" aria-label="Token name" className={`${inputClass} flex-1 min-w-[14rem]`} />
          <button type="submit" disabled={!name.trim() || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
            {busy ? "Creating…" : "Create token"}
          </button>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5" role="group" aria-label="What this token may do">
          {SCOPES.map(([scope, label, hint]) => (
            <label key={scope} title={hint} className={`inline-flex items-center gap-1.5 text-xs ${scope === "read" ? "opacity-60" : "cursor-pointer"}`}>
              <input type="checkbox" checked={picked.has(scope)} disabled={scope === "read"} onChange={() => toggle(scope)} className="h-3.5 w-3.5 accent-[#ed2127]" />
              {label}
            </label>
          ))}
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tokens.length > 0 && (
        <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="font-mono text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">…{t.token_hint}</span>
              <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Can: {scopeLabel(t.scopes || ["read"])}</span>
              <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Created {fmt(t.created_at)} · last used {fmt(t.last_used_at)}</span>
              <button type="button" onClick={() => revoke(t)} className="ml-auto text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
