import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { normalizePath, normalizeTarget, parseBulk, validateRule } from "../../lib/redirectMatch";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

// Old address -> new address, answered with a permanent (301) redirect on
// the site's own custom domain (middleware.js). For moving a site over
// from another platform: every old page address that people or Google
// already know about keeps working and keeps its search ranking.
export default function RedirectsManager({ site }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("site_redirects")
      .select("*")
      .eq("agent_site_id", site.id)
      .order("created_at", { ascending: false });
    if (err) setError(err.message);
    else setRules(data || []);
    setLoading(false);
  }, [site.id]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async (rows) => {
    setSaving(true);
    setError("");
    setNotice("");
    const { error: err } = await supabase
      .from("site_redirects")
      .upsert(
        rows.map((r) => ({ agent_site_id: site.id, from_path: r.from, to_path: r.to })),
        { onConflict: "agent_site_id,from_path" },
      );
    setSaving(false);
    if (err) {
      setError(err.message);
      return false;
    }
    await load();
    return true;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    const problem = validateRule(from, to);
    if (problem) {
      setError(problem);
      return;
    }
    if (await save([{ from: normalizePath(from), to: normalizeTarget(to) }])) {
      setFrom("");
      setTo("");
      setNotice("Redirect saved. It can take up to a minute to start working.");
    }
  };

  const handleBulk = async (e) => {
    e.preventDefault();
    const { rows, errors } = parseBulk(bulkText);
    if (errors.length > 0) {
      setError(errors.slice(0, 5).join(" ") + (errors.length > 5 ? ` …and ${errors.length - 5} more.` : ""));
      return;
    }
    if (rows.length === 0) {
      setError("Nothing to add yet — paste one redirect per line.");
      return;
    }
    if (await save(rows)) {
      setBulkText("");
      setBulkOpen(false);
      setNotice(`Saved ${rows.length} redirect${rows.length === 1 ? "" : "s"}. They can take up to a minute to start working.`);
    }
  };

  const remove = async (rule) => {
    if (!confirm(`Stop redirecting ${rule.from_path}?`)) return;
    setRules((list) => list.filter((r) => r.id !== rule.id));
    const { error: err } = await supabase.from("site_redirects").delete().eq("id", rule.id);
    if (err) {
      setError(err.message);
      load();
    }
  };

  const domain = site.custom_domain;

  return (
    <div className="space-y-6">
      {!domain && (
        <div className="rounded-xl border border-amber-300/60 bg-amber-50 dark:bg-amber-400/10 dark:border-amber-400/30 p-4 text-sm text-amber-800 dark:text-amber-300">
          Redirects only work on a custom domain, and this site doesn't have one yet. Add the domain under Site
          Details, point it to Vercel, and these will start working the moment it's live.
        </div>
      )}

      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold">Redirects</h2>
          <p className={`text-sm mt-1 ${muted}`}>
            Moving a site over? When someone (or Google) visits an old address, send them to the matching new page.
            It keeps your search ranking and means no one lands on an error. Use{" "}
            <code className="text-xs">/*</code> at the end to cover everything under a folder, like{" "}
            <code className="text-xs">/neighborhoods/*</code> to <code className="text-xs">/areas/*</code>. The folder
            page itself (<code className="text-xs">/neighborhoods</code>) needs its own line.
          </p>
        </div>

        <form onSubmit={handleAdd} className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Old address</label>
              <input
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                placeholder="/blog/old-post-name  (or paste the full web address)"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>New address</label>
              <input
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="/blog/new-post-name"
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? "Saving…" : "Add redirect"}
            </button>
            <button
              type="button"
              onClick={() => setBulkOpen((v) => !v)}
              className="text-sm font-medium text-[#ed2127] dark:text-[#f2454b] hover:underline"
            >
              {bulkOpen ? "Hide bulk paste" : "Paste a whole list"}
            </button>
          </div>
        </form>

        {bulkOpen && (
          <form onSubmit={handleBulk} className="space-y-3 pt-2 border-t border-black/5 dark:border-white/10">
            <div>
              <label className={labelClass}>One redirect per line: old address, then new address</label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={7}
                placeholder={"/blog/old-post -> /blog/new-post\n/neighborhoods/* -> /areas/*\n/about-me -> /about"}
                className={`${inputClass} font-mono text-xs`}
              />
              <p className={`text-xs mt-1 ${muted}`}>
                Works with "-&gt;", a comma, or a tab, so you can paste two columns straight from a spreadsheet. Pasting an
                address that's already listed updates it.
              </p>
            </div>
            <button type="submit" disabled={saving} className={primaryBtn}>
              {saving ? "Saving…" : "Add all"}
            </button>
          </form>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {notice && <p className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-3">
        <h3 className="font-display text-base font-semibold">
          Your redirects {rules.length > 0 && <span className={`text-sm font-normal ${muted}`}>({rules.length})</span>}
        </h3>
        {loading ? (
          <p className={`text-sm ${muted}`}>Loading…</p>
        ) : rules.length === 0 ? (
          <p className={`text-sm ${muted}`}>No redirects yet.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {rules.map((r) => (
              <li key={r.id} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0 text-sm space-y-0.5">
                  <p className="font-mono text-xs break-all">{r.from_path}</p>
                  <p className={`font-mono text-xs break-all ${muted}`}>→ {r.to_path}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-xs">
                  {domain && !r.from_path.includes("*") && (
                    <a
                      href={`https://${domain}${r.from_path}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#ed2127] dark:text-[#f2454b] hover:underline"
                    >
                      Test
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className={`hover:text-red-600 dark:hover:text-red-400 ${muted}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
