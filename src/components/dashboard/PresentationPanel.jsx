import { MAX_PLAN_ITEMS, saveAbout } from "../../lib/presentation";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a]";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

// The listing presentation inside a CMA: a note to the sellers, about the agent and a marketing plan checklist, which go in front of the CMA (and the net
// sheet) in one PDF. `value` is the presentation object (lib/presentation.js); the page's own save stores it; `onDownload` makes the PDF.
export default function PresentationPanel({ value: p, onChange, onDownload, busy }) {
  const set = (patch) => onChange({ ...p, ...patch });
  const setItem = (i, patch) => set({ plan: p.plan.map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  return (
    <section className={`${card} p-5 space-y-4`} aria-label="Listing presentation">
      <div>
        <h2 className="font-display text-lg font-semibold">Listing presentation</h2>
        <p className={`text-sm ${muted}`}>For the listing appointment: a cover, a note to the sellers, a bit about you and how you'll market the home, then this CMA and the net sheet, as one PDF.</p>
      </div>

      <label className="block text-xs font-medium">
        A note to the sellers
        <textarea value={p.intro} onChange={(e) => set({ intro: e.target.value })} rows={4} maxLength={1500} placeholder="Thank you for having me in your home. Here is how I'd get it sold…" className={`${input} mt-1`} />
      </label>
      <label className="block text-xs font-medium">
        About me
        <textarea
          value={p.about}
          onChange={(e) => {
            saveAbout(e.target.value);
            set({ about: e.target.value });
          }}
          rows={4}
          maxLength={1500}
          placeholder="Your experience, your results, why sellers hire you. Remembered for your next presentation."
          className={`${input} mt-1`}
        />
      </label>

      <div>
        <p className="text-xs font-semibold">How I'll market your home</p>
        <ul className="mt-2 space-y-2">
          {p.plan.map((it, i) => (
            <li key={it.id || i} className={`flex items-start gap-2 ${it.on === false ? "opacity-60" : ""}`}>
              <input type="checkbox" checked={it.on !== false} onChange={(e) => setItem(i, { on: e.target.checked })} className="mt-2.5" aria-label={`Include "${it.title}"`} />
              <div className="min-w-0 flex-1 space-y-1">
                <input value={it.title} onChange={(e) => setItem(i, { title: e.target.value })} maxLength={80} className={`${input} font-medium`} aria-label="Marketing step" />
                <input value={it.detail} onChange={(e) => setItem(i, { detail: e.target.value })} maxLength={240} placeholder="A sentence about it" className={input} aria-label="What it means for them" />
              </div>
              <button type="button" onClick={() => set({ plan: p.plan.filter((_, j) => j !== i) })} className={`${quiet} mt-1.5`} aria-label="Remove step">✕</button>
            </li>
          ))}
        </ul>
        {p.plan.length < MAX_PLAN_ITEMS && (
          <button type="button" onClick={() => set({ plan: [...p.plan, { id: crypto.randomUUID(), title: "", detail: "", on: true }] })} className={`${quiet} mt-2`}>+ Add a step</button>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={p.include_net !== false} onChange={(e) => set({ include_net: e.target.checked })} className="mt-1" />
        <span>
          Include the net sheet
          <span className={`block text-xs ${muted}`}>Uses the net sheet above, even if it isn't shown on the client page.</span>
        </span>
      </label>

      <button type="button" onClick={onDownload} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
        {busy ? "Making the PDF…" : "Download presentation PDF"}
      </button>
    </section>
  );
}
