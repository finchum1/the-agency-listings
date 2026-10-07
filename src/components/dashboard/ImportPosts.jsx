import { useMemo, useState } from "react";
import { adminApi } from "../../lib/adminApi";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

function pathOf(url) {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

// Admin-only: bring a client's posts over from their old site. Each address
// is fetched by the server (api/_lib/importPost.js) and saved as a DRAFT
// with the same address ending, so nothing goes live until it's reviewed
// and published, and the post keeps its old address (no redirect needed).
export default function ImportPosts({ agentSiteId, onImported }) {
  const [open, setOpen] = useState(false);
  const [site, setSite] = useState("");
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState([]);
  const [filter, setFilter] = useState("/blog/");
  const [selected, setSelected] = useState(() => new Set());
  const [manual, setManual] = useState("");
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState([]);
  const [error, setError] = useState("");

  const visible = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return found.filter((u) => (!f || u.toLowerCase().includes(f)) && !/\/blog\/?$/i.test(pathOf(u)));
  }, [found, filter]);

  const manualUrls = useMemo(
    () => manual.split(/\r?\n/).map((l) => l.trim()).filter((l) => /^https?:\/\//i.test(l)),
    [manual],
  );
  const queue = useMemo(() => [...new Set([...visible.filter((u) => selected.has(u)), ...manualUrls])], [visible, selected, manualUrls]);

  const find = async (e) => {
    e.preventDefault();
    setFinding(true);
    setError("");
    try {
      const { urls } = await adminApi({ action: "list-sitemap", site });
      setFound(urls);
      const hasBlog = urls.some((u) => /\/blog\//i.test(u));
      setFilter(hasBlog ? "/blog/" : "");
      setSelected(new Set(urls.filter((u) => (hasBlog ? /\/blog\//i.test(u) : true) && !/\/blog\/?$/i.test(pathOf(u)))));
    } catch (err) {
      setError(err.message);
    } finally {
      setFinding(false);
    }
  };

  const toggle = (u) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(u)) next.delete(u);
      else next.add(u);
      return next;
    });

  const allVisibleSelected = visible.length > 0 && visible.every((u) => selected.has(u));
  const toggleAll = () =>
    setSelected((s) => {
      const next = new Set(s);
      visible.forEach((u) => (allVisibleSelected ? next.delete(u) : next.add(u)));
      return next;
    });

  const run = async () => {
    setRunning(true);
    setError("");
    setResults([]);
    for (const url of queue) {
      let row;
      try {
        const r = await adminApi({ action: "import-post", agentSiteId, url });
        row = { url, ...r };
      } catch (err) {
        row = { url, ok: false, status: "failed", error: err.message };
      }
      setResults((list) => [...list, row]);
    }
    setRunning(false);
    onImported?.();
  };

  const imported = results.filter((r) => r.status === "imported").length;
  const skipped = results.filter((r) => r.status === "skipped").length;
  const failed = results.filter((r) => r.status === "failed").length;

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Import posts from another site</h2>
          <p className={`text-sm mt-1 ${muted}`}>
            Admin only. Moving a client from another platform? Pull their posts over as drafts, with the same address
            ending, date, summary and cover image.
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-sm font-medium text-[#ed2127] dark:text-[#f2454b] hover:underline shrink-0">
          {open ? "Hide" : "Open"}
        </button>
      </div>

      {open && (
        <div className="space-y-5">
          <form onSubmit={find} className="space-y-2">
            <label className={labelClass}>The old site's address (or its sitemap address)</label>
            <div className="flex gap-2 flex-wrap">
              <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="theirdomain.com" className={`${inputClass} flex-1 min-w-48`} />
              <button type="submit" disabled={finding || !site.trim()} className={primaryBtn}>
                {finding ? "Looking…" : "Find posts"}
              </button>
            </div>
          </form>

          {found.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm font-medium">
                  {visible.length} page{visible.length === 1 ? "" : "s"} shown · {queue.length} selected
                </p>
                <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAll} /> Select all shown
                </label>
              </div>
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Only addresses containing…" className={inputClass} />
              <ul className="max-h-64 overflow-y-auto rounded-lg border border-black/10 dark:border-white/15 divide-y divide-black/5 dark:divide-white/10">
                {visible.map((u) => (
                  <li key={u}>
                    <label className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                      <input type="checkbox" checked={selected.has(u)} onChange={() => toggle(u)} />
                      <span className="font-mono break-all">{pathOf(u)}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label className={labelClass}>Or paste post addresses (one full web address per line)</label>
            <textarea
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              rows={3}
              placeholder="https://theirdomain.com/blog/some-post"
              className={`${inputClass} font-mono text-xs`}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-4 flex-wrap">
            <button type="button" onClick={run} disabled={running || queue.length === 0} className={primaryBtn}>
              {running ? `Importing… ${results.length}/${queue.length}` : `Import ${queue.length} post${queue.length === 1 ? "" : "s"} as drafts`}
            </button>
            <p className={`text-xs ${muted}`}>Posts whose address already exists here are skipped, never overwritten.</p>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {imported} imported{skipped ? ` · ${skipped} skipped` : ""}
                {failed ? ` · ${failed} failed` : ""}
                {running ? " …" : ""}
              </p>
              <ul className="max-h-72 overflow-y-auto rounded-lg border border-black/10 dark:border-white/15 divide-y divide-black/5 dark:divide-white/10">
                {results.map((r) => (
                  <li key={r.url} className="px-3 py-2 text-xs space-y-0.5">
                    <p className="font-medium">
                      <span className={r.status === "imported" ? "text-emerald-700 dark:text-emerald-400" : r.status === "skipped" ? muted : "text-red-600 dark:text-red-400"}>
                        {r.status === "imported" ? "✓" : r.status === "skipped" ? "–" : "✗"}
                      </span>{" "}
                      {r.title || pathOf(r.url)}
                    </p>
                    {r.status === "skipped" && <p className={muted}>{r.reason}</p>}
                    {r.status === "failed" && <p className="text-red-600 dark:text-red-400">{r.error}</p>}
                    {(r.warnings || []).map((w) => (
                      <p key={w} className="text-amber-700 dark:text-amber-400">{w}</p>
                    ))}
                  </li>
                ))}
              </ul>
              {!running && imported > 0 && <p className={`text-xs ${muted}`}>The new drafts are in the post list above. Review each one, then publish.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
