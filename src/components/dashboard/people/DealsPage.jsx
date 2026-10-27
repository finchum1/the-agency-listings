import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";
import { useDealAttention } from "../../../hooks/useDealAttention";
import { useCoordinatedDeals } from "../../../hooks/useCoordinatedDeals";
import PeopleBoard from "./PeopleBoard";
import OfficeDeals from "./OfficeDeals";
import DealsHome from "./DealsHome";
import DealsList from "./DealsList";
import DealPanel from "./DealPanel";
import StartDealModal from "./StartDealModal";

// A setting remembered in this browser (the view and filter below).
function useRemembered(key, initial, allowed) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return allowed.includes(v) ? v : initial;
    } catch {
      return initial;
    }
  });
  const set = (v) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {
      /* it just won't be remembered */
    }
  };
  return [value, set];
}

const seg = "inline-flex rounded-full bg-black/5 dark:bg-white/10 p-0.5";
const segBtn = (on) => `rounded-full px-3 py-1.5 text-xs font-semibold ${on ? "bg-white dark:bg-[#2a2a2a] shadow-sm" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`;

// Deals, on one page. An agent gets their overview and a board (or list) of their deals. A coordinator sees the deals they coordinate for other
// agents on that same board, with a filter for just those. A compliance reviewer with deals of their own gets the rest of the office as a
// review section below; a coordinator or reviewer with no board of their own gets the office list.
export default function DealsPage() {
  const { profile } = useAuth();
  const access = dealAccess(profile);
  const attention = useDealAttention(access.any);
  const [view, setView] = useRemembered("dealsView", "board", ["board", "list"]);
  const [mode, setMode] = useRemembered("dealsFilter", "all", ["all", "mine", "tc"]);
  const coordinated = useCoordinatedDeals(access.mine && access.isTc);
  const [openForeignId, setOpenForeignId] = useState(null);
  const [starting, setStarting] = useState(false);
  const [startNote, setStartNote] = useState("");
  const viewer = access.isCompliance ? "compliance" : "tc";

  // A link to one of the deals you coordinate (?deal=...) opens it once the list has loaded. Your own deals open from the board itself.
  const linkedDeal = useRef(new URLSearchParams(window.location.search).get("deal"));
  useEffect(() => {
    if (linkedDeal.current && coordinated.deals.some((d) => d.id === linkedDeal.current)) {
      setOpenForeignId(linkedDeal.current);
      linkedDeal.current = null;
    }
  }, [coordinated.deals]);

  if (access.team && !access.mine) {
    const intro = access.isCompliance
      ? "Every deal in the office. Review documents, approve, or send a deal back to the agent."
      : "Your agents' deals. You can update dates and checklists and message compliance.";
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-2xl font-display font-semibold">Deals</h1>
          <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{intro}</p>
        </div>
        <OfficeDeals viewer={viewer} />
      </div>
    );
  }

  const tcMode = access.isTc;
  const effectiveMode = tcMode ? mode : "mine";
  const foreignShown = tcMode && effectiveMode !== "mine" ? coordinated.deals : [];
  const openForeign = coordinated.deals.find((d) => d.id === openForeignId);

  const toolbar = ({ ownCount }) => (
    <>
      <div className={seg} role="group" aria-label="View">
        <button type="button" onClick={() => setView("board")} aria-pressed={view === "board"} className={segBtn(view === "board")}>Board</button>
        <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={segBtn(view === "list")}>List</button>
      </div>
      {tcMode && (
        <div className={seg} role="group" aria-label="Which deals">
          {[
            ["all", `All ${ownCount + coordinated.deals.length}`],
            ["mine", `Mine ${ownCount}`],
            ["tc", `TC deals ${coordinated.deals.length}`],
          ].map(([key, label]) => (
            <button key={key} type="button" onClick={() => setMode(key)} aria-pressed={mode === key} className={segBtn(mode === key)}>
              {label}
            </button>
          ))}
        </div>
      )}
      {tcMode && (
        <button type="button" onClick={() => setStarting(true)} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2 hover:bg-[#1c1a17]/90">
          + Start a deal for an agent
        </button>
      )}
      {startNote && <p role="status" className="basis-full text-sm text-amber-700 dark:text-amber-400">{startNote}</p>}
    </>
  );

  const waiting = access.isCompliance ? attention.to_review : 0;
  return (
    <div className="space-y-10">
      <PeopleBoard
        group="transaction"
        view={view}
        showOwn={effectiveMode !== "tc"}
        foreignDeals={foreignShown}
        onOpenForeign={setOpenForeignId}
        toolbarLeft={toolbar}
        renderList={(props) => <DealsList {...props} agentName="You" />}
        renderOverview={(props) => (
          <>
            {waiting > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("other-deals")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] px-4 py-3 text-left text-sm"
              >
                <span>
                  <span className="font-semibold">{waiting}</span> deal{waiting === 1 ? " is" : "s are"} waiting for your compliance review
                </span>
                <span className="shrink-0 font-semibold text-[#ed2127] dark:text-[#f2454b]">Review ↓</span>
              </button>
            )}
            <DealsHome {...props} />
          </>
        )}
      />

      {access.isCompliance && (
        <section id="other-deals" aria-label="Other agents' deals" className="scroll-mt-4">
          <div className="mb-4 border-t border-black/10 dark:border-white/10 pt-8">
            <h2 className="text-xl font-display font-semibold">Other agents' deals</h2>
            <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">Every deal in the office. Review documents, approve, or send a deal back to the agent.</p>
          </div>
          <OfficeDeals viewer="compliance" excludeOwn />
        </section>
      )}

      {starting && (
        <StartDealModal
          onClose={() => setStarting(false)}
          onStarted={async (id, note) => {
            setStarting(false);
            setStartNote(note);
            setMode("all");
            await coordinated.reload();
            setOpenForeignId(id);
          }}
        />
      )}
      {openForeign && (
        <DealPanel
          key={openForeign.id}
          deal={openForeign}
          agentName={openForeign._agent}
          viewer="tc"
          onClose={() => {
            setOpenForeignId(null);
            coordinated.reload();
          }}
          onChanged={() => {}}
        />
      )}
    </div>
  );
}
