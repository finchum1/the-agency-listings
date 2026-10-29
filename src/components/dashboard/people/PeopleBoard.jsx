import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ComplianceChip } from "./DealCompliance";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import { usePeople } from "../../../hooks/usePeople";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { SIDE_TAGS } from "../../../lib/peopleSides";
import ProgressRing from "./ProgressRing";
import { useTransactionProgress } from "../../../hooks/useTransactionProgress";
import PersonPanel from "./PersonPanel";
import DraftBadge from "./DraftBadge";
import { usePeopleDrafts } from "../../../hooks/usePeopleDrafts";
import { usePeekWidth } from "../../../hooks/usePeekWidth";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import useUrlParamSync from "../../../hooks/useUrlParamSync";

const COLUMN_DRAG_TYPE = "application/x-people-column";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

function todayKey() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function followUpLabel(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// Cards sit in the order the agent dragged them into (board_position). A card with no position yet (a new person, or a
// column nobody has ordered) goes above the ordered ones, soonest follow-up first, so new people are seen first.
const compareFollowUp = (a, b) => {
  if (a.next_follow_up && b.next_follow_up) return a.next_follow_up.localeCompare(b.next_follow_up);
  if (a.next_follow_up) return -1;
  if (b.next_follow_up) return 1;
  return 0;
};
const compareCards = (a, b) => {
  const pa = a.board_position;
  const pb = b.board_position;
  if (pa != null && pb != null) return pa - pb;
  if (pa != null) return 1;
  if (pb != null) return -1;
  return compareFollowUp(a, b);
};
const sortCol = (list) => [...list].sort(compareCards);

const TILT_DEG = 3;
const DRAG_START_PX = 5;
const LONG_PRESS_MS = 350;
const COLLAPSED_KEY = (group) => `peopleCollapsedColumns:${group}`;

// What's inside a person's card: the same markup is used for the card in its column and for the card floating under
// the pointer while it is being dragged.
function PersonCardBody({ p, group, progress, today, extra }) {
  const overdue = p.next_follow_up && p.next_follow_up < today;
  const dueToday = p.next_follow_up === today;
  return (
    <>
      {p._foreign && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45 truncate">TC for {p._agent || "another agent"}</p>
      )}
      <div className="flex items-center justify-between gap-2 min-w-0">
        <p className="text-sm font-medium truncate">{p.name}</p>
        {group !== "transaction" && SIDE_TAGS[p.side] && (
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIDE_TAGS[p.side].className}`}>{SIDE_TAGS[p.side].label}</span>
        )}
      </div>
      {group === "transaction" && p.compliance_status && p.compliance_status !== "none" && (
        <ComplianceChip status={p.compliance_status} />
      )}
      {group === "transaction" && (
        <div className="space-y-0.5">
          {p.property_address && (
            <p className="text-xs text-[#1c1a17]/70 dark:text-[#faf9f7]/70 truncate">{p.property_address}</p>
          )}
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">
            {[p.side === "buyer" ? "Buyer" : p.side === "seller" ? "Seller" : "", p.price ? `$${Number(p.price).toLocaleString()}` : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
          {p.closing_date && (
            <p className="text-xs font-medium text-[#1c1a17]/70 dark:text-[#faf9f7]/70">Closes {followUpLabel(p.closing_date)}</p>
          )}
        </div>
      )}
      {group !== "transaction" && (p.phone || p.email) && (
        <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">{p.phone || p.email}</p>
      )}
      {p.next_follow_up && (
        <p
          className={`text-xs font-medium ${
            overdue
              ? "text-red-600 dark:text-red-400"
              : dueToday
                ? "text-amber-700 dark:text-amber-400"
                : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50"
          }`}
        >
          Follow up {dueToday ? "today" : followUpLabel(p.next_follow_up)}
          {overdue && " · overdue"}
        </p>
      )}
      {extra}
      {group === "transaction" && (
        <div className="flex items-center gap-3 pt-0.5">
          {[
            ["Tasks", progress[p.id]?.tasks],
            ["Docs", progress[p.id]?.docs],
          ].map(([label, v]) => (
            <div key={label} className="flex items-center gap-2 min-w-0" title={v?.total ? `${label}: ${v.done} of ${v.total} done` : `No ${label.toLowerCase()} yet`}>
              <ProgressRing done={v?.done || 0} total={v?.total || 0} size={34} stroke={4} textClass="text-[9px]" />
              <div className="leading-tight min-w-0">
                <p className="text-[11px] font-semibold">{label}</p>
                <p className="text-[11px] text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">{v?.total ? `${v.done} of ${v.total}` : "None"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

const CARD_CLASS =
  "relative bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-xl p-3 space-y-2 select-none";

function ColumnTitle({ name, onRename }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);

  const commit = async () => {
    setEditing(false);
    if (value.trim() && value.trim() !== name) await onRename(value);
    else setValue(name);
  };

  if (editing) {
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setValue(name);
            setEditing(false);
          }
        }}
        className="w-full min-w-0 rounded-md border border-black/15 dark:border-white/20 bg-transparent px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
      />
    );
  }
  return (
    <button
      type="button"
      onClick={() => {
        setValue(name);
        setEditing(true);
      }}
      title="Click to rename this column"
      className="min-w-0 truncate text-left text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] hover:underline decoration-dotted underline-offset-4"
    >
      {name}
    </button>
  );
}

const iconProps = { width: 14, height: 14, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true };
// Two chevrons pointing in: fold the column up into a strip. Pointing out: open it again.
const CollapseIcon = () => (
  <svg {...iconProps}>
    <path d="M2.5 4.5L6 8l-3.5 3.5M13.5 4.5L10 8l3.5 3.5" />
  </svg>
);
const ExpandIcon = () => (
  <svg {...iconProps}>
    <path d="M6 4.5L2.5 8 6 11.5M10 4.5l3.5 3.5-3.5 3.5" />
  </svg>
);

const menuItem =
  "w-full text-left px-3 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-40 disabled:hover:bg-transparent";

function ColumnMenu({ index, count, isTransactions, isClosed, onMove, onToggleClosed, onDelete, cadence, onCadence }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(String(cadence || ""));
  useEffect(() => setDays(String(cadence || "")), [cadence]);
  const run = (fn) => () => {
    setOpen(false);
    fn();
  };
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Column options"
        aria-expanded={open}
        className="h-6 w-6 flex items-center justify-center rounded-full text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/10 dark:hover:bg-white/15"
      >
        ⋯
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-30 cursor-default" />
          <div className="absolute right-0 top-7 z-40 w-56 overflow-hidden rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-lg text-[#1c1a17] dark:text-[#faf9f7]">
            <button type="button" className={menuItem} disabled={index === 0} onClick={run(() => onMove(index - 1))}>
              ← Move left
            </button>
            <button type="button" className={menuItem} disabled={index === count - 1} onClick={run(() => onMove(index + 1))}>
              Move right →
            </button>
            {onCadence && (
              <form
                className="border-t border-black/5 dark:border-white/10 px-3 py-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  onCadence(days);
                }}
              >
                <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                  Follow up every
                  <span className="mt-1 flex items-center gap-2">
                    <input type="number" min="0" max="1095" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} placeholder="–" aria-label="Days between follow-ups" className="w-16 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-sm" />
                    <span className="text-sm font-normal text-[#1c1a17] dark:text-[#faf9f7]">days</span>
                    <button type="submit" className="ml-auto rounded-full bg-[#1c1a17] dark:bg-[#faf9f7] px-3 py-1 text-xs font-semibold text-white dark:text-[#1c1a17]">Save</button>
                  </span>
                </label>
                <span className="mt-1 block text-[11px] leading-snug text-[#1c1a17]/50 dark:text-[#faf9f7]/50">When someone lands in this column their next follow-up is set that many days out. Leave blank for none.</span>
              </form>
            )}
            {isTransactions && (
              <button type="button" className={menuItem} disabled={isClosed} onClick={run(onToggleClosed)}>
                {isClosed ? "✓ Counts as closed deals" : "Count as closed deals"}
              </button>
            )}
            <button type="button" className={`${menuItem} text-red-600 dark:text-red-400`} onClick={run(onDelete)}>
              Delete column
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// `renderOverview` (used by Deals) draws something between the board header and the columns, and is handed what it needs to open any
// deal in the same side panel a card opens.
//
// For Deals, the board can also carry the deals this agent coordinates for other agents (`foreignDeals`): read-only cards (they open in the
// coordinator panel through `onOpenForeign`, can't be dragged) shown after the agent's own cards in the column with the same name, or in an
// extra column of their own when the owner's stage name isn't one of ours. `showOwn` hides the agent's own cards (the "TC deals" filter),
// `toolbarLeft` is the view/filter controls, and `view="list"` swaps the columns for whatever `renderList` draws.
export default function PeopleBoard({ group, renderOverview, foreignDeals = [], onOpenForeign, onMoveForeign, toolbarLeft, view = "board", showOwn = true, renderList, personFilter, cardExtra, onPeopleChanged, foreignOpenId, onOwnOpened, peek: peekProp, initialOpenId }) {
  const board = BOARDS[group];
  const { people, setPeople, loading, error, refresh } = usePeople();
  const { progress, reload: reloadProgress } = useTransactionProgress(group === "transaction");
  const { draftCounts, reloadDrafts } = usePeopleDrafts();
  const { stages: allStages, closedStage, cadenceFor, setCadence, renameStage, addStage, moveStage, removeStage, setClosedStage } = usePeopleStages();
  const stages = allStages[group];
  const nextStageNames = board.next ? allStages[board.next.group] : null;
  const prevStageNames = board.prev ? allStages[board.prev.group] : null;

  const [selectedId, setSelectedId] = useState(() => (group === "transaction" ? initialOpenId || new URLSearchParams(window.location.search).get("deal") : new URLSearchParams(window.location.search).get("person"))); // ?person= opens a lead or pipeline card (the dashboard search and quick add use it)
  useUrlParamSync(group === "transaction" ? "deal" : "person", selectedId); // the open card is in the address, so a dashboard tab remembers it
  // One side panel at a time: opening a deal you coordinate (the page's own panel, `foreignOpenId`) closes this one, and opening one of
  // yours here tells the page (`onOwnOpened`) to close that one.
  useEffect(() => {
    if (foreignOpenId && selectedId) {
      setSelectedId(null);
      reloadProgress();
      reloadDrafts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foreignOpenId]);
  useEffect(() => {
    if (selectedId) onOwnOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);
  const ownPeek = usePeekWidth(group === "transaction");
  const peek = peekProp || ownPeek; // Deals passes one shared width, so a coordinated deal's panel opens as wide as your own
  // The side peek is pinned to the window's edge, but the page content sits inset from it (more on a wide screen, where the content is
  // centered). The board only needs to give up the part of the peek that overlaps it, or the inset shows as dead space beside the peek.
  const rootRef = useRef(null);
  const [inset, setInset] = useState(0);
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [addingStage, setAddingStage] = useState(null);
  const [newPerson, setNewPerson] = useState({ name: "", phone: "", email: "", side: "" });
  const [saving, setSaving] = useState(false);
  const [boardError, setBoardError] = useState("");
  const [dragOver, setDragOver] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");

  // ---- Dragging a card ------------------------------------------------------------------------------------------
  // Cards are dragged with the pointer rather than the browser's built-in drag and drop, so the card under the cursor can
  // lift off the board (shadow, tilted a few degrees) and the spot it will land in can show as a placeholder exactly as
  // tall as the card. Order inside a column follows the follow-up date, so the placeholder sits where that date puts it.
  const [drag, setDrag] = useState(null); // { id, origin, hoverStage, hoverIndex, w, h, ox, oy } while a card is lifted
  const dragRef = useRef(null); // the live pointer state (moves every frame, so it doesn't live in React state)
  const floatRef = useRef(null);
  const boardRef = useRef(null);
  const suppressClickRef = useRef(false);
  const latest = useRef({});

  // Which columns are collapsed to a thin strip. Remembered per board in this browser.
  const [collapsed, setCollapsed] = useState([]);
  useEffect(() => {
    try {
      setCollapsed(JSON.parse(localStorage.getItem(COLLAPSED_KEY(group)) || "[]"));
    } catch {
      setCollapsed([]);
    }
  }, [group]);
  const toggleCollapsed = (stage) => {
    setCollapsed((cur) => {
      const next = cur.includes(stage) ? cur.filter((s) => s !== stage) : [...cur, stage];
      try {
        localStorage.setItem(COLLAPSED_KEY(group), JSON.stringify(next));
      } catch {
        /* storage blocked: it just won't be remembered */
      }
      return next;
    });
  };

  const floatTransform = (d) => `translate3d(${d.cx - d.ox}px, ${d.cy - d.oy}px, 0) rotate(${TILT_DEG}deg)`;

  const updateHover = useCallback(() => {
    const d = dragRef.current;
    if (!d || !d.started) return;
    const els = document.elementsFromPoint(d.cx, d.cy);
    // Your own cards can't be dropped on a column of other agents' stage names (it would put them in a column you don't have); a deal you coordinate can.
    const colEl = els.find((el) => el.dataset && el.dataset.stage !== undefined && (el.dataset.foreign === undefined || d.foreign));
    const stage = colEl ? colEl.dataset.stage : d.origin; // let go outside the board: it goes back where it was
    let index;
    if (!colEl) {
      index = d.originIndex;
    } else {
      // Where in the column: above the first card (or the placeholder) whose middle is below the pointer. Counting the
      // placeholder as it stands keeps it from jumping back and forth while the pointer rests on a boundary.
      const list = colEl.querySelector("[data-stage-list]");
      let cardsBefore = 0;
      index = null;
      for (const child of list ? list.children : []) {
        if (child.hidden) continue;
        const isPlaceholder = child.dataset.placeholder !== undefined;
        if (!isPlaceholder && (child.dataset.personId === undefined || child.dataset.foreignCard !== undefined)) continue;
        const r = child.getBoundingClientRect();
        if (d.cy < r.top + r.height / 2) {
          index = cardsBefore;
          break;
        }
        if (!isPlaceholder) cardsBefore++;
      }
      if (index === null) index = cardsBefore; // below the last card (or a collapsed/empty column): the end
    }
    if (stage !== d.hoverStage || index !== d.hoverIndex) {
      d.hoverStage = stage;
      d.hoverIndex = index;
      setDrag((cur) => (cur ? { ...cur, hoverStage: stage, hoverIndex: index } : cur));
    }
  }, []);

  const onCardPointerDown = (e, p) => {
    if (dragRef.current) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const d = {
      id: p.id,
      foreign: Boolean(p._foreign),
      origin: columnOf(p),
      originIndex: p._foreign ? 0 : sortCol(active.filter((x) => x.stage === p.stage)).findIndex((x) => x.id === p.id),
      hoverStage: p.stage,
      hoverIndex: 0,
      pointerId: e.pointerId,
      touch: e.pointerType === "touch",
      sx: e.clientX,
      sy: e.clientY,
      cx: e.clientX,
      cy: e.clientY,
      ox: e.clientX - rect.left,
      oy: e.clientY - rect.top,
      w: rect.width,
      h: rect.height,
      started: false,
      cancelled: false,
    };
    d.hoverIndex = d.originIndex;
    dragRef.current = d;
    let timer = 0;
    let raf = 0;

    const stopTouchScroll = (ev) => {
      if (d.started) ev.preventDefault();
    };

    // Scrolls the board sideways, or the column under the pointer up and down, when the card is held near an edge.
    const autoScroll = () => {
      const strip = boardRef.current;
      const speed = (past) => Math.min(20, 4 + past / 4);
      if (strip) {
        const r = strip.getBoundingClientRect();
        const edge = 64;
        if (d.cx < r.left + edge) strip.scrollLeft -= speed(r.left + edge - d.cx);
        else if (d.cx > r.right - edge) strip.scrollLeft += speed(d.cx - (r.right - edge));
      }
      const list = document.elementsFromPoint(d.cx, d.cy).find((el) => el.dataset && el.dataset.stageList !== undefined);
      if (list) {
        const r = list.getBoundingClientRect();
        const edge = 56;
        if (d.cy < r.top + edge) list.scrollTop -= speed(r.top + edge - d.cy);
        else if (d.cy > r.bottom - edge) list.scrollTop += speed(d.cy - (r.bottom - edge));
      }
    };

    const loop = () => {
      autoScroll();
      updateHover();
      raf = requestAnimationFrame(loop);
    };

    const begin = () => {
      if (d.started) return;
      d.started = true;
      clearTimeout(timer);
      suppressClickRef.current = true;
      document.body.style.userSelect = "none";
      document.body.style.cursor = "grabbing";
      window.addEventListener("touchmove", stopTouchScroll, { passive: false });
      setDrag({ id: d.id, origin: d.origin, hoverStage: d.origin, hoverIndex: d.originIndex, w: d.w, h: d.h, ox: d.ox, oy: d.oy });
      raf = requestAnimationFrame(loop);
    };

    const cleanup = () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("touchmove", stopTouchScroll);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (d.started) setTimeout(() => (suppressClickRef.current = false), 0);
      dragRef.current = null;
      setDrag(null);
    };

    function onMove(ev) {
      if (ev.pointerId !== d.pointerId) return;
      d.cx = ev.clientX;
      d.cy = ev.clientY;
      if (!d.started) {
        const dist = Math.hypot(d.cx - d.sx, d.cy - d.sy);
        if (d.touch) {
          if (dist > 10) cleanup(); // they are scrolling, not dragging
        } else if (dist > DRAG_START_PX) begin();
        return;
      }
      if (floatRef.current) floatRef.current.style.transform = floatTransform(d);
      updateHover();
    }
    function onUp(ev) {
      if (ev.pointerId !== d.pointerId) return;
      const { moveCard } = latest.current;
      const moved = d.started && !d.cancelled && (d.hoverStage !== d.origin || (!d.foreign && d.hoverIndex !== d.originIndex));
      const { id, hoverStage, hoverIndex } = d;
      cleanup();
      if (moved) moveCard(id, hoverStage, hoverIndex);
    }
    function onCancel(ev) {
      if (ev.pointerId === d.pointerId) cleanup();
    }
    function onKey(ev) {
      if (ev.key === "Escape") {
        ev.preventDefault();
        d.cancelled = true;
        cleanup();
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey, true);
    // A finger has to rest on the card for a moment first, so scrolling the board still works.
    if (d.touch) timer = setTimeout(begin, LONG_PRESS_MS);
  };

  useEffect(
    () => () => {
      // Leaving the page mid-drag: put the page back the way it was.
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    },
    [],
  );

  const inGroup = people.filter((p) => p.stage_group === group);
  const active = inGroup.filter((p) => !p.archived && (!personFilter || personFilter(p)));
  const archived = inGroup.filter((p) => p.archived);
  const selected = people.find((p) => p.id === selectedId) || null;
  const today = todayKey();

  const foreign = group === "transaction" ? foreignDeals : [];
  const mineByName = new Map(stages.map((s) => [s.toLowerCase(), s]));
  // A deal you coordinate sits in the column you put it in (_column), else the one matching the agent's stage name.
  const columnOf = (p) => (p._foreign ? mineByName.get(String(p._column || p.stage || "").toLowerCase()) || p._column || p.stage : p.stage);
  const foreignStages = [];
  for (const p of foreign) {
    const c = columnOf(p);
    if (!stages.includes(c) && !foreignStages.includes(c)) foreignStages.push(c);
  }
  const displayStages = [...stages, ...foreignStages];

  const siblings = selected && !selected.archived ? sortCol(active.filter((p) => p.stage === selected.stage)) : [];
  const siblingIdx = selected ? siblings.findIndex((p) => p.id === selected.id) : -1;

  const startAdd = (stage) => {
    setAddingStage(stage);
    setNewPerson({ name: "", phone: "", email: "" });
    setBoardError("");
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newPerson.name.trim()) return;
    setSaving(true);
    setBoardError("");
    const { error: err } = await supabase.from("people").insert({
      name: newPerson.name.trim(),
      phone: newPerson.phone.trim(),
      email: newPerson.email.trim(),
      stage_group: group,
      stage: addingStage,
      source: "Added manually",
      ...(newPerson.side ? { side: newPerson.side } : {}),
    });
    setSaving(false);
    if (err) {
      setBoardError(err.message);
      return;
    }
    setAddingStage(null);
    refresh();
  };

  // Puts a person at `index` in a column (counting the column without them) and saves the whole column's order.
  const moveCard = async (personId, stage, index) => {
    const person = people.find((p) => p.id === personId);
    if (!person) {
      // A deal you coordinate: only its stage changes (to one of the owning agent's own columns), and its place in the column is theirs to order.
      if (foreign.some((p) => p.id === personId)) {
        setBoardError("");
        const err = await onMoveForeign?.(personId, stage);
        if (err) setBoardError(err);
      }
      return;
    }
    const target = sortCol(active.filter((p) => p.stage === stage && p.id !== personId));
    const at = Math.max(0, Math.min(index, target.length));
    const ordered = [...target.slice(0, at), person, ...target.slice(at)];
    const place = new Map(ordered.map((p, i) => [p.id, i + 1]));
    setPeople((list) =>
      list.map((p) => (place.has(p.id) ? { ...p, stage: p.id === personId ? stage : p.stage, board_position: place.get(p.id) } : p)),
    );
    const { error: err } = await supabase.rpc("move_person", { p_person: personId, p_stage: stage, p_ordered: ordered.map((p) => p.id) });
    if (err) {
      setBoardError(err.message);
      refresh();
    } else if (person.stage !== stage && group !== "transaction") {
      // Landing in a column can set the next follow-up (the column's cadence); show what the database chose.
      const { data } = await supabase.from("people").select("next_follow_up").eq("id", personId).maybeSingle();
      if (data) setPeople((list) => list.map((p) => (p.id === personId ? { ...p, next_follow_up: data.next_follow_up } : p)));
    }
  };

  latest.current = { moveCard };

  const handleRename = async (oldName, newName) => {
    setBoardError("");
    const err = await renameStage(group, oldName, newName);
    if (err) setBoardError(err);
    else refresh();
  };

  const runStageChange = async (change) => {
    setBoardError("");
    const err = await change();
    if (err) setBoardError(err);
    return !err;
  };

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;
    if (await runStageChange(() => addStage(group, newColumnName))) {
      setNewColumnName("");
      setAddingColumn(false);
    }
  };

  const handleDeleteColumn = (stage) => {
    // Everyone in the column counts, archived included.
    const count = inGroup.filter((p) => p.stage === stage).length;
    if (count === 0 && !confirm(`Delete the "${stage}" column?`)) return;
    runStageChange(() => removeStage(group, stage, count));
  };

  // Measured once the board is on screen (not while it is still loading), again whenever the peek opens or the window changes size.
  const peekOpen = !!selected;
  useLayoutEffect(() => {
    const measure = () => {
      const parent = rootRef.current?.parentElement;
      if (!parent) return;
      const right = parent.getBoundingClientRect().right - (parseFloat(getComputedStyle(parent).paddingRight) || 0);
      setInset(Math.max(0, Math.round(document.documentElement.clientWidth - right)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [loading, peekOpen]);

  if (loading) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  // With the side peek open the board shrinks to the space left of it; with the phone sheet peeking it gets room below.
  return (
    <div
      ref={rootRef}
      className={`space-y-4 transition-[margin,padding] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${peek.resizing ? "!transition-none" : ""}`}
      style={{
        marginRight: peekOpen && isDesktop ? `max(0px, calc(${peek.css} - ${inset}px))` : undefined,
        paddingBottom: peekOpen && !isDesktop ? "14rem" : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-display font-semibold">{board.title}</h1>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
            {active.length + foreign.length} {group === "transaction" ? (active.length + foreign.length === 1 ? "deal" : "deals") : active.length === 1 ? "person" : "people"} · drag cards between columns, drag a column's ⋮⋮ grip (or use ⋯) to reorder, click a title to rename it, or use + to add someone.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {renderOverview && !loading && renderOverview({ deals: active, progress, closedStage, openDeal: setSelectedId, selectedId })}

      {boardError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{boardError}</p>}

      {/* The controls that belong to the board itself, right above it: view and filter on the left, adding a column on the right. */}
      <div className="flex flex-wrap items-center gap-3">
        {typeof toolbarLeft === "function" ? toolbarLeft({ ownCount: active.length }) : toolbarLeft}
        {view === "board" && (
          <>
            {addingColumn ? (
          <form onSubmit={handleAddColumn} className="flex items-center gap-2 shrink-0 sm:ml-auto">
            <input
              autoFocus
              value={newColumnName}
              onChange={(e) => setNewColumnName(e.target.value)}
              placeholder="Column name"
              className={`${inputClass} w-44`}
            />
            <button
              type="submit"
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                setAddingColumn(false);
                setNewColumnName("");
              }}
              className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              Cancel
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAddingColumn(true)}
            className="shrink-0 sm:ml-auto rounded-full border border-black/15 dark:border-white/20 px-4 py-2 text-sm font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          >
            + Add column
          </button>
        )}
          </>
        )}
      </div>

      {/* The board is a fixed-height strip: it scrolls sideways, and each
          column scrolls up and down on its own. The strip is the full board
          height (not just as tall as the shortest column), so the horizontal
          scrollbar stays pinned near the bottom of the screen. */}
      {view === "list" && renderList ? (
        renderList({ own: showOwn ? active : [], foreign, progress, closedStage, stages, openDeal: setSelectedId, openForeign: onOpenForeign, cadenceFor })
      ) : (
      <div ref={boardRef} className="flex gap-3 overflow-x-auto overflow-y-hidden h-[calc(100vh-14rem)] min-h-[26rem] -mx-1 px-1 pb-1">
        {displayStages.map((stage, stageIndex) => {
          const isForeignCol = stageIndex >= stages.length;
          const col = [...(showOwn && !isForeignCol ? sortCol(active.filter((p) => p.stage === stage)) : []), ...sortCol(foreign.filter((p) => columnOf(p) === stage))];
          const isCollapsed = collapsed.includes(stage);
          // While a card is lifted it leaves its column; the column it would land in shows a placeholder as tall as the card.
          const lifted = drag ? people.find((x) => x.id === drag.id) || foreign.find((x) => x.id === drag.id) : null;
          const others = lifted ? col.filter((x) => x.id !== lifted.id) : col;
          const showPlaceholder = !!(drag && lifted && drag.hoverStage === stage);
          const placeholderAt = showPlaceholder ? Math.min(drag.hoverIndex, others.length) : -1;
          const shownCount = others.length + (showPlaceholder ? 1 : 0);
          const dropTarget = !!drag && drag.hoverStage === stage && drag.hoverStage !== drag.origin;
          return (
            <div
              key={stage}
              data-stage={stage}
              data-foreign={isForeignCol ? "" : undefined}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(stage);
              }}
              onDragLeave={() => setDragOver((s) => (s === stage ? null : s))}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(null);
                const columnName = e.dataTransfer.getData(COLUMN_DRAG_TYPE);
                if (columnName) {
                  runStageChange(() => moveStage(group, columnName, stageIndex));
                  return;
                }
              }}
              className={`${isCollapsed ? "w-11 p-1.5" : "w-64 p-2.5"} shrink-0 h-full flex flex-col gap-2 rounded-2xl transition-colors ${
                dragOver === stage || dropTarget ? "bg-[#ed2127]/10 dark:bg-[#f2454b]/15" : "bg-black/[0.03] dark:bg-white/[0.04]"
              }`}
            >
              {isCollapsed ? (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(stage)}
                  aria-label={`Expand ${stage}`}
                  title={`Expand ${stage}`}
                  className="flex h-full w-full flex-col items-center gap-3 rounded-xl pt-1 text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                >
                  <ExpandIcon />
                  <span className="[writing-mode:vertical-rl] whitespace-nowrap text-xs font-semibold uppercase tracking-wide">
                    {stage}
                    <span className="mx-1.5 opacity-40">·</span>
                    {shownCount}
                  </span>
                </button>
              ) : (
              <>
              {isForeignCol ? (
                <div className="shrink-0 flex items-center justify-between gap-2 px-1.5 pt-1" title="Stage name used by the agent these deals belong to">
                  <span className="truncate text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{stage}</span>
                  <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{shownCount}</span>
                </div>
              ) : (
              <div className="shrink-0 flex items-center justify-between gap-2 px-1.5 pt-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(COLUMN_DRAG_TYPE, stage);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    title="Drag to reorder this column"
                    aria-hidden="true"
                    className="cursor-grab select-none text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-[#1c1a17]/60 dark:hover:text-[#faf9f7]/60 text-xs leading-none"
                  >
                    ⋮⋮
                  </span>
                  <ColumnTitle name={stage} onRename={(n) => handleRename(stage, n)} />
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mr-1">{shownCount}</span>
                  <button
                    type="button"
                    onClick={() => startAdd(stage)}
                    aria-label={`Add to ${stage}`}
                    title={`Add to ${stage}`}
                    className="h-6 w-6 flex items-center justify-center rounded-full text-base leading-none text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/10 dark:hover:bg-white/15"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCollapsed(stage)}
                    aria-label={`Collapse ${stage}`}
                    title="Collapse this column"
                    className="h-6 w-6 flex items-center justify-center rounded-full text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/10 dark:hover:bg-white/15"
                  >
                    <CollapseIcon />
                  </button>
                  <ColumnMenu
                    index={stageIndex}
                    count={stages.length}
                    isTransactions={group === "transaction"}
                    isClosed={stage === closedStage}
                    onMove={(to) => runStageChange(() => moveStage(group, stage, to))}
                    onToggleClosed={() => runStageChange(() => setClosedStage(stage))}
                    onDelete={() => handleDeleteColumn(stage)}
                    cadence={group === "transaction" ? null : cadenceFor(group, stage)}
                    onCadence={group === "transaction" ? undefined : (d) => runStageChange(() => setCadence(group, stage, d))}
                  />
                </div>
              </div>
              )}
              {group !== "transaction" && !isForeignCol && (
                <p className="shrink-0 px-1.5 text-[11px] text-[#1c1a17]/45 dark:text-[#faf9f7]/45" title="Set in the column's ⋯ menu">
                  {cadenceFor(group, stage) ? `↻ Follow up every ${cadenceFor(group, stage) === 1 ? "day" : `${cadenceFor(group, stage)} days`}` : "No follow-up reminder"}
                </p>
              )}

              {/* Each column scrolls on its own, so a long list never spills past
                  the bottom of the column or pushes the others around. */}
              <div data-stage-list="" className="flex-1 min-h-0 overflow-y-auto space-y-2 -mx-2 px-2 pt-2 pb-1 [scrollbar-width:thin]">
              {addingStage === stage && (
                <form
                  onSubmit={handleAdd}
                  className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-xl p-2.5 space-y-2"
                >
                  <input
                    required
                    autoFocus
                    value={newPerson.name}
                    onChange={(e) => setNewPerson((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Name"
                    className={inputClass}
                  />
                  <input
                    type="tel"
                    value={newPerson.phone}
                    onChange={(e) => setNewPerson((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={newPerson.email}
                    onChange={(e) => setNewPerson((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email"
                    className={inputClass}
                  />
                  {group !== "transaction" && (
                    <select
                      value={newPerson.side}
                      onChange={(e) => setNewPerson((p) => ({ ...p, side: e.target.value }))}
                      aria-label="Buyer, seller or both"
                      className={inputClass}
                    >
                      <option value="">Buyer or seller…</option>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller</option>
                      <option value="both">Both</option>
                    </select>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-60"
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingStage(null)}
                      className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {(() => {
                const out = [];
                let shownIndex = 0;
                let placed = false;
                const placeholder = (
                  <div
                    key="drop-placeholder"
                    data-placeholder=""
                    aria-hidden="true"
                    style={{ height: drag?.h }}
                    className="rounded-xl border-2 border-dashed border-[#ed2127]/40 dark:border-[#f2454b]/50 bg-[#ed2127]/[0.06] dark:bg-[#f2454b]/10"
                  />
                );
                for (const p of col) {
                  const isLifted = drag?.id === p.id;
                  if (!isLifted) {
                    if (showPlaceholder && !placed && shownIndex === placeholderAt) {
                      out.push(placeholder);
                      placed = true;
                    }
                    shownIndex++;
                  }
                  out.push(
                    <div
                      key={p.id}
                      data-person-id={p.id}
                      data-foreign-card={p._foreign ? "" : undefined}
                      hidden={isLifted}
                      onPointerDown={(e) => onCardPointerDown(e, p)}
                      onClick={() => {
                        if (suppressClickRef.current) return;
                        if (p._foreign) onOpenForeign?.(p.id);
                        else setSelectedId(p.id);
                      }}
                      className={`${CARD_CLASS} cursor-grab hover:shadow-sm transition-shadow`}
                    >
                      <PersonCardBody p={p} group={group} progress={progress} today={today} extra={cardExtra?.(p)} />
                      {!p._foreign && <DraftBadge count={draftCounts[p.id]} />}
                    </div>,
                  );
                }
                if (showPlaceholder && !placed) out.push(placeholder);
                return out;
              })()}
              {shownCount === 0 && addingStage !== stage && (
                <p className="text-xs text-[#1c1a17]/30 dark:text-[#faf9f7]/30 px-1.5 pb-2">Nobody here yet.</p>
              )}
              </div>
              </>
              )}
            </div>
          );
        })}
      </div>
      )}

      {drag && (inGroup.some((x) => x.id === drag.id) || foreign.some((x) => x.id === drag.id)) &&
        createPortal(
          <div
            ref={floatRef}
            aria-hidden="true"
            className={`${CARD_CLASS} fixed left-0 top-0 z-[70] pointer-events-none shadow-[0_24px_48px_-12px_rgba(0,0,0,0.4),0_10px_20px_-8px_rgba(0,0,0,0.25)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.8),0_10px_20px_-8px_rgba(0,0,0,0.6)]`}
            style={{
              width: drag.w,
              transformOrigin: `${drag.ox}px ${drag.oy}px`,
              transform: dragRef.current ? floatTransform(dragRef.current) : undefined,
            }}
          >
            <PersonCardBody p={people.find((x) => x.id === drag.id) || foreign.find((x) => x.id === drag.id)} group={group} progress={progress} today={today} extra={cardExtra?.(people.find((x) => x.id === drag.id))} />
            {!foreign.some((x) => x.id === drag.id) && <DraftBadge count={draftCounts[drag.id]} />}
          </div>,
          document.body,
        )}

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived((v) => !v)}
            className="text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
          >
            {showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <ul className="mt-2 space-y-2">
              {archived.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="w-full text-left border border-black/10 dark:border-white/15 rounded-xl p-3 text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                  >
                    <span className="font-medium">{p.name}</span>
                    {p.archived_reason && (
                      <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50"> · {p.archived_reason}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selected && (
        <PersonPanel
          key={selected.id}
          person={selected}
          stageNames={stages}
          nextStageNames={nextStageNames}
          prevStageNames={prevStageNames}
          peek={peek}
          position={siblingIdx >= 0 ? siblingIdx + 1 : 0}
          total={siblings.length}
          onPrev={siblingIdx > 0 ? () => setSelectedId(siblings[siblingIdx - 1].id) : undefined}
          onNext={siblingIdx >= 0 && siblingIdx < siblings.length - 1 ? () => setSelectedId(siblings[siblingIdx + 1].id) : undefined}
          onClose={() => {
            setSelectedId(null);
            reloadProgress();
            reloadDrafts();
          }}
          onChanged={() => {
            refresh();
            reloadProgress();
            onPeopleChanged?.();
          }}
          cadence={group === "transaction" ? null : cadenceFor(group, selected.stage)}
        />
      )}
    </div>
  );
}
