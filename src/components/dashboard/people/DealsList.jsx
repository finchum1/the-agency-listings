import { useMemo, useState } from "react";
import { dayLabel, toKey } from "../../../lib/homeDates";
import { ComplianceChip } from "./DealCompliance";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const control = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const SORTS = {
  closing: ["Closing date", (a, b) => (a.closing_date || "9999").localeCompare(b.closing_date || "9999")],
  newest: ["Recently updated", (a, b) => String(b.updated_at).localeCompare(String(a.updated_at))],
  price: ["Price, high to low", (a, b) => (Number(b.price) || 0) - (Number(a.price) || 0)],
  stage: ["Stage", (a, b, order) => (order.indexOf(a.stage) + 1 || 99) - (order.indexOf(b.stage) + 1 || 99)],
};

// The Deals board as a list: your own deals and the ones you coordinate for other agents, one row each. Opening a row opens the same panel a
// board card does (the agent's panel for your own, the coordinator's for the others).
export default function DealsList({ own, foreign, progress, closedStage, stages, openDeal, openForeign, agentName }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("closing");
  const [showClosed, setShowClosed] = useState(false);
  const today = toKey(new Date());

  const rows = useMemo(() => {
    const all = [...own.map((p) => ({ ...p, _agent: agentName })), ...foreign];
    const needle = q.trim().toLowerCase();
    return all
      .filter((p) => (showClosed || p.stage !== closedStage) && (!needle || `${p.name} ${p.property_address} ${p._agent}`.toLowerCase().includes(needle)))
      .sort((a, b) => SORTS[sort][1](a, b, stages) || a.name.localeCompare(b.name));
  }, [own, foreign, q, sort, showClosed, closedStage, stages, agentName]);

  const open = (p) => (p._foreign ? openForeign?.(p.id) : openDeal(p.id));
  const closing = (p) => (p.closing_date ? <span className={p.closing_date < today && p.stage !== closedStage ? "font-semibold text-red-600 dark:text-red-400" : ""}>{dayLabel(p.closing_date, today)}</span> : "–");
  const prog = (p) => {
    const v = progress[p.id];
    return v ? `${v.tasks.done}/${v.tasks.total} · ${v.docs.done}/${v.docs.total}` : "–";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search deals" aria-label="Search deals" className={`${control} w-48`} />
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort deals" className={control}>
          {Object.entries(SORTS).map(([k, [label]]) => (
            <option key={k} value={k}>{label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} className="accent-[#ed2127]" /> Show closed</label>
        <span className={`ml-auto text-xs ${muted}`}>{rows.length} deal{rows.length === 1 ? "" : "s"}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-10 text-center">
          <p className={muted}>No deals match.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                  <th className="px-5 py-3 font-medium">Deal</th>
                  <th className="px-3 py-3 font-medium">Agent</th>
                  <th className="px-3 py-3 font-medium">Stage</th>
                  <th className="px-3 py-3 font-medium">Closing</th>
                  <th className="px-3 py-3 font-medium">Price</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Tasks · Docs</th>
                  <th className="px-5 py-3 font-medium">Compliance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => open(p)} className="cursor-pointer border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                    <td className="px-5 py-3.5 min-w-[13rem]">
                      <p className="font-medium">{p.property_address || p.name}</p>
                      <p className={`text-xs ${muted}`}>{p.property_address ? `${p.name} · ` : ""}{p.side === "buyer" ? "Buyer" : p.side === "seller" ? "Seller" : "Side not set"}</p>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap">
                      {p._foreign ? (
                        <span>
                          {p._agent || "–"} <span className="ml-1 rounded-full bg-black/[0.06] dark:bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">TC</span>
                        </span>
                      ) : (
                        <span className={muted}>{agentName}</span>
                      )}
                    </td>
                    <td className={`px-3 py-3.5 text-xs whitespace-nowrap ${muted}`}>{p.stage}</td>
                    <td className="px-3 py-3.5 text-xs whitespace-nowrap">{closing(p)}</td>
                    <td className={`px-3 py-3.5 text-xs whitespace-nowrap ${muted}`}>{p.price ? money.format(p.price) : "–"}</td>
                    <td className={`px-3 py-3.5 text-xs whitespace-nowrap ${muted}`}>{prog(p)}</td>
                    <td className="px-5 py-3.5">{p.compliance_status && p.compliance_status !== "none" ? <ComplianceChip status={p.compliance_status} /> : <span className={`text-xs ${muted}`}>–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2.5">
            {rows.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => open(p)} className="block w-full rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4 text-left">
                  {p._foreign && <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45">TC for {p._agent || "another agent"}</p>}
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium leading-snug">{p.property_address || p.name}</p>
                    {p.price ? <p className="shrink-0 text-sm font-semibold">{money.format(p.price)}</p> : null}
                  </div>
                  <p className={`mt-0.5 text-xs ${muted}`}>{p.property_address ? `${p.name} · ` : ""}{p.stage}</p>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className={muted}>Closing {closing(p)}</span>
                    <span className={muted}>Tasks · Docs {prog(p)}</span>
                    {p.compliance_status && p.compliance_status !== "none" && <ComplianceChip status={p.compliance_status} />}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
