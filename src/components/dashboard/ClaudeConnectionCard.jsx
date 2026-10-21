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

// Admin-only for now: personal tokens that let Claude read this person's dashboard data (api/mcp.js). The token is
// shown once when it is made; only a hash is kept. Revoking one cuts that connection off immediately.
export default function ClaudeConnectionCard() {
  const [tokens, setTokens] = useState([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(null); // { name, token } shown once
  const endpoint = `${window.location.origin}/api/mcp`;

  const load = useCallback(async () => {
    const { data } = await supabase.from("mcp_tokens").select("id, name, token_hint, created_at, last_used_at, revoked_at").is("revoked_at", null).order("created_at", { ascending: false });
    setTokens(data || []);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_mcp_token", { p_name: name.trim() });
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

  const code = fresh ? `claude mcp add --transport http latchpoint ${endpoint} --header "Authorization: Bearer ${fresh.token}"` : "";
  const desktop = fresh
    ? JSON.stringify({ mcpServers: { latchpoint: { command: "npx", args: ["-y", "mcp-remote", endpoint, "--header", `Authorization:Bearer ${fresh.token}`] } } }, null, 2)
    : "";

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
      <h2 className="font-display text-lg font-semibold">Claude connection</h2>
      <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
        Let Claude read your dashboard: today's tasks and follow-ups, leads, pipeline, transactions, listings, inquiries and your scorecard. It can look but not change
        anything, and it only sees your own data. Make a token, then connect it to Claude Code or Claude Desktop.
      </p>

      {fresh && (
        <div className="mt-5 rounded-xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] p-4 space-y-4">
          <p className="text-sm font-semibold">Your token for “{fresh.name}” — copy it now, it won't be shown again.</p>
          <CopyBox label="Token" text={fresh.token} />
          <CopyBox label="Claude Code: run this once in a terminal" text={code} />
          <CopyBox label="Claude Desktop: add this to claude_desktop_config.json (needs Node installed), then restart Claude" text={desktop} />
          <button type="button" onClick={() => setFresh(null)} className="text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">
            I've saved it, hide this
          </button>
        </div>
      )}

      <form onSubmit={create} className="mt-5 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Name this connection, e.g. Claude on my laptop" aria-label="Token name" className={`${inputClass} flex-1 min-w-[14rem]`} />
        <button type="submit" disabled={!name.trim() || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {busy ? "Creating…" : "Create token"}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {tokens.length > 0 && (
        <ul className="mt-5 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
          {tokens.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
              <span className="text-sm font-medium">{t.name}</span>
              <span className="font-mono text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">…{t.token_hint}</span>
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
