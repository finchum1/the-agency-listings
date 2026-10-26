import { useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";
import { useDealAttention } from "../../../hooks/useDealAttention";
import PeopleBoard from "./PeopleBoard";
import OfficeDeals from "./OfficeDeals";

// Deals: an agent's own board, plus (for a coordinator or compliance) the office view. Plain agents just get their board.
export default function DealsPage() {
  const { profile } = useAuth();
  const access = dealAccess(profile);
  const attention = useDealAttention(access.any);
  const [tab, setTab] = useState(access.mine ? "mine" : "office");
  const viewer = access.isCompliance ? "compliance" : "tc";

  if (!access.team) return <PeopleBoard group="transaction" />;

  const tabs = [
    ...(access.mine ? [["mine", "My deals", 0]] : []),
    ["office", access.isCompliance ? "Office deals" : "Team deals", access.isCompliance ? attention.to_review : attention.needs_changes],
  ];
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Deals</h1>
          <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">
            {access.isCompliance ? "Every deal in the office. Review documents, approve, or send a deal back to the agent." : "Your agents' deals. You can update dates and checklists and message compliance."}
          </p>
        </div>
        {tabs.length > 1 && (
          <div className="inline-flex rounded-full bg-black/5 dark:bg-white/10 p-1" role="tablist">
            {tabs.map(([key, label, n]) => (
              <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={`rounded-full px-4 py-1.5 text-sm font-semibold ${tab === key ? "bg-white dark:bg-[#2a2a2a] shadow-sm" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60"}`}>
                {label}
                {n > 0 && <span className="ml-1.5 rounded-full bg-[#ed2127] dark:bg-[#f2454b] px-1.5 py-px text-[10px] text-white">{n}</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {tab === "mine" && access.mine ? <PeopleBoard group="transaction" /> : <OfficeDeals viewer={viewer} />}
    </div>
  );
}
