import { useState } from "react";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { usePeopleGoals } from "../../../hooks/usePeopleGoals";
import ProgressRing from "../people/ProgressRing";
import { card, muted } from "./styles";

const money = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

function MonthBars({ values, current }) {
  const max = Math.max(...values, 1);
  return (
    <svg viewBox="0 0 240 70" className="w-full h-[70px]" role="img" aria-label="Commission closed by month">
      {values.map((v, i) => {
        const h = v > 0 ? Math.max(4, (v / max) * 46) : 2;
        return (
          <g key={i}>
            <rect
              x={i * 20 + 3}
              y={52 - h}
              width="14"
              height={h}
              rx="3"
              className={v > 0 ? (i === current ? "fill-[#ed2127] dark:fill-[#f2454b]" : "fill-[#1c1a17]/55 dark:fill-[#faf9f7]/55") : "fill-black/10 dark:fill-white/15"}
            >
              <title>{`${new Date(2000, i, 1).toLocaleString(undefined, { month: "long" })}: ${money.format(v)}`}</title>
            </rect>
            <text x={i * 20 + 10} y="66" textAnchor="middle" className={`text-[9px] ${i === current ? "fill-[#ed2127] dark:fill-[#f2454b] font-semibold" : "fill-[#1c1a17]/45 dark:fill-[#faf9f7]/45"}`}>
              {MONTHS[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// This year's closed deals and commission against the agent's own goal, what is still pending, and a month-by-month view.
// Closed means the Transactions column the agent marked as "closed" (usePeopleStages), the same rule the People overview uses.
export default function ScorecardCard({ userId }) {
  const { people, loading } = usePeople();
  const { closedStage } = usePeopleStages();
  const { goals, saveGoal } = usePeopleGoals(userId, true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ commission: "", deals: "", priorDeals: "", priorVolume: "", priorCommission: "" });
  const [error, setError] = useState("");

  const now = new Date();
  const year = now.getFullYear();
  const goal = goals[year] || {};
  const commissionGoal = Number(goal.commission) || 0;
  const dealsGoal = Number(goal.deals) || 0;
  // Production from before the agent started tracking here this year (joined mid-year, or deals closed elsewhere).
  const prior = { deals: Number(goal.prior?.deals) || 0, volume: Number(goal.prior?.volume) || 0, commission: Number(goal.prior?.commission) || 0 };
  const hasPrior = prior.deals > 0 || prior.volume > 0 || prior.commission > 0;

  const transactions = people.filter((p) => !p.archived && p.stage_group === "transaction");
  const open = transactions.filter((p) => p.stage !== closedStage);
  const closedDate = (p) => p.closing_date || (p.updated_at || "").slice(0, 10);
  const closed = transactions.filter((p) => p.stage === closedStage && Number(closedDate(p).slice(0, 4)) === year);
  const sum = (list, key) => list.reduce((t, p) => t + (Number(p[key]) || 0), 0);
  const earned = sum(closed, "commission") + prior.commission;
  const closedCount = closed.length + prior.deals;
  const closedVolume = sum(closed, "price") + prior.volume;
  const monthly = Array.from({ length: 12 }, (_, m) => sum(closed.filter((p) => Number(closedDate(p).slice(5, 7)) - 1 === m), "commission"));

  // Pace: where the year-to-date total would be if the goal were spread evenly across the year.
  const dayOfYear = Math.floor((now - new Date(year, 0, 0)) / 864e5);
  const daysInYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 366 : 365;
  const target = commissionGoal * (dayOfYear / daysInYear);
  const ringDone = commissionGoal ? earned : closedCount;
  const ringTotal = commissionGoal || dealsGoal;

  const startEdit = () => {
    setDraft({
      commission: commissionGoal || "",
      deals: dealsGoal || "",
      priorDeals: prior.deals || "",
      priorVolume: prior.volume || "",
      priorCommission: prior.commission || "",
    });
    setError("");
    setEditing(true);
  };
  const submit = async (e) => {
    e.preventDefault();
    const message = await saveGoal(year, {
      commission: Number(draft.commission) || 0,
      deals: Number(draft.deals) || 0,
      prior: { deals: Number(draft.priorDeals) || 0, volume: Number(draft.priorVolume) || 0, commission: Number(draft.priorCommission) || 0 },
    });
    if (message) setError(message);
    else setEditing(false);
  };

  return (
    <section className={`${card} flex flex-col`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">Scorecard · {year}</h2>
        {!editing && (
          <button type="button" onClick={startEdit} title="Edit your goal and past production" className="shrink-0 text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
            {ringTotal || hasPrior ? "Edit" : "Set a goal"}
          </button>
        )}
      </div>

      {loading ? (
        <p className={`text-sm mt-4 ${muted}`}>Loading…</p>
      ) : (
        <>
          {editing ? (
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Commission goal for {year} ($)</label>
                <input type="number" min="0" step="any" inputMode="decimal" value={draft.commission} onChange={(e) => setDraft((d) => ({ ...d, commission: e.target.value }))} className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Closed deals goal (optional)</label>
                <input type="number" min="0" step="1" inputMode="numeric" value={draft.deals} onChange={(e) => setDraft((d) => ({ ...d, deals: e.target.value }))} className={inputClass} />
              </div>
              <div className="pt-3 border-t border-black/5 dark:border-white/10 space-y-3">
                <div>
                  <p className="text-xs font-semibold">Closed before you started tracking here</p>
                  <p className={`text-[11px] mt-0.5 leading-snug ${muted}`}>
                    Joined mid-year, or closed deals elsewhere? Add this year's earlier production and it counts toward your totals and goal. Deals you track here are added on top.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Units</label>
                    <input type="number" min="0" step="1" inputMode="numeric" value={draft.priorDeals} onChange={(e) => setDraft((d) => ({ ...d, priorDeals: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Volume ($)</label>
                    <input type="number" min="0" step="any" inputMode="decimal" value={draft.priorVolume} onChange={(e) => setDraft((d) => ({ ...d, priorVolume: e.target.value }))} className={inputClass} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 text-[#1c1a17]/60 dark:text-[#faf9f7]/60">Commission ($)</label>
                    <input type="number" min="0" step="any" inputMode="decimal" value={draft.priorCommission} onChange={(e) => setDraft((d) => ({ ...d, priorCommission: e.target.value }))} className={inputClass} />
                  </div>
                </div>
              </div>
              {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex items-center gap-3">
                <button type="submit" className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-5 py-2">
                  Save
                </button>
                <button type="button" onClick={() => setEditing(false)} className={`text-xs ${muted}`}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="mt-4 flex items-center gap-4">
              {ringTotal > 0 && <ProgressRing done={Math.min(ringDone, ringTotal)} total={ringTotal} size={72} stroke={7} textClass="text-xs" />}
              <div className="min-w-0">
                <p className="text-3xl font-semibold leading-none">{money.format(earned)}</p>
                <p className={`text-xs mt-1.5 ${muted}`}>
                  {commissionGoal ? `of ${money.format(commissionGoal)} goal` : "commission earned this year"}
                </p>
                {commissionGoal > 0 && (
                  <p className={`text-xs mt-0.5 font-medium ${earned >= target ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {earned >= target ? "On pace" : `${compact.format(target - earned)} behind pace`}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-black/5 dark:border-white/10">
            <div>
              <p className="text-xl font-semibold leading-none">
                {closedCount}
                {dealsGoal > 0 && <span className={`text-xs font-medium ${muted}`}> / {dealsGoal}</span>}
              </p>
              <p className={`text-[11px] mt-1.5 ${muted}`}>Closed deals</p>
            </div>
            <div>
              <p className="text-xl font-semibold leading-none">{compact.format(closedVolume)}</p>
              <p className={`text-[11px] mt-1.5 ${muted}`}>Closed volume</p>
            </div>
            <div>
              <p className="text-xl font-semibold leading-none">{compact.format(sum(open, "commission"))}</p>
              <p className={`text-[11px] mt-1.5 ${muted}`}>
                Pending · {open.length} deal{open.length === 1 ? "" : "s"}
              </p>
            </div>
          </div>

          {hasPrior && (
            <p className={`mt-3 text-[11px] leading-snug ${muted}`}>
              Includes {prior.deals} deal{prior.deals === 1 ? "" : "s"}, {compact.format(prior.volume)} volume and {compact.format(prior.commission)} commission you added from before you started tracking here.
            </p>
          )}
          <div className="mt-3">
            <MonthBars values={monthly} current={now.getMonth()} />
          </div>
        </>
      )}
    </section>
  );
}
