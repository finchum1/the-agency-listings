import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";
import { useDealAttention } from "../../../hooks/useDealAttention";
import { useCoordinatedDeals } from "../../../hooks/useCoordinatedDeals";
import { usePeekWidth } from "../../../hooks/usePeekWidth";
import { supabase } from "../../../lib/supabaseClient";
import PeopleBoard from "./PeopleBoard";
import OfficeDeals from "./OfficeDeals";
import DealsHome from "./DealsHome";
import DealsList from "./DealsList";
import DealPanel from "./DealPanel";
import StartDealModal from "./StartDealModal";
import useUrlParamSync from "../../../hooks/useUrlParamSync";

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
  const { profile, user } = useAuth();
  const access = dealAccess(profile);
  const attention = useDealAttention(access.any);
  const [view, setView] = useRemembered("dealsView", "board", ["board", "list"]);
  const [mode, setMode] = useRemembered("dealsFilter", "all", ["all", "mine", "tc"]);
  const coordinated = useCoordinatedDeals(access.mine && access.isTc);
  const [openForeignId, setOpenForeignId] = useState(null);
  const peek = usePeekWidth(true);
  const [starting, setStarting] = useState(false);
  const [agent, setAgent] = useState(""); // filter to one agent's coordinated deals
  const [boardKey, setBoardKey] = useState(0); // bumped to reload the board after a deal of your own is started here
  const [justStarted, setJustStarted] = useState(null);
  const [startNote, setStartNote] = useState("");
  const viewer = access.isCompliance ? "compliance" : "tc";

  // A link to one of the deals you coordinate (?deal=...) opens it once the list has loaded. Your own deals open from the board itself.
  useUrlParamSync("deal", openForeignId);
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
  // The agents you coordinate for, with how many deals each: the filter's choices. Picking one shows only their deals (yours step aside).
  const agentCounts = new Map();
  for (const d of coordinated.deals) if (d._agent) agentCounts.set(d.owner_id, { name: d._agent, n: (agentCounts.get(d.owner_id)?.n || 0) + 1 });
  const agentOptions = [...agentCounts.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));
  const agentOn = tcMode && agent && agentCounts.has(agent) ? agent : "";
  const effectiveMode = tcMode ? (agentOn ? "tc" : mode) : "mine";
  const foreignShown = tcMode && effectiveMode !== "mine" ? (agentOn ? coordinated.deals.filter((d) => d.owner_id === agentOn) : coordinated.deals) : [];
  const openForeign = coordinated.deals.find((d) => d.id === openForeignId);

  // Dragging a deal you coordinate to another column only changes where it sits on YOUR board; the agent's own board and stage are untouched.
  const moveForeign = async (id, stage) => {
    if (!coordinated.deals.some((x) => x.id === id)) return null;
    coordinated.setDeals((list) => list.map((x) => (x.id === id ? { ...x, _column: stage } : x)));
    const { error } = await supabase.from("deal_tc_stages").upsert({ person_id: id, tc_id: user.id, stage, updated_at: new Date().toISOString() }, { onConflict: "person_id,tc_id" });
    if (error) {
      coordinated.reload();
      return error.message;
    }
    return null;
  };

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
            <button
              key={key}
              type="button"
              onClick={() => {
                setMode(key);
                if (key !== "tc") setAgent("");
              }}
              aria-pressed={effectiveMode === key}
              className={segBtn(effectiveMode === key)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {tcMode && agentOptions.length > 0 && (
        <select
          value={agentOn}
          onChange={(e) => {
            setAgent(e.target.value);
            if (e.target.value) setMode("tc");
          }}
          aria-label="Filter by agent"
          className="rounded-full border border-black/10 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
        >
          <option value="">All agents</option>
          {agentOptions.map(([id, a]) => (
            <option key={id} value={id}>{a.name} ({a.n})</option>
          ))}
        </select>
      )}
      {access.mine && (
        <button type="button" onClick={() => setStarting(true)} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2 hover:bg-[#1c1a17]/90">
          + Start a deal
        </button>
      )}
      {startNote && <p role="status" className="basis-full text-sm text-amber-700 dark:text-amber-400">{startNote}</p>}
    </>
  );

  const waiting = access.isCompliance ? attention.to_review : 0;
  return (
    <div className="space-y-10">
      <PeopleBoard
        key={boardKey}
        initialOpenId={justStarted}
        group="transaction"
        view={view}
        showOwn={effectiveMode !== "tc"}
        foreignDeals={foreignShown}
        onOpenForeign={setOpenForeignId}
        foreignOpenId={openForeignId}
        peek={peek}
        onOwnOpened={() => {
          if (openForeignId) {
            setOpenForeignId(null);
            coordinated.reload();
          }
        }}
        onMoveForeign={moveForeign}
        toolbarLeft={toolbar}
        renderList={(props) => <DealsList {...props} agentName="You" />}
        renderOverview={(props) => {
          // The overview follows the All / Mine / TC deals filter, so its numbers match what the board below shows. Opening a deal you coordinate
          // goes to the coordinator panel; your own open in the board's panel.
          const foreignIds = new Set(foreignShown.map((d) => d.id));
          const merged = { ...props, deals: [...(effectiveMode !== "tc" ? props.deals : []), ...foreignShown], openDeal: (id) => (foreignIds.has(id) ? setOpenForeignId(id) : props.openDeal(id)) };
          return (
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
            <DealsHome {...merged} />
          </>
          );
        }}
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
          coordinator={tcMode}
          onClose={() => setStarting(false)}
          onStarted={async (id, note, own) => {
            setStarting(false);
            setStartNote(note);
            setMode("all");
            setAgent("");
            if (own) {
              // A deal of your own: reload the board and open the new deal on it.
              setJustStarted(id);
              setBoardKey((k) => k + 1);
              return;
            }
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
          peek={peek}
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
