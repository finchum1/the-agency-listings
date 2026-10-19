import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { fromKey } from "../../../lib/homeDates";
import { DAY_MIN, HOUR_PX, SNAP, clamp, layoutDay, minLabel, rangeLabel, snapMin } from "../../../lib/timeGrid";
import { muted } from "./styles";

const GUTTER = 52;
const MIN_BLOCK = 15; // the shortest block a drag can make, in minutes
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hairline = "rgba(120,113,108,0.22)";

const hex2rgba = (hex, a) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

// An hourly day or week view. Appointments and time-blocked tasks sit in the grid at their time and length. Drag a
// block to move it (to another time or another day), drag its bottom edge to change its length, drag across empty
// space to make a new one (or just click/tap a slot), and drag a task from the "To schedule" list onto the grid to
// block time for it. On a touch screen a block or task needs a short press before it can be dragged, so scrolling
// still works. What a drag *does* is up to the caller: this component only reports the new date and times.
export default function TimeGrid({ days, today, itemsFor, tray, onOpen, onCreate, onMove, onToggleTask, onPickTask, onScheduleTask, onDayClick }) {
  const scrollRef = useRef(null);
  const colRefs = useRef({});
  const headRef = useRef(null);
  const [preview, setPreview] = useState(null); // { id, date, startMin, endMin, kind } while something is being dragged
  const previewRef = useRef(null);
  const [ghost, setGhost] = useState(null); // { label, x, y } follows the pointer while a "To schedule" task is dragged
  const [now, setNow] = useState(() => new Date());
  const callbacks = useRef({});
  callbacks.current = { onOpen, onCreate, onMove, onScheduleTask };

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Only re-render when the dragged block actually lands somewhere new (pointer moves fire far more often than that).
  const setPrev = (p) => {
    const c = previewRef.current;
    if (c === p || (c && p && c.id === p.id && c.kind === p.kind && c.date === p.date && c.startMin === p.startMin && c.endMin === p.endMin)) return;
    previewRef.current = p;
    setPreview(p);
  };

  // Scroll to the first block of the visible days (an hour above it), or to the working day if there is none.
  const firstMin = days.reduce((m, k) => itemsFor(k).timed.reduce((mm, it) => Math.min(mm, it.startMin), m), DAY_MIN);
  const daysKey = days.join(",");
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const target = firstMin < DAY_MIN ? firstMin - 60 : 7 * 60;
    el.scrollTop = Math.max(0, (target / 60) * HOUR_PX);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysKey]);

  // Which day column and minute is under a point on screen. `lockKey` pins the column (a resize stays on its own day).
  const hit = (x, y, lockKey) => {
    const keys = lockKey ? [lockKey] : days;
    let best = null;
    for (const key of keys) {
      const el = colRefs.current[key];
      if (!el) continue;
      const r = el.getBoundingClientRect();
      if (lockKey || (x >= r.left && x < r.right)) best = { key, min: ((y - r.top) / HOUR_PX) * 60, rect: r };
    }
    if (!best && !lockKey && days.length) {
      // Past the left or right edge of the grid: stick to the nearest column so the block doesn't flicker back.
      const first = colRefs.current[days[0]]?.getBoundingClientRect();
      const last = colRefs.current[days[days.length - 1]]?.getBoundingClientRect();
      if (first && last) {
        const key = x < first.left ? days[0] : days[days.length - 1];
        const r = x < first.left ? first : last;
        best = { key, min: ((y - r.top) / HOUR_PX) * 60, rect: r };
      }
    }
    return best;
  };

  // One gesture at a time, driven by window listeners so a fast drag can't outrun the element it started on.
  // kind: "move" (a block), "resize" (a block's bottom edge), "create" (empty space), "tray" (a task from the list).
  const begin = (e, g) => {
    if (e.button != null && e.button !== 0) return;
    const touch = e.pointerType === "touch";
    const st = { x0: e.clientX, y0: e.clientY, active: false };
    let timer = null;
    let last = e;
    const scroller = scrollRef.current;

    // The day names and the all-day strip are one sticky block; a point inside it means "all day".
    const overHead = (ev) => {
      const r = headRef.current?.getBoundingClientRect();
      const sr = scroller.getBoundingClientRect();
      return Boolean(r && ev.clientY >= sr.top && ev.clientY <= r.bottom && ev.clientX >= sr.left && ev.clientX <= sr.right);
    };

    const update = (ev) => {
      const sr = scroller.getBoundingClientRect();
      const headBottom = headRef.current?.getBoundingClientRect().bottom ?? sr.top;
      // Near the top or bottom edge of the hours, keep scrolling so a block can be dragged to an hour that's off screen.
      if (g.kind !== "tray" || (ev.clientX >= sr.left && ev.clientX <= sr.right)) {
        if (ev.clientY > headBottom && ev.clientY < headBottom + 36) scroller.scrollTop -= 12;
        else if (ev.clientY > sr.bottom - 36) scroller.scrollTop += 12;
      }
      if (g.kind === "move") {
        const p = hit(ev.clientX, ev.clientY);
        if (!p) return;
        if (g.item.kind === "task" && overHead(ev)) {
          setPrev({ id: g.item.id, kind: "allday", date: p.key, label: g.item.title });
          return;
        }
        const dur = g.item.endMin - g.item.startMin;
        const startMin = clamp(snapMin(p.min - g.grab), 0, DAY_MIN - dur);
        setPrev({ id: g.item.id, kind: "move", date: p.key, startMin, endMin: startMin + dur });
      } else if (g.kind === "resize") {
        const p = hit(ev.clientX, ev.clientY, g.item.date);
        if (!p) return;
        const endMin = clamp(snapMin(p.min), g.item.startMin + MIN_BLOCK, DAY_MIN);
        setPrev({ id: g.item.id, kind: "resize", date: g.item.date, startMin: g.item.startMin, endMin });
      } else if (g.kind === "create") {
        const p = hit(ev.clientX, ev.clientY, g.date);
        if (!p) return;
        const a = clamp(snapMin(Math.min(g.anchor, p.min), SNAP), 0, DAY_MIN - MIN_BLOCK);
        const b = clamp(snapMin(Math.max(g.anchor, p.min), SNAP), a + MIN_BLOCK, DAY_MIN);
        setPrev({ id: "new", kind: "create", date: g.date, startMin: a, endMin: b });
      } else if (g.kind === "tray") {
        // A task from the "To schedule" list or an all-day chip: drop on the grid for a time, or on the strip for a day.
        setGhost({ label: g.task.title, x: ev.clientX, y: ev.clientY });
        const inside = ev.clientY >= sr.top && ev.clientY <= sr.bottom && ev.clientX >= sr.left && ev.clientX <= sr.right;
        const p = inside ? hit(ev.clientX, ev.clientY) : null;
        if (!p) setPrev(null);
        else if (overHead(ev)) setPrev({ id: "tray", srcId: g.srcId, kind: "allday", date: p.key, label: g.task.title });
        else {
          const startMin = clamp(snapMin(p.min - 15), 0, DAY_MIN - 60);
          setPrev({ id: "tray", srcId: g.srcId, kind: "tray", date: p.key, startMin, endMin: startMin + 60 });
        }
      }
    };

    const blockTouchScroll = (ev) => {
      if (st.active) ev.preventDefault();
    };
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("touchmove", blockTouchScroll);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setGhost(null);
      setPrev(null);
    };
    const dragStyle = () => {
      document.body.style.userSelect = "none";
      document.body.style.cursor = g.kind === "resize" ? "ns-resize" : "grabbing";
    };
    const activate = () => {
      st.active = true;
      dragStyle();
      try {
        navigator.vibrate?.(8);
      } catch {
        /* not available */
      }
      update(last);
    };
    const move = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      last = ev;
      const dist = Math.hypot(ev.clientX - st.x0, ev.clientY - st.y0);
      if (!st.active) {
        // A finger that moves before the press registers is scrolling; leave it alone.
        if (touch && g.kind !== "resize") {
          if (dist > 8) cleanup();
          return;
        }
        if (dist < 4) return;
        st.active = true;
        dragStyle();
      }
      update(ev);
    };
    const up = (ev) => {
      if (ev.pointerId !== e.pointerId) return;
      const p = previewRef.current;
      const wasActive = st.active;
      cleanup();
      const cb = callbacks.current;
      if (g.kind === "move") {
        if (wasActive && p) cb.onMove(g.item, p.kind === "allday" ? { date: p.date, allDay: true } : { date: p.date, startMin: p.startMin, endMin: p.endMin });
        else if (!wasActive) cb.onOpen(g.item);
      } else if (g.kind === "resize") {
        if (wasActive && p) cb.onMove(g.item, { date: p.date, startMin: p.startMin, endMin: p.endMin });
      } else if (g.kind === "create") {
        if (wasActive && p) cb.onCreate({ date: p.date, startMin: p.startMin, endMin: p.endMin });
        else if (!wasActive) {
          const startMin = clamp(Math.floor(g.anchor / 30) * 30, 0, DAY_MIN - 60);
          cb.onCreate({ date: g.date, startMin, endMin: startMin + 60 });
        }
      } else if (g.kind === "tray") {
        if (wasActive && p) cb.onScheduleTask(g.task, p.kind === "allday" ? { date: p.date, allDay: true } : { date: p.date, startMin: p.startMin, endMin: p.endMin });
        else if (!wasActive) g.onClick?.();
      }
    };
    const cancel = (ev) => {
      if (ev.pointerId === e.pointerId) cleanup();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("touchmove", blockTouchScroll, { passive: false });
    if (touch && (g.kind === "move" || g.kind === "tray")) timer = setTimeout(activate, 320);
    else if (touch && g.kind === "resize") {
      st.active = true;
      dragStyle();
    }
  };

  const startOnEmpty = (e, key) => {
    if (e.target !== e.currentTarget) return;
    const r = e.currentTarget.getBoundingClientRect();
    begin(e, { kind: "create", date: key, anchor: ((e.clientY - r.top) / HOUR_PX) * 60 });
  };

  const startOnBlock = (e, item) => {
    e.stopPropagation();
    if (!item.editable) return;
    const r = colRefs.current[item.date]?.getBoundingClientRect();
    const grab = r ? ((e.clientY - r.top) / HOUR_PX) * 60 - item.startMin : 0;
    begin(e, { kind: "move", item, grab });
  };

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const cols = days.length;

  return (
    <div className={`flex flex-col gap-4 items-start ${cols === 1 ? "lg:flex-row" : ""}`}>
      <div
        ref={scrollRef}
        className="relative min-w-0 w-full flex-1 overflow-auto rounded-xl border border-black/10 dark:border-white/15 max-h-[min(72vh,640px)] overscroll-contain"
        data-testid="time-grid"
      >
        <div style={{ minWidth: cols > 1 ? GUTTER + cols * 112 : undefined }}>
          {/* day names and the all-day strip stay put while the hours scroll */}
          <div ref={headRef} className="sticky top-0 z-30 bg-white dark:bg-[#1a1a1a] border-b border-black/10 dark:border-white/15">
            <div className="grid" style={{ gridTemplateColumns: `${GUTTER}px repeat(${cols}, minmax(0, 1fr))` }}>
              <div />
              {days.map((key) => {
                const d = fromKey(key);
                const isToday = key === today;
                const label = (
                  <>
                    <span className={`block text-[11px] font-semibold uppercase tracking-wide ${isToday ? "text-[#ed2127] dark:text-[#f2454b]" : muted}`}>{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-sm font-semibold ${isToday ? "bg-[#ed2127] dark:bg-[#f2454b] text-white" : ""}`}>{d.getDate()}</span>
                  </>
                );
                return onDayClick && cols > 1 ? (
                  <button key={key} type="button" onClick={() => onDayClick(key)} className="py-1.5 text-center hover:bg-black/[0.03] dark:hover:bg-white/[0.05]" aria-label={`Open ${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}`}>
                    {label}
                  </button>
                ) : (
                  <div key={key} className="py-1.5 text-center">
                    {label}
                  </div>
                );
              })}
            </div>
            <div className="grid border-t border-black/5 dark:border-white/10" style={{ gridTemplateColumns: `${GUTTER}px repeat(${cols}, minmax(0, 1fr))` }} data-allday-strip>
              <div className={`text-[10px] pt-2 pr-1.5 text-right ${muted}`}>all day</div>
              {days.map((key) => {
                const over = preview && preview.kind === "allday" && preview.date === key;
                return (
                  <div
                    key={key}
                    data-allday={key}
                    onClick={(e) => e.target === e.currentTarget && onCreate({ date: key, allDay: true })}
                    title="Click to add an all-day task"
                    className={`min-w-0 min-h-[30px] p-0.5 space-y-0.5 border-l border-black/5 dark:border-white/10 cursor-cell ${over ? "bg-[#ed2127]/10 ring-2 ring-inset ring-[#ed2127]/60 dark:ring-[#f2454b]/60" : ""}`}
                  >
                    {itemsFor(key).allDay.map((it) => {
                      const chip = (
                        <span className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight text-left" style={{ background: hex2rgba(it.color, 0.16), color: it.color, filter: "brightness(0.85)" }}>
                          {it.title}
                        </span>
                      );
                      const dimmed = preview && preview.srcId === it.id ? "opacity-40" : "";
                      if (it.task) {
                        return (
                          <div
                            key={it.id}
                            data-allday-task={it.task.id}
                            role="button"
                            tabIndex={0}
                            title={it.title}
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              begin(e, { kind: "tray", task: it.task, srcId: it.id, onClick: () => onOpen(it) });
                            }}
                            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen(it))}
                            className={`block w-full min-w-0 cursor-grab active:cursor-grabbing select-none ${dimmed}`}
                            style={{ touchAction: "manipulation" }}
                          >
                            {chip}
                          </div>
                        );
                      }
                      return it.raw ? (
                        <button key={it.id} type="button" onClick={() => onOpen(it)} title={it.title} className="block w-full min-w-0 text-left">
                          {chip}
                        </button>
                      ) : (
                        <div key={it.id} title={[it.title, it.sub].filter(Boolean).join(" · ")}>
                          {chip}
                        </div>
                      );
                    })}
                    {over && (
                      <span className="block truncate rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight border border-dashed border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b]">
                        {preview.label}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative grid" style={{ gridTemplateColumns: `${GUTTER}px repeat(${cols}, minmax(0, 1fr))`, height: 24 * HOUR_PX }}>
            <div className="relative">
              {HOURS.slice(1).map((h) => (
                <span key={h} className={`absolute right-1.5 -translate-y-1/2 text-[10px] ${muted}`} style={{ top: h * HOUR_PX }}>
                  {minLabel(h * 60, true)}
                </span>
              ))}
            </div>
            {days.map((key) => {
              const { timed } = itemsFor(key);
              // The side-by-side layout is worked out from where blocks are, not where one is being dragged, so the
              // others hold still while a block passes over them. The dragged block floats at its new place.
              const lanes = layoutDay(timed);
              const dragId = preview && (preview.kind === "move" || preview.kind === "resize" || (preview.kind === "allday" && !preview.srcId)) ? preview.id : null;
              const shown = timed.filter((it) => it.id !== dragId);
              if (dragId && preview.date === key && preview.kind !== "allday") {
                const src = days.map((k) => itemsFor(k).timed.find((t) => t.id === dragId)).find(Boolean);
                if (src) {
                  const own = lanes.get(src.id);
                  shown.push({ ...src, date: key, startMin: preview.startMin, endMin: preview.endMin, dragging: true, floatLane: src.date === key ? own : null });
                }
              }
              return (
                <div
                  key={key}
                  ref={(el) => (colRefs.current[key] = el)}
                  onPointerDown={(e) => startOnEmpty(e, key)}
                  data-day={key}
                  className={`relative border-l border-black/5 dark:border-white/10 select-none ${key === today ? "bg-[#ed2127]/[0.03]" : ""} cursor-cell`}
                  style={{ backgroundImage: `linear-gradient(to bottom, ${hairline} 1px, transparent 1px)`, backgroundSize: `100% ${HOUR_PX}px` }}
                >
                  {shown.map((it) => {
                    const lane = (it.dragging ? it.floatLane : lanes.get(it.id)) || { lane: 0, lanes: 1 };
                    const h = Math.max(((it.endMin - it.startMin) / 60) * HOUR_PX, 18);
                    const tall = h >= 40;
                    return (
                      <div
                        key={it.id}
                        data-block={it.id}
                        onPointerDown={(e) => startOnBlock(e, it)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onOpen(it);
                          }
                        }}
                        tabIndex={0}
                        role="button"
                        aria-label={`${it.title}, ${rangeLabel(it.startMin, it.endMin)}`}
                        className={`absolute rounded-md overflow-hidden bg-white dark:bg-[#1a1a1a] text-left px-1.5 py-1 text-[11px] leading-tight ${it.editable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${it.dragging ? "shadow-lg ring-2 ring-black/20 dark:ring-white/30 z-20" : "z-10"} focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ed2127]`}
                        style={{
                          top: (it.startMin / 60) * HOUR_PX + 1,
                          height: h - 2,
                          left: `calc(${(lane.lane / lane.lanes) * 100}% + 2px)`,
                          width: `calc(${100 / lane.lanes}% - 4px)`,
                          backgroundImage: `linear-gradient(${hex2rgba(it.color, 0.2)}, ${hex2rgba(it.color, 0.2)})`,
                          borderLeft: `3px ${it.kind === "task" ? "dashed" : "solid"} ${it.color}`,
                          touchAction: "manipulation",
                        }}
                      >
                        <div className="flex items-start gap-1 min-w-0">
                          {it.kind === "task" && (
                            <input
                              type="checkbox"
                              checked={false}
                              onChange={() => onToggleTask(it.task)}
                              onPointerDown={(e) => e.stopPropagation()}
                              aria-label={`Mark “${it.title}” done`}
                              className="mt-px h-3.5 w-3.5 shrink-0 cursor-pointer"
                              style={{ accentColor: it.color }}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <span className="block font-semibold break-words" style={{ color: it.color, filter: "brightness(0.8)" }}>
                              {it.title}
                            </span>
                            {tall && <span className={`block ${muted}`}>{rangeLabel(it.startMin, it.endMin)}</span>}
                            {h >= 64 && it.sub && <span className={`block truncate ${muted}`}>{it.sub}</span>}
                          </div>
                        </div>
                        {it.editable && (
                          <span
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              begin(e, { kind: "resize", item: { ...it, startMin: it.startMin } });
                            }}
                            aria-hidden="true"
                            className="absolute inset-x-0 bottom-0 h-2.5 cursor-ns-resize flex items-end justify-center"
                            style={{ touchAction: "none" }}
                          >
                            <span className="mb-0.5 h-0.5 w-6 rounded-full bg-black/25 dark:bg-white/40" />
                          </span>
                        )}
                      </div>
                    );
                  })}

                  {preview && preview.date === key && (preview.kind === "create" || preview.kind === "tray") && (
                    <div
                      className="absolute left-0.5 right-0.5 rounded-md border-2 border-dashed border-[#ed2127] dark:border-[#f2454b] bg-[#ed2127]/10 pointer-events-none z-20 px-1.5 py-0.5 text-[11px] font-semibold text-[#ed2127] dark:text-[#f2454b]"
                      style={{ top: (preview.startMin / 60) * HOUR_PX, height: ((preview.endMin - preview.startMin) / 60) * HOUR_PX }}
                    >
                      {rangeLabel(preview.startMin, preview.endMin)}
                    </div>
                  )}

                  {key === today && (
                    <div className="absolute inset-x-0 z-20 pointer-events-none" style={{ top: (nowMin / 60) * HOUR_PX }} aria-hidden="true">
                      <div className="h-px bg-[#ed2127] dark:bg-[#f2454b]" />
                      <div className="-mt-[5px] -ml-1 h-2 w-2 rounded-full bg-[#ed2127] dark:bg-[#f2454b]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {tray && (
        <aside className={`w-full shrink-0 ${cols === 1 ? "lg:w-56" : ""}`} aria-label="Tasks to schedule">
          <p className={`text-[11px] font-semibold uppercase tracking-wide ${muted}`}>To schedule</p>
          {tray.length === 0 ? (
            <p className={`mt-2 text-xs ${muted}`}>Every open task has a time. Add one under “Your tasks” below, or click the grid to block time for a new one.</p>
          ) : (
            <>
              <p className={`mt-1 text-[11px] ${muted}`}>
                <span className="hidden lg:inline">Drag a task onto the grid, or </span>
                <span className="lg:hidden">Tap </span>
                <span className="hidden lg:inline">use </span>
                the clock to pick a time.
              </p>
              <ul className={`mt-2 pr-0.5 ${cols === 1 ? "space-y-1.5 lg:max-h-[min(40vh,420px)] lg:overflow-y-auto" : "grid gap-1.5 grid-cols-[repeat(auto-fill,minmax(14rem,1fr))]"}`}>
                {tray.map((t) => (
                  <li
                    key={t.id}
                    onPointerDown={(e) => {
                      if (e.target.closest("button")) return;
                      begin(e, { kind: "tray", task: t });
                    }}
                    data-tray-task={t.id}
                    className="flex items-center gap-2 rounded-lg border border-black/10 dark:border-white/15 px-2.5 py-2 cursor-grab select-none hover:bg-black/[0.03] dark:hover:bg-white/[0.04]"
                    style={{ touchAction: "manipulation" }}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium leading-snug break-words">{t.title}</span>
                      {t.dueLabel && <span className={`block text-[10px] ${t.overdue ? "text-red-600 dark:text-red-400 font-semibold" : muted}`}>{t.dueLabel}</span>}
                    </span>
                    <button type="button" onClick={() => onPickTask(t)} aria-label={`Pick a time for “${t.title}”`} className="shrink-0 h-7 w-7 rounded-full border border-black/10 dark:border-white/15 text-xs hover:bg-black/5 dark:hover:bg-white/10">
                      ◷
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      )}

      {ghost && (
        <div className="fixed z-[60] pointer-events-none rounded-lg bg-[#1c1a17] text-white text-xs font-medium px-3 py-1.5 shadow-xl max-w-[14rem] truncate" style={{ left: ghost.x + 12, top: ghost.y + 12 }}>
          {ghost.label}
        </div>
      )}
    </div>
  );
}
