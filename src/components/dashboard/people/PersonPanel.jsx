import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS, ARCHIVE_REASONS, SOURCES } from "../../../lib/peopleStages";
import ContactButtons from "./ContactButtons";
import OutreachDrafts from "./OutreachDrafts";
import ClientTimelineCard from "./ClientTimelineCard";
import { DetailGroup, EditToggle, earnestLine, money } from "./DealDetailList";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { PEEK_WIDTHS } from "../../../hooks/usePeekWidth";
import TransactionModules from "./TransactionModules";
import DealCompliance from "./DealCompliance";
import DealTeam from "./DealTeam";
import DealContacts from "./DealContacts";
import DealSignatures from "./DealSignatures";
import DealTabs, { dealTabs } from "./DealTabs";
import DealOverview from "./DealOverview";
import ProspectOverview, { followUpState } from "./ProspectOverview";
import ProspectActivity, { useProspectActivity } from "./ProspectActivity";
import { useContactCard } from "../../../hooks/useContactCard";
import { TagChip } from "./contacts/TagParts";
import { relationshipLabel } from "../../../lib/contacts";
import { useNavigate } from "react-router-dom";
import { ComplianceChip } from "./DealCompliance";
import { useDealSummary } from "../../../hooks/useDealSummary";
import { addDays, dayLabel, toKey } from "../../../lib/homeDates";
import { useAuth } from "../../../hooks/useAuth";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const primaryBtn =
  "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60";
const navBtn =
  "h-8 w-8 flex items-center justify-center rounded-full border border-black/10 dark:border-white/15 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed";

const DATE_FIELDS = ["next_follow_up", "contract_date", "inspection_date", "inspection_period_end", "inspection_time", "appraisal_date", "financing_deadline", "closing_date"];
const NUMBER_FIELDS = ["price", "commission", "earnest_money"];
const TEXT_FIELDS = [
  "name", "email", "phone", "source", "property_address", "other_agent", "title_company", "lender",
  "client2_name", "client2_email", "other_agent_email", "other_agent_tc_name", "other_agent_tc_email", "title_company_email", "title_processor_name", "title_processor_email", "lender_email",
];
// Earnest money is delivered or not; ticking it also stamps when (see flush).
const FIELDS = [...TEXT_FIELDS, ...DATE_FIELDS, ...NUMBER_FIELDS, "side", "earnest_money_delivered", "is_cash"];

const openPicker = (e) => {
  try {
    e.currentTarget.showPicker();
  } catch {
    /* browser without showPicker — native control still works */
  }
};
const TEXT_DEBOUNCE_MS = 700;

function formatNoteTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function toForm(person) {
  const form = {};
  for (const key of TEXT_FIELDS) form[key] = person[key] || "";
  for (const key of DATE_FIELDS) form[key] = person[key] || "";
  for (const key of NUMBER_FIELDS) form[key] = person[key] == null ? "" : String(person[key]);
  form.side = person.side || "";
  form.earnest_money_delivered = !!person.earnest_money_delivered;
  form.is_cash = !!person.is_cash;
  return form;
}

// Edits save automatically: text fields after a short pause (and when the
// panel closes or you jump to another contact), dropdowns/dates right away.
export default function PersonPanel({
  person,
  stageNames,
  nextStageNames,
  prevStageNames,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  onChanged,
  peek,
  cadence = null,
}) {
  const board = BOARDS[person.stage_group];
  const navigate = useNavigate();
  const { profile } = useAuth();
  const signedInName = profile?.full_name || "";
  const signedInEmail = profile?.email || "";
  const [form, setForm] = useState(() => toForm(person));
  const formRef = useRef(form);
  const savedRef = useRef(form);
  const timerRef = useRef(null);
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [notes, setNotes] = useState([]);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [moveStage, setMoveStage] = useState(() => (board.next?.group === "transaction" ? nextStageNames?.find((s) => /^pending$/i.test(s)) : null) || nextStageNames?.[0] || ""); // a person who has a contract lands in Pending, not in Listings
  const [backStage, setBackStage] = useState(prevStageNames?.[prevStageNames.length - 1] || "");
  const [archiveReason, setArchiveReason] = useState(ARCHIVE_REASONS[0]);

  // A deal opens on a short Overview with the rest behind tabs; the other boards keep the plain form.
  const isDeal = person.stage_group === "transaction";
  const [tab, setTab] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [dealModal, setDealModal] = useState(null); // share | back | archive
  const [editingDetails, setEditingDetails] = useState(false); // the Details tab reads like a summary until Edit is pressed
  const dealDates = { contract_date: form.contract_date, inspection_date: form.inspection_date, inspection_period_end: form.inspection_period_end, inspection_time: form.inspection_time, appraisal_date: form.appraisal_date, financing_deadline: form.financing_deadline, closing_date: form.closing_date };
  const summary = useDealSummary(isDeal ? person.id : null, dealDates);
  useEffect(() => {
    if (isDeal) summary.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // Leads and Pipeline: the contact behind the card, and one list of everything that has happened with them.
  const [activityKey, setActivityKey] = useState(0);
  const activity = useProspectActivity(person, activityKey, !isDeal);
  const contactCard = useContactCard(isDeal ? null : person.contact_id, () => onChangedRef.current());

  const flush = useCallback(async () => {
    clearTimeout(timerRef.current);
    const cur = formRef.current;
    const saved = savedRef.current;
    if (!cur.name.trim()) return;
    const changes = {};
    for (const key of FIELDS) {
      if (cur[key] === saved[key]) continue;
      if (DATE_FIELDS.includes(key) || key === "side") changes[key] = cur[key] || null;
      else if (NUMBER_FIELDS.includes(key)) changes[key] = cur[key] === "" ? null : Number(cur[key]);
      else if (key === "is_cash") changes[key] = !!cur[key];
      else if (key === "earnest_money_delivered") {
        changes[key] = !!cur[key];
        changes.earnest_money_delivered_at = cur[key] ? new Date().toISOString() : null;
      } else changes[key] = cur[key].trim();
    }
    if (Object.keys(changes).length === 0) return;
    savedRef.current = { ...saved, ...cur };
    setStatus("Saving…");
    const { error: err } = await supabase.from("people").update(changes).eq("id", person.id);
    if (err) {
      savedRef.current = saved;
      setError(err.message);
      setStatus("");
      return;
    }
    setError("");
    setStatus("Saved");
    onChangedRef.current();
  }, [person.id]);

  // Closing the panel or jumping to another contact unmounts this one —
  // push out anything still waiting on the debounce timer first.
  useEffect(() => () => void flush(), [flush]);

  const setField = (field, immediate) => (e) => {
    const value = e.target.value;
    formRef.current = { ...formRef.current, [field]: value };
    setForm(formRef.current);
    setStatus("");
    clearTimeout(timerRef.current);
    if (immediate) flush();
    else timerRef.current = setTimeout(flush, TEXT_DEBOUNCE_MS);
  };

  const loadNotes = useCallback(async () => {
    const { data } = await supabase
      .from("people_notes")
      .select("*")
      .eq("person_id", person.id)
      .order("created_at", { ascending: false });
    setNotes(data || []);
  }, [person.id]);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  const patch = async (changes) => {
    setError("");
    const { error: err } = await supabase.from("people").update(changes).eq("id", person.id);
    if (err) {
      setError(err.message);
      return false;
    }
    onChanged();
    return true;
  };

  const addNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setAddingNote(true);
    const { error: err } = await supabase
      .from("people_notes")
      .insert({ person_id: person.id, body: noteText.trim() });
    setAddingNote(false);
    if (err) {
      setError(err.message);
      return;
    }
    setNoteText("");
    loadNotes();
  };

  const deleteNote = async (id) => {
    if (!confirm("Delete this note?")) return;
    await supabase.from("people_notes").delete().eq("id", id);
    loadNotes();
  };

  const handleMove = async () => {
    await flush();
    // A deal is one side (the checklists are per side), so "both" is cleared on the way into Transactions.
    const clearBoth = board.next.group === "transaction" && form.side === "both";
    if (await patch({ stage_group: board.next.group, stage: moveStage, ...(clearBoth ? { side: null } : {}) })) onClose();
  };

  const handleMoveBack = async () => {
    await flush();
    if (await patch({ stage_group: board.prev.group, stage: backStage })) onClose();
  };

  const handleArchive = async () => {
    await flush();
    const ok = await patch({
      archived: true,
      archived_reason: archiveReason,
      archived_at: new Date().toISOString(),
    });
    if (ok) onClose();
  };

  const handleRestore = async () => {
    if (await patch({ archived: false, archived_reason: "", archived_at: null })) onClose();
  };

  const handleDelete = async () => {
    if (!confirm(`Permanently delete ${person.name} and all their notes?`)) return;
    clearTimeout(timerRef.current);
    formRef.current = savedRef.current;
    const { error: err } = await supabase.from("people").delete().eq("id", person.id);
    if (err) {
      setError(err.message);
      return;
    }
    onChanged();
    onClose();
  };

  const sourceOptions = form.source && !SOURCES.includes(form.source) ? [form.source, ...SOURCES] : SOURCES;

  const isTransaction = person.stage_group === "transaction";
  const transactionDetails = (
    <div className="space-y-3">
        <div className="grid @md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Side</label>
            <select value={form.side === "both" ? "" : form.side} onChange={setField("side", true)} className={inputClass}>
              <option value="">Select…</option>
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Property address</label>
            <input value={form.property_address} onChange={setField("property_address")} onBlur={flush} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Price ($)</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={form.price} onChange={setField("price")} onBlur={flush} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Commission ($)</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={form.commission} onChange={setField("commission")} onBlur={flush} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Earnest money ($)</label>
            <input type="number" min="0" step="any" inputMode="decimal" value={form.earnest_money} onChange={setField("earnest_money")} onBlur={flush} className={inputClass} />
          </div>
          <label className="flex items-center gap-2.5 self-end pb-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.earnest_money_delivered}
              onChange={(e) => setField("earnest_money_delivered", true)({ target: { value: e.target.checked } })}
              className="h-4 w-4 accent-[#ed2127]"
            />
            <span>
              Delivered to the title company
              {form.earnest_money_delivered && person.earnest_money_delivered_at && <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{formatNoteTime(person.earnest_money_delivered_at)}</span>}
            </span>
          </label>
          <label className="flex items-center gap-2.5 text-sm cursor-pointer @md:col-span-2">
            <input type="checkbox" checked={form.is_cash} onChange={(e) => setField("is_cash", true)({ target: { value: e.target.checked } })} className="h-4 w-4 accent-[#ed2127]" />
            <span>Cash purchase (no appraisal or financing)</span>
          </label>
        </div>
    </div>
  );

  // ---- Where the panel sits ----------------------------------------------------------------------------------------
  // Desktop: a side peek that slides in from the right, in one of three widths, without covering the board behind it.
  // Phone: a bottom sheet. It opens as a small peek (the contact's name, stage and call/text/email), slides up to show
  // everything, and slides down to close.
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const sheet = !isDesktop;
  const [entered, setEntered] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [snap, setSnap] = useState("peek"); // "peek" (name + call/text/email) | "full" (phone)
  const [peekPx, setPeekPx] = useState(190); // how much of the sheet the peek shows: measured from its own content
  const [dragTy, setDragTy] = useState(null); // px the sheet is being dragged to, or null
  const [, setViewportTick] = useState(0);
  const asideRef = useRef(null);
  const grabRef = useRef(null);
  const grab = useRef(null);
  const dragTyRef = useRef(null);
  const justDragged = useRef(false); // the click that can follow a drag must not also toggle the handle

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 16);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    const onResize = () => setViewportTick((n) => n + 1);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && !e.defaultPrevented) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Arrow keys step through the contacts in this column. Left/right always do; up/down too while the phone sheet is
  // just the small peek (nothing there scrolls). Ignored while typing in a field.
  const stepRef = useRef({});
  stepRef.current = { onPrev, onNext, vertical: sheet && snap === "peek" };
  useEffect(() => {
    const onKey = (e) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      const { onPrev: prev, onNext: next, vertical } = stepRef.current;
      const back = e.key === "ArrowLeft" || (vertical && e.key === "ArrowUp");
      const fwd = e.key === "ArrowRight" || (vertical && e.key === "ArrowDown");
      if (!back && !fwd) return;
      e.preventDefault();
      (back ? prev : next)?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Desktop: pressing anywhere outside the side peek closes it. Another card on the board is the exception: that swaps
  // the peek to that person instead of closing and reopening it.
  useEffect(() => {
    if (!isDesktop) return;
    const onDown = (e) => {
      if (e.button !== 0 || !(e.target instanceof Element)) return;
      // Another card swaps the peek; a window opened from it (share, archive...) lives outside the peek, so pressing in it isn't "outside" either.
      if (asideRef.current?.contains(e.target) || e.target.closest("[data-person-id], [role=dialog]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [isDesktop, onClose]);

  // The peek is exactly as tall as the handle, the name and the contact buttons, whatever the phone's size.
  useLayoutEffect(() => {
    if (sheet && snap === "peek" && grabRef.current) setPeekPx(grabRef.current.offsetHeight);
  }, [sheet, snap, form.name, person.stage, person.archived, draftCount]);

  const vh = typeof window === "undefined" ? 800 : window.innerHeight;
  const sheetH = Math.round(vh * 0.92);
  const visibleFor = { peek: peekPx, full: sheetH };
  const restTy = sheetH - visibleFor[snap];
  const sheetTy = !entered ? sheetH : dragTy ?? restTy;

  // Dragging the sheet by its handle or header. The drag only starts once the finger has moved a few pixels, so taps on
  // Call, Text and Email still work; once it has started the sheet follows the finger, and on release a quick flick down
  // closes it completely while a slower drag settles on the nearest of closed, peek and full.
  const grabHandlers = {
    onPointerDown: (e) => {
      if (isDesktop || e.button > 0 || grab.current || e.target.closest("input, select, textarea")) return;
      const g = { id: e.pointerId, y: e.clientY, ty: restTy, active: false, samples: [{ y: e.clientY, t: performance.now() }] };
      grab.current = g;

      // Follow the pointer on the whole window, so a fast drag that gets ahead of the sheet isn't lost.
      const finish = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        grab.current = null;
        dragTyRef.current = null;
        setDragTy(null);
      };
      function onMove(ev) {
        if (ev.pointerId !== g.id) return;
        const dy = ev.clientY - g.y;
        if (!g.active && Math.abs(dy) < 6) return;
        g.active = true;
        g.samples.push({ y: ev.clientY, t: performance.now() });
        if (g.samples.length > 8) g.samples.shift();
        const ty = Math.min(sheetH, Math.max(0, g.ty + dy));
        dragTyRef.current = ty;
        setDragTy(ty);
      }
      function onUp(ev) {
        if (ev.pointerId !== g.id) return;
        const active = g.active;
        const ty = dragTyRef.current ?? g.ty;
        finish();
        if (active) {
          justDragged.current = true;
          setTimeout(() => (justDragged.current = false), 0);
        }
        if (!active) return; // a tap: the buttons and the handle deal with it themselves
        const last = g.samples[g.samples.length - 1];
        const from = g.samples.find((p) => last.t - p.t <= 120) || last;
        // px per ms, down is positive; a finger that stopped before lifting is not a flick
        const v = performance.now() - last.t > 90 || last.t === from.t ? 0 : (last.y - from.y) / (last.t - from.t);
        const shown = sheetH - ty;
        let target;
        if (v > 0.8) target = "close";
        else if (v < -0.6) target = "full";
        else if (shown < visibleFor.peek * 0.55) target = "close";
        else target = Math.abs(shown - visibleFor.peek) < Math.abs(shown - visibleFor.full) ? "peek" : "full";
        if (target === "close") onClose();
        else setSnap(target);
      }
      function onCancel(ev) {
        if (ev.pointerId === g.id) finish();
      }
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
  };

  // Desktop: the side peek's left edge can be dragged to any width.
  const resize = useRef(null);
  const resizeHandlers = {
    onPointerDown: (e) => {
      if (e.button > 0) return;
      resize.current = { x: e.clientX, w: asideRef.current.getBoundingClientRect().width };
      e.currentTarget.setPointerCapture(e.pointerId);
      peek.setResizing(true);
    },
    onPointerMove: (e) => {
      if (resize.current) peek.setPx(resize.current.w + (resize.current.x - e.clientX));
    },
    onPointerUp: (e) => {
      if (!resize.current) return;
      peek.commit(resize.current.w + (resize.current.x - e.clientX));
      resize.current = null;
      peek.setResizing(false);
    },
    onPointerCancel: () => {
      resize.current = null;
      peek.setResizing(false);
    },
  };

  // ---- A deal's panel: summary header, tabs, and a menu for the rare actions -------------------------------------------------
  const dealSide = form.side === "both" ? "" : form.side;
  const sideLabel = dealSide === "buyer" ? "Buyer" : dealSide === "seller" ? "Seller (listing)" : "";
  const closingDiff = form.closing_date ? Math.round((new Date(`${form.closing_date}T12:00:00`) - new Date(`${toKey(new Date())}T12:00:00`)) / 86400000) : null;
  const fu = followUpState(form.next_follow_up);
  const prospectTabs = [
    { key: "overview", label: "Overview", badge: fu.tone === "alert" ? "overdue" : fu.tone === "due" ? "due today" : null, tone: fu.tone === "alert" ? "alert" : "info" },
    { key: "activity", label: "Activity", badge: draftCount ? `${draftCount} draft${draftCount === 1 ? "" : "s"}` : null, tone: "info" },
    { key: "details", label: "Details" },
  ];
  const tabsBar = <DealTabs tabs={isDeal ? dealTabs(summary, person) : prospectTabs} active={tab} onChange={setTab} />;

  const dealMenu = (
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} className="grid h-7 w-7 place-items-center rounded-full text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10">
        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
      </button>
      {menuOpen && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[55] cursor-default" />
          <div role="menu" className="absolute right-0 z-[60] mt-1 w-64 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1f1f1f] py-1 shadow-xl">
            {[
              ...(isDeal ? [["Share a timeline with the client", () => setDealModal("share")]] : person.contact_id ? [["Open in Contacts", () => navigate(`/dashboard/people/contacts?contact=${person.contact_id}`)]] : []),
              ...(isDeal && board.prev && !person.archived ? [[board.prev.label, () => setDealModal("back")]] : []),
              person.archived ? [`Restore to ${board.title}`, handleRestore] : ["Archive", () => setDealModal("archive")],
              ["Delete permanently", handleDelete, true],
            ].map(([label, fn, danger]) => (
              <button
                key={label}
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  fn();
                }}
                className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${danger ? "text-red-600 dark:text-red-400" : ""}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  const dealModals =
    dealModal &&
    createPortal(
      <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && setDealModal(null)}>
        <div role="dialog" aria-label="Deal action" className="w-full max-w-md max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 text-[#1c1a17] dark:text-[#faf9f7] shadow-2xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">{dealModal === "share" ? "Share with the client" : dealModal === "back" ? board.prev?.label : isDeal ? "Archive this deal" : `Archive ${person.name}`}</h2>
            <button type="button" onClick={() => setDealModal(null)} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
          </div>
          {dealModal === "share" && <ClientTimelineCard person={person} dates={dealDates} />}
          {dealModal === "back" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <select value={backStage} onChange={(e) => setBackStage(e.target.value)} className={`${inputClass} !w-auto`}>
                  {prevStageNames.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
                <button type="button" onClick={handleMoveBack} className={primaryBtn}>{board.prev.label}</button>
              </div>
              <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">For a deal that fell through. Their deal details and notes are kept in case it comes back.</p>
            </div>
          )}
          {dealModal === "archive" && (
            <div className="space-y-3">
              <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className={inputClass}>
                {ARCHIVE_REASONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <button type="button" onClick={handleArchive} className={primaryBtn}>Archive</button>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );

  const dealChips = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={person.stage}
        onChange={(e) => patch({ stage: e.target.value })}
        aria-label="Stage"
        className="rounded-full border border-black/10 dark:border-white/15 bg-transparent px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
      >
        {stageNames.map((st) => (
          <option key={st} value={st}>{st}</option>
        ))}
      </select>
      {closingDiff != null && (
        <span className="rounded-full bg-black/[0.06] dark:bg-white/10 px-2.5 py-1 text-xs font-medium">
          {closingDiff > 0 ? `Closes ${dayLabel(form.closing_date, toKey(new Date()))} · in ${closingDiff} days` : closingDiff === 0 ? "Closes today" : `Closed ${-closingDiff} days ago`}
        </span>
      )}
      {summary.loaded && (summary.tasksTotal > 0 || summary.docsTotal > 0) && (
        <span className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">
          {summary.tasksTotal > 0 && `Tasks ${summary.tasksDone}/${summary.tasksTotal}`}
          {summary.tasksTotal > 0 && summary.docsTotal > 0 && " · "}
          {summary.docsTotal > 0 && `Docs ${summary.docsDone}/${summary.docsTotal}`}
        </span>
      )}
      {person.compliance_status && person.compliance_status !== "none" && <ComplianceChip status={person.compliance_status} />}
    </div>
  );

  const prospectChips = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={person.stage}
        onChange={(e) => patch({ stage: e.target.value })}
        aria-label="Stage"
        className="rounded-full border border-black/10 dark:border-white/15 bg-transparent px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
      >
        {stageNames.map((st) => (
          <option key={st} value={st}>{st}</option>
        ))}
      </select>
      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${fu.tone === "alert" ? "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300" : fu.tone === "due" ? "bg-amber-100 dark:bg-amber-400/15 text-amber-900 dark:text-amber-300" : "bg-black/[0.06] dark:bg-white/10"}`}>{fu.label}</span>
      {contactCard.contact && <span className="rounded-full bg-black/[0.06] dark:bg-white/10 px-2.5 py-1 text-xs font-medium">{relationshipLabel(contactCard.contact.relationship)}</span>}
      {contactCard.tagIds.slice(0, 3).map((id) => (
        <TagChip key={id} tag={contactCard.tagById.get(id)} size="sm" />
      ))}
    </div>
  );

  const panelHeader = (
      <div className="shrink-0 px-6 pt-4 md:pt-5 pb-4 space-y-4 border-b border-black/5 dark:border-white/10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {position > 0 && (
              <>
                <button type="button" onClick={onPrev} disabled={!onPrev} className={navBtn} aria-label="Previous contact in this column">
                  ‹
                </button>
                <button type="button" onClick={onNext} disabled={!onNext} className={navBtn} aria-label="Next contact in this column">
                  ›
                </button>
                <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                  {position} of {total}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            {isDesktop && peek && (
              <div role="group" aria-label="Panel width" className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5">
                {Object.entries(PEEK_WIDTHS).map(([key, w]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => peek.preset(key)}
                    aria-pressed={peek.choice === key}
                    aria-label={`${w.label} width`}
                    title={`${w.label} width`}
                    className={`h-6 w-7 flex items-center justify-center rounded-full transition-colors ${
                      peek.choice === key
                        ? "bg-[#1c1a17] text-white dark:bg-[#faf9f7] dark:text-[#1c1a17]"
                        : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
                    }`}
                  >
                    <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                      <rect x="0.5" y="0.5" width="13" height="10" rx="1.5" stroke="currentColor" />
                      <rect x={key === "narrow" ? 9 : key === "standard" ? 6 : 3} y="1" width={key === "narrow" ? 4.5 : key === "standard" ? 7.5 : 10.5} height="9" rx="1" fill="currentColor" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
            <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 min-w-12 text-right">{status}</span>
            {dealMenu}
            <button type="button" onClick={onClose} className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]" aria-label="Close panel">
              ✕
            </button>
          </div>
        </div>

        <div className="min-w-0">
          {isDeal ? (
            <>
              <h2 className="font-display text-xl font-semibold truncate">{form.property_address || form.name || person.name}</h2>
              <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 truncate">
                {[form.property_address ? form.name || person.name : "", sideLabel, form.price ? `$${Number(form.price).toLocaleString()}` : ""].filter(Boolean).join(" · ") || "Deal"}
                {person.archived && " · Archived"}
              </p>
            </>
          ) : (
            <>
              <h2 className="font-display text-xl font-semibold truncate">{form.name || person.name}</h2>
              <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5">
                {board.title} · {person.stage}
                {person.archived && " · Archived"}
              </p>
            </>
          )}
        </div>

        {isDeal ? dealChips : prospectChips}
        <ContactButtons person={{ ...person, phone: form.phone, email: form.email }} />
      </div>
  );

  const compactHeader = (
    <div className="px-5 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))] space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-semibold truncate">{isDeal ? form.property_address || form.name || person.name : form.name || person.name}</h2>
          <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 truncate">
            {isDeal && form.property_address ? `${form.name || person.name} · ` : ""}
            {board.title} · {person.stage}
            {person.archived && " · Archived"}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {position > 0 && (
            <>
              <button type="button" onClick={onPrev} disabled={!onPrev} className={navBtn} aria-label="Previous contact in this column">
                ‹
              </button>
              <button type="button" onClick={onNext} disabled={!onNext} className={navBtn} aria-label="Next contact in this column">
                ›
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className="p-1 ml-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]" aria-label="Close panel">
            ✕
          </button>
        </div>
      </div>
      <ContactButtons person={{ ...person, phone: form.phone, email: form.email }} />
      {draftCount > 0 && (
        <button
          type="button"
          onClick={() => setSnap("full")}
          className="flex w-full items-center justify-between gap-2 rounded-xl bg-[#ed2127]/10 dark:bg-[#f2454b]/15 px-3.5 py-2.5 text-left text-sm font-semibold text-[#b3151a] dark:text-[#ff8a8e]"
        >
          <span>
            {draftCount} draft message{draftCount === 1 ? "" : "s"} waiting for you
          </span>
          <span aria-hidden="true">Review ›</span>
        </button>
      )}
    </div>
  );

  const changeDate = (key, value) => setField(key, true)({ target: { value } });
  // The deal's contact cards: a field changed / was left. A client's name can't be emptied (it goes back to what was saved).
  const contactChange = (key, value) => setField(key)({ target: { value } });
  const contactCommit = (key) => {
    if (key === "name" && !formRef.current.name.trim()) {
      formRef.current = { ...formRef.current, name: savedRef.current.name };
      setForm(formRef.current);
    } else flush();
  };
  // Being in touch (a call, text, email... logged) moves the next follow-up along, but only when one is due or none is set.
  const afterTouch = () => {
    const today = toKey(new Date());
    if (cadence && (!form.next_follow_up || form.next_follow_up <= today)) changeDate("next_follow_up", toKey(addDays(new Date(), cadence)));
  };
  const nameInput = (
    <div>
      <label className={labelClass}>{isDeal ? "Client" : "Name"}</label>
      <input
        value={form.name}
        onChange={setField("name")}
        onBlur={() => {
          if (!formRef.current.name.trim()) {
            formRef.current = { ...formRef.current, name: savedRef.current.name };
            setForm(formRef.current);
          } else flush();
        }}
        className={inputClass}
      />
    </div>
  );
  const emailInput = (
    <div>
      <label className={labelClass}>Email</label>
      <input type="email" value={form.email} onChange={setField("email")} onBlur={flush} className={inputClass} />
    </div>
  );
  const phoneInput = (
    <div>
      <label className={labelClass}>Phone</label>
      <input type="tel" value={form.phone} onChange={setField("phone")} onBlur={flush} className={inputClass} />
    </div>
  );
  const contactFields = (
        <div className="space-y-3">
          {isDeal ? null : (
            <>
              {nameInput}
              <div className="grid @md:grid-cols-2 gap-3">
                {phoneInput}
                {emailInput}
              </div>
            </>
          )}
          <div className="grid @md:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Next follow-up</label>
              <input
                type="date"
                value={form.next_follow_up}
                onChange={setField("next_follow_up", true)}
                onClick={openPicker}
                className={`${inputClass} cursor-pointer`}
              />
            </div>
            <div>
              <label className={labelClass}>Source</label>
              <select value={form.source} onChange={setField("source", true)} className={inputClass}>
                <option value="">Select…</option>
                {sourceOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Stage</label>
            <select
              value={person.stage}
              onChange={(e) => patch({ stage: e.target.value })}
              className={inputClass}
            >
              {stageNames.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          {!isTransaction && (
            <div>
              <label className={labelClass}>Buyer or seller</label>
              <select value={form.side} onChange={setField("side", true)} className={inputClass}>
                <option value="">Not set</option>
                <option value="buyer">Buyer</option>
                <option value="seller">Seller</option>
                <option value="both">Both</option>
              </select>
            </div>
          )}
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
  );

  const notesSection = (
        <section className="min-w-0 space-y-3">
          <h3 className="font-display text-base font-semibold">Notes</h3>
          <form onSubmit={addNote} className="space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Log a call, a conversation, what they're looking for…"
              className={inputClass}
            />
            <button type="submit" disabled={addingNote || !noteText.trim()} className={primaryBtn}>
              {addingNote ? "Adding…" : "Add note"}
            </button>
          </form>
          {notes.length === 0 ? (
            <p className="text-sm text-[#1c1a17]/40 dark:text-[#faf9f7]/40">No notes yet.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] p-3">
                  <p className="text-sm whitespace-pre-wrap">{n.body}</p>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                    <span>{formatNoteTime(n.created_at)}</span>
                    <button type="button" onClick={() => deleteNote(n.id)} className="hover:text-red-600 dark:hover:text-red-400">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
  );


  const dealBody = (
    <div className={`@container flex-1 min-h-0 px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overscroll-contain ${sheet && snap === "peek" ? "overflow-hidden" : "overflow-y-auto"}`} onFocusCapture={() => sheet && snap === "peek" && setSnap("full")}>
      {tab === "overview" && (
        <DealOverview
          person={person}
          summary={summary}
          dates={dealDates}
          cash={form.is_cash}
          onCash={(v) => setField("is_cash", true)({ target: { value: v } })}
          onTab={setTab}
          onDate={changeDate}
          onCheckTask={summary.completeTask}
        >
          {{
            top: <OutreachDrafts person={person} onLogged={loadNotes} onCount={setDraftCount} />,
            bottom: notesSection,
          }}
        </DealOverview>
      )}
      {tab === "tasks" && <TransactionModules person={person} side={dealSide} dates={dealDates} show="tasks" />}
      {tab === "documents" && (
        <div className="space-y-6">
          <DealSignatures person={person} viewer="owner" agent={{ name: signedInName, email: signedInEmail }} />
          <TransactionModules person={person} side={dealSide} dates={dealDates} show="documents" />
        </div>
      )}
      {tab === "messages" && <DealCompliance person={person} viewer="owner" onChanged={() => { onChanged(); summary.reload(); }} />}
      {tab === "details" && (
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold">Details</h3>
            <EditToggle editing={editingDetails} onToggle={() => { flush(); setEditingDetails((v) => !v); }} />
          </div>
          {editingDetails ? (
            <>
              <DealContacts values={form} editing onChange={contactChange} onCommit={contactCommit} cash={form.is_cash} />
              {contactFields}
              <section className="min-w-0 space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Deal</h4>
                {transactionDetails}
              </section>
              <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Contract, inspection, appraisal, financing and closing dates are on the Overview tab.</p>
            </>
          ) : (
            <>
              <DealContacts values={form} editing={false} onChange={contactChange} onCommit={contactCommit} cash={form.is_cash} />
              <DetailGroup
                title="Follow-up"
                rows={[
                  { label: "Next follow-up", value: form.next_follow_up ? dayLabel(form.next_follow_up, toKey(new Date())) : "" },
                  { label: "Source", value: form.source },
                  { label: "Stage", value: person.stage },
                ]}
              />
              <DetailGroup
                title="Deal"
                rows={[
                  { label: "Buyer or seller", value: sideLabel },
                  { label: "Property", value: form.property_address, wide: true },
                  { label: "Price", value: money(form.price) },
                  { label: "Commission", value: money(form.commission) },
                  { label: "Earnest money", value: earnestLine(form, person) },
                  ...(form.is_cash ? [{ label: "Financing", value: "Cash purchase" }] : []),
                ]}
              />
            </>
          )}
          <DealTeam person={person} />
        </div>
      )}
    </div>
  );

  // ---- A lead's or pipeline person's panel: Overview, Activity, Details --------------------------------------------------------
  const moveBlock =
    board.next && !person.archived ? (
      <section className="flex flex-wrap items-center gap-2 border-t border-black/5 dark:border-white/10 pt-5">
        <select value={moveStage} onChange={(e) => setMoveStage(e.target.value)} aria-label={`Column on the ${BOARDS[board.next.group].title} board`} className={`${inputClass} !w-auto`}>
          {nextStageNames.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
        <button type="button" onClick={handleMove} className={primaryBtn}>
          {board.next.label}
        </button>
      </section>
    ) : null;

  const archiveBlock = (
    <section className="space-y-3 border-t border-black/5 dark:border-white/10 pt-5">
      {person.archived ? (
        <div className="space-y-2">
          {person.archived_reason && <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Reason: {person.archived_reason}</p>}
          <button type="button" onClick={handleRestore} className={primaryBtn}>
            Restore to {board.title}
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} aria-label="Why" className={`${inputClass} !w-auto`}>
            {ARCHIVE_REASONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" onClick={handleArchive} className="rounded-full border border-black/10 dark:border-white/15 text-sm font-semibold px-5 py-2.5 hover:bg-black/5 dark:hover:bg-white/10">
            Archive
          </button>
        </div>
      )}
      <button type="button" onClick={handleDelete} className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-red-600 dark:hover:text-red-400">
        Delete permanently
      </button>
    </section>
  );

  const panelBody = (
    <div className={`@container flex-1 min-h-0 px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] overscroll-contain ${sheet && snap === "peek" ? "overflow-hidden" : "overflow-y-auto"}`} onFocusCapture={() => sheet && snap === "peek" && setSnap("full")}>
      {tab === "overview" && (
        <ProspectOverview
          person={person}
          nextFollowUp={form.next_follow_up}
          cadence={cadence}
          columnName={person.stage}
          onFollowUp={(key) => changeDate("next_follow_up", key || "")}
          card={contactCard}
          activity={activity}
          onTab={setTab}
        >
          {{
            top: <OutreachDrafts person={person} onLogged={() => setActivityKey((k) => k + 1)} onCount={setDraftCount} />,
            bottom: moveBlock,
          }}
        </ProspectOverview>
      )}
      {tab === "activity" && (
        <div className="space-y-6">
          <OutreachDrafts person={person} onLogged={() => setActivityKey((k) => k + 1)} onCount={setDraftCount} />
          <ProspectActivity person={person} activity={activity} onTouch={afterTouch} onError={setError} />
        </div>
      )}
      {tab === "details" && (
        <div className="space-y-8">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-base font-semibold">Details</h3>
            <EditToggle editing={editingDetails} onToggle={() => { flush(); setEditingDetails((v) => !v); }} />
          </div>
          {editingDetails ? (
            contactFields
          ) : (
            <DetailGroup
              title="Contact"
              rows={[
                { label: "Name", value: form.name },
                { label: "Phone", value: form.phone, href: form.phone ? `tel:${form.phone.replace(/[^\d+]/g, "")}` : undefined },
                { label: "Email", value: form.email, href: form.email ? `mailto:${form.email}` : undefined },
                { label: "Next follow-up", value: form.next_follow_up ? dayLabel(form.next_follow_up, toKey(new Date())) : "" },
                { label: "Source", value: form.source },
                { label: "Stage", value: person.stage },
                { label: "Buyer or seller", value: form.side === "both" ? "Both" : form.side === "buyer" ? "Buyer" : form.side === "seller" ? "Seller" : "" },
              ]}
            />
          )}
          {!editingDetails && error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {archiveBlock}
        </div>
      )}
    </div>
  );

  const surface = "bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7]";

  if (isDesktop) {
    return (
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="false"
        aria-label={`${person.name}'s card`}
        style={{ width: peek ? peek.css : "min(600px, calc(100vw - 8rem))", transform: entered ? "translateX(0)" : "translateX(100%)" }}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-black/10 dark:border-white/10 shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.18)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${peek?.resizing ? "!transition-none" : ""} ${surface}`}
      >
        {/* Grab the left edge to make the panel wider or narrower. */}
        <div
          {...resizeHandlers}
          role="separator"
          aria-orientation="vertical"
          aria-label="Drag to resize the panel"
          title="Drag to resize"
          className="group absolute inset-y-0 -left-1.5 z-10 w-3 cursor-col-resize touch-none"
        >
          <span className={`absolute inset-y-0 left-[5px] w-0.5 transition-colors ${peek?.resizing ? "bg-[#ed2127]/70 dark:bg-[#f2454b]/70" : "bg-transparent group-hover:bg-[#ed2127]/40 dark:group-hover:bg-[#f2454b]/40"}`} />
        </div>
        {panelHeader}
        {tabsBar}
        {isDeal ? dealBody : panelBody}
        {dealModals}
      </aside>
    );
  }

  return (
    <>
      {snap === "full" && (
        <button type="button" aria-label="Shrink to the preview" onClick={() => setSnap("peek")} className="fixed inset-0 z-40 bg-black/35" />
      )}
      <div
        role="dialog"
        aria-modal="false"
        aria-label={`${person.name}'s card`}
        style={{
          height: sheetH,
          transform: `translateY(${sheetTy}px)`,
          transition: dragTy === null ? "transform 320ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
        }}
        className={`fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl shadow-[0_-12px_40px_-8px_rgba(0,0,0,0.3)] motion-reduce:!transition-none ${surface}`}
      >
        <div ref={grabRef} {...grabHandlers} onDragStart={(e) => e.preventDefault()} className="touch-none shrink-0 select-none">
          <div
            role="button"
            tabIndex={0}
            aria-label={snap === "peek" ? "Show everything" : "Shrink to the preview"}
            onClick={() => {
              if (!justDragged.current) setSnap((v) => (v === "peek" ? "full" : "peek"));
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setSnap((v) => (v === "peek" ? "full" : "peek"));
              }
            }}
            className="flex w-full cursor-grab justify-center pt-3.5 pb-3 active:cursor-grabbing"
          >
            <span className="h-1.5 w-12 rounded-full bg-black/25 dark:bg-white/30" />
          </div>
          {snap === "peek" ? compactHeader : panelHeader}
        </div>
        {snap === "full" && tabsBar}
        {isDeal ? dealBody : panelBody}
        {dealModals}
      </div>
    </>
  );
}
