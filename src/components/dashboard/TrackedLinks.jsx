import { useState } from "react";
import { taggedUrl } from "../../lib/listingAnalytics";

const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5";
const quietBtn = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";

export function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
  };
  return [copied, copy];
}

// Links for each place an address gets shared, so the analytics can say where visitors came from.
export default function TrackedLinks({ base, channels, what = "this listing" }) {
  const [copied, copy] = useCopy();
  const [custom, setCustom] = useState("");
  const tag = custom.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  return (
    <div className={card}>
      <h3 className="font-display text-base font-semibold">Track where visitors come from</h3>
      <p className={`text-xs mt-1 ${muted}`}>Use a different link for each place you share {what}. Visits through it show up under that name in “Where visitors came from.”</p>
      <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
        {channels.map((c) => {
          const url = taggedUrl(base, c.src);
          return (
            <li key={c.src} className="py-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{c.label}</p>
                <p className={`text-xs truncate font-mono ${muted}`}>{url}</p>
              </div>
              <button type="button" onClick={() => copy(c.src, url)} className={`${quietBtn} shrink-0`}>
                {copied === c.src ? "Copied ✓" : "Copy link"}
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Something else, e.g. open-house-sign" aria-label="Custom source name" className="flex-1 min-w-0 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm" />
        <button type="button" disabled={!tag} onClick={() => copy("custom", taggedUrl(base, tag))} className={`${quietBtn} shrink-0 disabled:opacity-40`}>
          {copied === "custom" ? "Copied ✓" : "Copy link"}
        </button>
      </div>
    </div>
  );
}
