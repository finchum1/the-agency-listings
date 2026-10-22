import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import TemplateCompare from "../TemplateCompare";
import { LAYOUT_OPTIONS, THEME_OPTIONS } from "../../lib/sitePreview";

const when = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "never");
const layoutName = (v) => LAYOUT_OPTIONS.find((l) => l.value === v)?.label || v;
const themeName = (v) => THEME_OPTIONS.find((t) => t.value === v)?.label || v;
const inputClass =
  "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

// The agent's site in every layout and color theme, live, with a button to use one; plus private share links so the agent can
// look and pick without signing in (the site may still be a draft). Used for an agent's own site and, by admins, for any agent's.
export default function CompareTemplatesPanel({ site, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [links, setLinks] = useState([]);
  const [days, setDays] = useState(30);
  const [fresh, setFresh] = useState(null); // { url } shown once
  const [copied, setCopied] = useState(false);

  const loadLinks = useCallback(async () => {
    const { data } = await supabase
      .from("site_preview_links")
      .select("id, token_hint, created_at, expires_at, last_viewed_at, picked_layout, picked_theme, picked_at")
      .eq("agent_site_id", site.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLinks(data || []);
  }, [site.id]);
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const use = async (layout, theme) => {
    if (site.status === "published" && !confirm(`This site is live. Switch it to ${layoutName(layout)} with ${themeName(theme)} colors now?`)) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase.from("agent_sites").update({ layout, theme }).eq("id", site.id);
    setBusy(false);
    if (err) setError(err.message);
    else onChanged?.();
  };

  const createLink = async () => {
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_site_preview_link", { p_site: site.id, p_days: days });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setFresh({ url: `${window.location.origin}/preview/${data}` });
    setCopied(false);
    loadLinks();
  };

  const revoke = async (l) => {
    if (!confirm("Revoke this link? Anyone using it will see an expired message.")) return;
    await supabase.rpc("revoke_site_preview_link", { p_id: l.id });
    loadLinks();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(fresh.url);
      setCopied(true);
    } catch {
      /* the address is selectable */
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6">
        <h2 className="font-display text-lg font-semibold">Share with the agent</h2>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          Make a private link the agent can open on any device, with no sign-in, even while the site is still a draft. They see their own site in every layout, choose the one they like,
          and you're emailed their pick. The link only shows the previews, never the editor.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="text-sm flex items-center gap-2">
            Works for
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputClass} aria-label="How long the link works">
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <button type="button" onClick={createLink} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
            Create share link
          </button>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

        {fresh && (
          <div className="mt-4 rounded-xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] p-4">
            <p className="text-sm font-semibold">Copy this link now. For safety it can't be shown again (make another if you lose it).</p>
            <div className="mt-2 flex items-center gap-2">
              <input readOnly value={fresh.url} onFocus={(e) => e.target.select()} aria-label="Share link" className={`${inputClass} flex-1 font-mono text-xs`} />
              <button type="button" onClick={copy} className="rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-4 py-2">
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {links.length > 0 && (
          <ul className="mt-5 divide-y divide-black/5 dark:divide-white/10 border-t border-black/5 dark:border-white/10">
            {links.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3 text-sm">
                <span className="font-mono text-xs text-[#1c1a17]/45 dark:text-[#faf9f7]/45">…{l.token_hint}</span>
                <span className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                  Made {when(l.created_at)} · expires {when(l.expires_at)} · last opened {when(l.last_viewed_at)}
                </span>
                {l.picked_layout && (
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Picked {layoutName(l.picked_layout)}
                    {l.picked_theme ? `, ${themeName(l.picked_theme)}` : ""} ({when(l.picked_at)})
                  </span>
                )}
                <span className="ml-auto flex items-center gap-4">
                  {l.picked_layout && (
                    <button type="button" onClick={() => use(l.picked_layout, l.picked_theme || site.theme)} disabled={busy} className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline disabled:opacity-50">
                      Use their pick
                    </button>
                  )}
                  <button type="button" onClick={() => revoke(l)} className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                    Revoke
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <TemplateCompare
        buildUrl={(layout, theme) => `/sites/${site.slug}?preview_layout=${layout}&preview_theme=${theme}`}
        current={{ layout: site.layout || "classic", theme: site.theme || "classic" }}
        action={{ label: "Use this layout", onPick: use, busy }}
        intro={<p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-5">Live previews of this site in every layout. Pick colors, scroll inside a preview to look around, then use the one you want. Looking changes nothing.</p>}
      />
    </div>
  );
}
