import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

// The page around a site editor (an agent's site, or the brokerage's): the name and Draft / Live at the top, what is still missing, and a menu of
// the site's pages down the left (a dropdown on a narrow screen) with the chosen page on the right, one page at a time.
//   groups   [{ title, items: [{ key, hash?, label }] }]  a page is the editor's section `key`; `hash` picks one accordion section of a form page
//   address  (item) => the address of that page
//   current  { key, hash } the page showing now (a form page with no hash is `defaultHash`)
export const itemActive = (item, section, hash) => item.key === section && (item.hash ? item.hash === hash : true);

function SiteMenu({ groups, address, section, hash }) {
  const navigate = useNavigate();
  const all = groups.flatMap((g) => g.items);
  const current = all.find((i) => itemActive(i, section, hash));
  return (
    <>
      <label className="block lg:hidden">
        <span className="sr-only">Page</span>
        <select value={current ? address(current) : ""} onChange={(e) => navigate(e.target.value)} className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-3 py-2.5 text-sm font-medium">
          {groups.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((i) => (
                <option key={address(i)} value={address(i)}>
                  {i.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <nav aria-label="Site pages" className="hidden lg:block sticky top-[4.5rem] self-start w-56 shrink-0 space-y-5">
        {groups.map((g) => (
          <div key={g.title}>
            <p className={`px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider-plus ${muted}`}>{g.title}</p>
            <ul className="space-y-0.5">
              {g.items.map((i) => {
                const active = itemActive(i, section, hash);
                return (
                  <li key={address(i)}>
                    <Link
                      to={address(i)}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                        active ? "bg-[#1c1a17]/10 dark:bg-[#faf9f7]/10 font-semibold text-[#1c1a17] dark:text-[#faf9f7]" : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10"
                      }`}
                    >
                      {i.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

// Draft or Live, from the top of the page. `status` is the current one; `onChange(next)` saves it and returns an error message or "".
function StatusSwitch({ status, onChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const change = async (next) => {
    if (next === status || busy) return;
    const ok = next === "published" ? confirm("Make this site live? Anyone with the address can see it.") : confirm("Take this site offline and back to a draft?");
    if (!ok) return;
    setBusy(true);
    setError("");
    setError((await onChange(next)) || "");
    setBusy(false);
  };
  const option = (value, label) => (
    <button
      type="button"
      onClick={() => change(value)}
      aria-pressed={status === value}
      disabled={busy}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        status === value ? (value === "published" ? "bg-emerald-600 text-white" : "bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]") : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-col items-end gap-1">
      <div role="group" aria-label="Site status" className="inline-flex rounded-full border border-black/10 dark:border-white/15 p-0.5">
        {option("draft", "Draft")}
        {option("published", "Live")}
      </div>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

// items: [{ key, label, done, to }]
function SetupChecklist({ items }) {
  if (!items || items.length === 0) return null;
  const done = items.filter((i) => i.done).length;
  const missing = items.filter((i) => !i.done);
  return (
    <section aria-label="Setup" className="rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm font-semibold">{missing.length === 0 ? "Everything is set up" : `Setup: ${done} of ${items.length} done`}</p>
        <div className="h-1.5 w-28 overflow-hidden rounded-full bg-black/10 dark:bg-white/15" aria-hidden="true">
          <div className="h-full rounded-full bg-emerald-600" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        {missing.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5">
            {missing.map((m) => (
              <li key={m.key}>
                <Link to={m.to} className="inline-flex items-center gap-1 rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs font-medium hover:bg-black/5 dark:hover:bg-white/10">
                  <span aria-hidden="true">+</span> {m.label}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export default function SiteWorkspace({ title, back, viewHref, groups, address, section, hash, status, onStatusChange, checklist, children }) {
  return (
    <div className="space-y-5">
      <div>
        {back && (
          <Link to={back.to} className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
            {back.label}
          </Link>
        )}
        <div className={`${back ? "mt-2 " : ""}flex flex-wrap items-center justify-between gap-x-6 gap-y-3`}>
          <h1 className="text-2xl font-display font-semibold">{title}</h1>
          <div className="flex items-center gap-3">
            {viewHref && (
              <a href={viewHref} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                View site ↗
              </a>
            )}
            {status && onStatusChange && <StatusSwitch status={status} onChange={onStatusChange} />}
          </div>
        </div>
      </div>

      <SetupChecklist items={checklist} />

      <div className="flex flex-col gap-6 lg:flex-row lg:gap-10">
        <SiteMenu groups={groups} address={address} section={section} hash={hash} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
