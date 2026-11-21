import { formatPrice } from "../../lib/format";

// A seller's net sheet as a table: one column per price, the costs down the side, and what the seller walks away with at the bottom. Used on the
// client's CMA page. `scenarios` come from netScenarios (lib/netSheet.js).
const money = (n) => (n < 0 ? `−${formatPrice(-n)}` : formatPrice(n));

export default function NetSheetTable({ scenarios }) {
  if (!scenarios?.length) return null;
  // Every cost that shows up in any column, in the order the first column lists them, so the rows line up.
  const rows = [];
  for (const s of scenarios) for (const l of s.lines) if (!rows.some((r) => r.key === l.key)) rows.push({ key: l.key, label: l.label });
  const cell = "px-3 py-2 text-right tabular-nums";
  const hasPayoff = scenarios.some((s) => s.payoff);
  return (
    <div className="overflow-x-auto rounded-2xl bg-white border border-black/[0.06] print:border-black/20">
      <table className="w-full min-w-[28rem] text-sm">
        <thead>
          <tr className="border-b border-black/10 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1c1a17]/50">
            <th scope="col" className="px-3 py-3 text-left">If it sells for</th>
            {scenarios.map((s, i) => (
              <th key={i} scope="col" className="px-3 py-3 text-right">{s.label}</th>
            ))}
          </tr>
          <tr className="border-b border-black/10">
            <th scope="row" className="px-3 py-3 text-left font-normal text-[#1c1a17]/60">Sale price</th>
            {scenarios.map((s, i) => (
              <td key={i} className={`${cell} font-display text-lg font-semibold`}>{formatPrice(s.price)}</td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-black/[0.06] text-[#1c1a17]/75">
              <th scope="row" className="px-3 py-2 text-left font-normal">{r.label}</th>
              {scenarios.map((s, i) => {
                const line = s.lines.find((l) => l.key === r.key);
                return <td key={i} className={cell}>{line ? money(-line.amount) : "—"}</td>;
              })}
            </tr>
          ))}
          {hasPayoff && (
            <tr className="border-b border-black/[0.06] text-[#1c1a17]/75">
              <th scope="row" className="px-3 py-2 text-left font-normal">Loan payoff</th>
              {scenarios.map((s, i) => (
                <td key={i} className={cell}>{money(-s.payoff)}</td>
              ))}
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="bg-[#1c1a17] text-white print:bg-black/[0.06] print:text-[#1c1a17]">
            <th scope="row" className="px-3 py-3 text-left font-semibold">What you walk away with</th>
            {scenarios.map((s, i) => (
              <td key={i} className="px-3 py-3 text-right font-display text-lg font-semibold tabular-nums">{money(s.net)}</td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
