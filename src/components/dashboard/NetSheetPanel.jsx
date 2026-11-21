import { MAX_EXTRA_PRICES, MAX_OTHER_LINES, netScenarios, saveFees } from "../../lib/netSheet";
import NetSheetTable from "../public/NetSheetTable";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a]";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

function Field({ label, hint, children, className = "" }) {
  return (
    <label className={`block text-xs font-medium ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
      {hint && <span className={`mt-0.5 block text-[11px] font-normal ${muted}`}>{hint}</span>}
    </label>
  );
}

// The seller's net sheet inside a CMA: the costs of selling, set once, then worked out at the CMA's low, suggested and high prices (plus any the
// agent adds). `value` is the net_sheet object (lib/netSheet.js); the page's own save handles storing it.
export default function NetSheetPanel({ value: ns, calc, onChange }) {
  const set = (patch) => {
    const next = { ...ns, ...patch };
    if ("listing_pct" in patch || "buyer_pct" in patch || "title_fee" in patch || "stamps_pct" in patch) saveFees(next);
    onChange(next);
  };
  const text = (k, props = {}) => <input value={ns[k] ?? ""} onChange={(e) => set({ [k]: e.target.value })} className={input} {...props} />;
  const money = (k, placeholder = "0") => text(k, { inputMode: "decimal", placeholder });
  const scenarios = netScenarios(ns, calc);
  const setOther = (i, patch) => set({ other: ns.other.map((o, j) => (j === i ? { ...o, ...patch } : o)) });
  const setPrice = (i, v) => set({ prices: ns.prices.map((p, j) => (j === i ? v : p)) });

  return (
    <section className={`${card} p-5 space-y-4`} aria-label="Seller net sheet">
      <div>
        <h2 className="font-display text-lg font-semibold">Seller net sheet</h2>
        <p className={`text-sm ${muted}`}>What the seller walks away with at each price. Fill in the costs once; the low, suggested and high prices above are worked out for you.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-6">
        <Field label="Loan payoff" hint="What they still owe" className="sm:col-span-2">{money("payoff")}</Field>
        <Field label="Your commission %" className="sm:col-span-2">{text("listing_pct", { inputMode: "decimal" })}</Field>
        <Field label="Buyer's agent %" className="sm:col-span-2">{text("buyer_pct", { inputMode: "decimal" })}</Field>
        <Field label="Seller concessions $" hint="Closing help for the buyer" className="sm:col-span-2">{money("concessions")}</Field>
        <Field label="Title / escrow / closing $" className="sm:col-span-2">{money("title_fee")}</Field>
        <Field label="Documentary stamps %" hint="Oklahoma: 0.15%" className="sm:col-span-2">{text("stamps_pct", { inputMode: "decimal" })}</Field>
        <Field label="Property taxes owed $" className="sm:col-span-2">{money("taxes")}</Field>
        <Field label="Home warranty $" className="sm:col-span-2">{money("warranty")}</Field>
        <Field label="Repairs and prep $" className="sm:col-span-2">{money("repairs")}</Field>
      </div>

      <div>
        <p className="text-xs font-semibold">Anything else</p>
        <ul className="mt-2 space-y-2">
          {ns.other.map((o, i) => (
            <li key={i} className="flex items-center gap-2">
              <input value={o.label} onChange={(e) => setOther(i, { label: e.target.value })} placeholder="e.g. Survey, HOA transfer fee" className={input} aria-label="Cost name" />
              <input inputMode="decimal" value={o.amount} onChange={(e) => setOther(i, { amount: e.target.value })} placeholder="$" className={`${input} max-w-[8rem]`} aria-label="Cost amount" />
              <button type="button" onClick={() => set({ other: ns.other.filter((_, j) => j !== i) })} className={quiet} aria-label="Remove cost">✕</button>
            </li>
          ))}
        </ul>
        {ns.other.length < MAX_OTHER_LINES && (
          <button type="button" onClick={() => set({ other: [...ns.other, { label: "", amount: "" }] })} className={`${quiet} mt-2`}>+ Add a cost</button>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold">Try other prices</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {ns.prices.map((p, i) => (
            <span key={i} className="flex items-center gap-1">
              <input inputMode="decimal" value={p} onChange={(e) => setPrice(i, e.target.value)} placeholder="Price" className={`${input} w-32`} aria-label={`Extra price ${i + 1}`} />
              <button type="button" onClick={() => set({ prices: ns.prices.filter((_, j) => j !== i) })} className={quiet} aria-label="Remove price">✕</button>
            </span>
          ))}
          {ns.prices.length < MAX_EXTRA_PRICES && (
            <button type="button" onClick={() => set({ prices: [...ns.prices, ""] })} className={quiet}>+ Add a price</button>
          )}
        </div>
      </div>

      {scenarios.length > 0 ? <NetSheetTable scenarios={scenarios} /> : <p className={`text-sm ${muted}`}>Add sold homes for a suggested price, or add a price above, to see the numbers.</p>}

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={Boolean(ns.show)} onChange={(e) => set({ show: e.target.checked })} className="mt-1" />
        <span>
          Show this on the client page
          <span className={`block text-xs ${muted}`}>It includes their loan payoff, so it stays off until you turn it on. Use Preview client page to see it.</span>
        </span>
      </label>
    </section>
  );
}
