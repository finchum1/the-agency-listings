import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS, ARCHIVE_REASONS } from "../../../lib/peopleStages";
import TransactionModules from "./TransactionModules";
import DealCompliance, { ComplianceChip } from "./DealCompliance";
import DealSignatures from "./DealSignatures";
import DealTabs, { dealTabs } from "./DealTabs";
import DealOverview from "./DealOverview";
import SendAgentUpdate from "./SendAgentUpdate";
import { DetailGroup, EditToggle, earnestLine } from "./DealDetailList";
import { useDealSummary } from "../../../hooks/useDealSummary";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import { usePeekWidth, PEEK_WIDTHS } from "../../../hooks/usePeekWidth";
import { dayLabel, toKey } from "../../../lib/homeDates";
import ClientTimelineCard from "./ClientTimelineCard";
import { useAuth } from "../../../hooks/useAuth";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40 disabled:opacity-100 disabled:border-transparent disabled:px-0";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const TEXT = [
  ["property_address", "Property"],
  ["other_agent", "Other agent"],
  ["other_agent_email", "Other agent's email"],
  ["other_agent_tc_name", "Other agent's TC"],
  ["other_agent_tc_email", "Other agent's TC email"],
  ["title_company", "Title company"],
  ["title_company_email", "Title company email"],
  ["title_processor_name", "Title processor"],
  ["title_processor_email", "Title processor email"],
  ["lender", "Lender"],
  ["lender_email", "Lender email"],
];
// The second client sits at the top of the details, right under the first.
// The first client's phone and email, editable here so a coordinator can fix them.
const CLIENT1 = [["phone", "Phone"], ["email", "Email"]];
const CLIENT2 = [["client2_name", "Second client"], ["client2_email", "Second client's email"]];
const DATES = [["contract_date", "Contract"], ["inspection_date", "Inspection"], ["appraisal_date", "Appraisal"], ["financing_deadline", "Financing deadline"], ["closing_date", "Closing"]];
const NUMBERS = [["price", "Price"], ["commission", "Commission"], ["earnest_money", "Earnest money"]];

// The deal as a coordinator or compliance sees it (the agent uses the People panel). A coordinator can edit the facts and
// work the checklists; compliance reads them, marks documents, and approves or sends the deal back.
// A coordinator's panel is set up like the agent's own (PersonPanel): a side peek on a desktop that doesn't cover the board, the same remembered
// width and drag-to-resize edge, the same header (stage, closing, progress) and tabs. Compliance, and a phone, get the full-height sheet.
export default function DealPanel({ deal, agentName, viewer, peek: peekProp, onClose, onChanged }) {
  const edit = viewer === "tc";
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const docked = edit && isDesktop;
  const ownPeek = usePeekWidth(true);
  const peek = peekProp || ownPeek;
  const [entered, setEntered] = useState(false);
  const asideRef = useRef(null);
  const [modal, setModal] = useState(null); // share | archive
  const [menuOpen, setMenuOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState(ARCHIVE_REASONS[0]);
  // A coordinator opens on the Overview, like the agent does; compliance opens on Documents, which is what they review.
  const [tab, setTab] = useState(viewer === "compliance" ? "documents" : "overview");
  const [editingDetails, setEditingDetails] = useState(false); // read like a summary until Edit is pressed (coordinators only)
  const { user } = useAuth();
  const { stages: myStages } = usePeopleStages();
  const myColumns = myStages.transaction;
  const [form, setForm] = useState(() => toForm(deal));
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(deal);
  // All five key dates: the overview's date tiles read them (the checklist's due dates only follow the first three).
  const dealDates = { contract_date: fresh.contract_date || "", inspection_date: fresh.inspection_date || "", appraisal_date: fresh.appraisal_date || "", financing_deadline: fresh.financing_deadline || "", closing_date: fresh.closing_date || "" };
  const summary = useDealSummary(deal.id, dealDates);
  useEffect(() => {
    summary.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);
  const [tcNames, setTcNames] = useState([]);
  const [agentEmail, setAgentEmail] = useState("");
  useEffect(() => {
    supabase.from("profiles").select("email").eq("id", deal.owner_id).maybeSingle().then(({ data }) => setAgentEmail(data?.email || ""));
  }, [deal.owner_id]);
  const [agentStages, setAgentStages] = useState(null); // the deal owner's own Deals column names
  useEffect(() => {
    supabase.rpc("deal_stage_names", { p_person: deal.id }).then(({ data }) => setAgentStages(data || null));
  }, [deal.id]);
  useEffect(() => {
    (async () => {
      const [{ data: per }, { data: wide }] = await Promise.all([
        supabase.from("deal_tcs").select("tc_id").eq("person_id", deal.id),
        supabase.from("deal_team").select("tc_id").eq("agent_id", deal.owner_id),
      ]);
      const ids = [...new Set([...(per || []), ...(wide || [])].map((r) => r.tc_id))];
      if (!ids.length) return setTcNames([]);
      const { data: profs } = await supabase.from("profiles").select("full_name").in("id", ids);
      setTcNames((profs || []).map((p) => p.full_name));
    })();
  }, [deal.id, deal.owner_id]);

  useEffect(() => {
    const t = setTimeout(() => setEntered(true), 16);
    return () => clearTimeout(t);
  }, []);
  // Docked: pressing anywhere outside the panel closes it, except another deal's card, which swaps the panel to that deal.
  useEffect(() => {
    if (!docked) return undefined;
    const onDown = (e) => {
      if (e.button !== 0 || !(e.target instanceof Element)) return;
      if (asideRef.current?.contains(e.target) || e.target.closest("[data-person-id], [role=dialog]")) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [docked, onClose]);
  // The left edge can be dragged to any width, the same one the agent's own deal panel uses.
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

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = async () => {
    const { data } = await supabase.from("people").select("*").eq("id", deal.id).single();
    if (data) setFresh(data);
    onChanged?.();
  };

  const save = async (changes) => {
    setError("");
    const { error: err } = await supabase.from("people").update(changes).eq("id", deal.id);
    if (err) setError(err.message);
    else onChanged?.();
  };
  const commit = (key, kind) => {
    const raw = form[key];
    const next = kind === "number" ? (raw === "" ? null : Number(raw)) : kind === "date" ? raw || null : raw.trim();
    const cur = fresh[key] ?? (kind === "text" ? "" : null);
    if (next === cur || (kind === "number" && Number(next) === Number(cur))) return;
    setFresh((f) => ({ ...f, [key]: next }));
    save({ [key]: next });
  };
  const bind = (key, kind) => ({
    value: form[key],
    disabled: !edit,
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => edit && commit(key, kind),
  });

  // The three-dot menu (a coordinator's, like the agent's own): archive takes the deal off the agent's board too, since it is the agent's deal;
  // delete removes it, and everything on it, for good.
  const handleArchive = async () => {
    const { error: err } = await supabase.from("people").update({ archived: true, archived_reason: archiveReason, archived_at: new Date().toISOString() }).eq("id", deal.id);
    if (err) return setError(err.message);
    setModal(null);
    onChanged?.();
    onClose();
  };
  const handleDelete = async () => {
    const where = fresh.property_address || fresh.name;
    if (!confirm(`Permanently delete ${where}${agentName ? ` for ${agentName}` : ""}?\n\nIt disappears from ${agentName ? `${agentName}'s` : "the agent's"} board too, with its tasks, documents, messages and signatures. This can't be undone. (Archive keeps everything.)`)) return;
    const { error: err } = await supabase.rpc("delete_coordinated_deal", { p_person_id: deal.id });
    if (err) return setError(err.message);
    onChanged?.();
    onClose();
  };
  const menu = edit ? (
    <div className="relative">
      <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-haspopup="menu" aria-expanded={menuOpen} className="grid h-7 w-7 place-items-center rounded-full text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10">
        <span aria-hidden="true" className="text-lg leading-none">⋯</span>
      </button>
      {menuOpen && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setMenuOpen(false)} className="fixed inset-0 z-[55] cursor-default" />
          <div role="menu" className="absolute right-0 z-[60] mt-1 w-64 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1f1f1f] text-[#1c1a17] dark:text-[#faf9f7] py-1 shadow-xl">
            {[
              ["Share a timeline with the client", () => setModal("share")],
              ["Archive", () => setModal("archive")],
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
  ) : null;

  const baseStages = agentStages || BOARDS.transaction.stages;
  const changeDate = (key, v) => {
    setForm((f) => ({ ...f, [key]: v }));
    const val = v || null;
    setFresh((f) => ({ ...f, [key]: val }));
    save({ [key]: val });
  };
  const stages = baseStages.includes(fresh.stage) ? baseStages : [fresh.stage, ...baseStages];
  const side = fresh.side === "both" ? "" : fresh.side;

  const closingDiff = fresh.closing_date ? Math.round((new Date(`${fresh.closing_date}T12:00:00`) - new Date(`${toKey(new Date())}T12:00:00`)) / 86400000) : null;
  const meta = (
    <p className={`mt-0.5 text-xs ${muted} ${docked ? "truncate" : ""}`}>
      {fresh.property_address ? `${fresh.name} · ` : ""}
      {fresh.side === "buyer" ? "Buyer" : fresh.side === "seller" ? "Seller" : "Side not set"} · Agent {agentName || "unknown"}
      {tcNames.length > 0 && ` · TC ${tcNames.join(", ")}`}
      {!edit && " · Read only"}
    </p>
  );
  const header = docked ? (
    <div className="shrink-0 px-6 pt-5 pb-4 space-y-4 border-b border-black/5 dark:border-white/10">
      <div className="flex items-center justify-between gap-3">
        <span className="rounded-full bg-black/[0.06] dark:bg-white/10 px-2.5 py-1 text-xs font-medium">TC for {agentName || "another agent"}</span>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Panel width" className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5">
            {Object.entries(PEEK_WIDTHS).map(([key, w]) => (
              <button
                key={key}
                type="button"
                onClick={() => peek.preset(key)}
                aria-pressed={peek.choice === key}
                aria-label={`${w.label} width`}
                title={`${w.label} width`}
                className={`h-6 w-7 flex items-center justify-center rounded-full transition-colors ${peek.choice === key ? "bg-[#1c1a17] text-white dark:bg-[#faf9f7] dark:text-[#1c1a17]" : "text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`}
              >
                <svg width="14" height="11" viewBox="0 0 14 11" fill="none" aria-hidden="true">
                  <rect x="0.5" y="0.5" width="13" height="10" rx="1.5" stroke="currentColor" />
                  <rect x={key === "narrow" ? 9 : key === "standard" ? 6 : 3} y="1" width={key === "narrow" ? 4.5 : key === "standard" ? 7.5 : 10.5} height="9" rx="1" fill="currentColor" />
                </svg>
              </button>
            ))}
          </div>
          {menu}
          <button type="button" onClick={onClose} aria-label="Close panel" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">✕</button>
        </div>
      </div>
      <div className="min-w-0">
        <h2 className="font-display text-xl font-semibold truncate">{fresh.property_address || fresh.name}</h2>
        {meta}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={fresh.stage}
          onChange={(e) => {
            setFresh((f) => ({ ...f, stage: e.target.value }));
            save({ stage: e.target.value });
          }}
          aria-label="The agent's stage"
          title="The agent's stage for this deal"
          className="rounded-full border border-black/10 dark:border-white/15 bg-transparent px-3 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40"
        >
          {stages.map((st) => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>
        {closingDiff != null && (
          <span className="rounded-full bg-black/[0.06] dark:bg-white/10 px-2.5 py-1 text-xs font-medium">
            {closingDiff > 0 ? `Closes ${dayLabel(fresh.closing_date, toKey(new Date()))} · in ${closingDiff} days` : closingDiff === 0 ? "Closes today" : `Closed ${-closingDiff} days ago`}
          </span>
        )}
        {summary.loaded && (summary.tasksTotal > 0 || summary.docsTotal > 0) && (
          <span className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">
            {summary.tasksTotal > 0 && `Tasks ${summary.tasksDone}/${summary.tasksTotal}`}
            {summary.tasksTotal > 0 && summary.docsTotal > 0 && " · "}
            {summary.docsTotal > 0 && `Docs ${summary.docsDone}/${summary.docsTotal}`}
          </span>
        )}
        <ComplianceChip status={fresh.compliance_status} />
      </div>
    </div>
  ) : (
    <div className="shrink-0 flex items-start justify-between gap-3 border-b border-black/5 dark:border-white/10 px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold truncate">{fresh.property_address || fresh.name}</h2>
          <ComplianceChip status={fresh.compliance_status} />
        </div>
        {meta}
      </div>
      <div className="flex items-center gap-2">
        {menu}
        <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">✕</button>
      </div>
    </div>
  );

  const surface = "bg-white dark:bg-[#161616] text-[#1c1a17] dark:text-[#faf9f7]";
  const shell = (children) =>
    docked ? (
      <aside
        ref={asideRef}
        role="dialog"
        aria-modal="false"
        aria-label={`Deal: ${fresh.name}`}
        style={{ width: peek.css, transform: entered ? "translateX(0)" : "translateX(100%)" }}
        className={`fixed inset-y-0 right-0 z-50 flex flex-col border-l border-black/10 dark:border-white/10 shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.18)] transition-[transform,width] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${peek.resizing ? "!transition-none" : ""} ${surface}`}
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
          <span className={`absolute inset-y-0 left-[5px] w-0.5 transition-colors ${peek.resizing ? "bg-[#ed2127]/70 dark:bg-[#f2454b]/70" : "bg-transparent group-hover:bg-[#ed2127]/40 dark:group-hover:bg-[#f2454b]/40"}`} />
        </div>
        {children}
      </aside>
    ) : (
      <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
        <aside className={`flex h-full w-full lg:w-[60rem] max-w-full flex-col shadow-2xl ${surface}`} aria-label={`Deal: ${fresh.name}`}>
          {children}
        </aside>
      </div>
    );

  return shell(
    <>
      {header}

        <DealTabs tabs={dealTabs(summary, fresh)} active={tab} onChange={setTab} />
        <div className="@container min-h-0 flex-1 space-y-8 overflow-y-auto overscroll-contain px-6 pt-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {error && tab !== "details" && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {tab === "overview" && <DealOverview person={fresh} summary={summary} dates={dealDates} onTab={setTab} onDate={edit ? changeDate : undefined} onCheckTask={edit ? summary.completeTask : undefined}>
            {{
              top: edit ? (
                <div className="flex flex-wrap items-center gap-3">
                  <SendAgentUpdate person={fresh} agentName={agentName} />
                  <button type="button" onClick={() => setModal("share")} className="rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
                    Share with {(fresh.name || "the client").split(/[ &]/)[0]}
                  </button>
                </div>
              ) : null,
            }}
          </DealOverview>}
          {tab === "tasks" && <TransactionModules person={fresh} side={side} viewer={viewer} dates={dealDates} show="tasks" />}
          {tab === "documents" && (
            <div className="space-y-6">
              <DealSignatures person={fresh} viewer={viewer} agent={{ name: agentName || "", email: agentEmail }} />
              <TransactionModules person={fresh} side={side} viewer={viewer} dates={dealDates} show="documents" />
            </div>
          )}
          {tab === "messages" && <DealCompliance person={fresh} viewer={viewer} onChanged={() => { refresh(); summary.reload(); }} />}
          {tab === "details" && (
            <div className="space-y-8">
            <section className="min-w-0 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-base font-semibold">Details</h3>
                {edit && <EditToggle editing={editingDetails} onToggle={() => setEditingDetails((v) => !v)} />}
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              {!(edit && editingDetails) && (
                <div className="space-y-6">
                  <DetailGroup
                    title="Contact"
                    rows={[
                      { label: "Client", value: fresh.name },
                      { label: "Phone", value: fresh.phone, href: fresh.phone ? `tel:${fresh.phone.replace(/[^\d+]/g, "")}` : undefined },
                      { label: "Email", value: fresh.email, href: fresh.email ? `mailto:${fresh.email}` : undefined },
                      { label: "Second client", value: fresh.client2_name },
                      { label: "Second client's email", value: fresh.client2_email, href: fresh.client2_email ? `mailto:${fresh.client2_email}` : undefined },
                    ]}
                  />
                  <DetailGroup
                    title="Deal"
                    rows={[
                      { label: "Buyer or seller", value: fresh.side === "buyer" ? "Buyer" : fresh.side === "seller" ? "Seller (listing)" : "" },
                      { label: deal._foreign ? "Agent's stage" : "Stage", value: fresh.stage },
                      ...(deal._foreign ? [{ label: "Your board column", value: fresh._column }] : []),
                      { label: "Property", value: fresh.property_address, wide: true },
                      { label: "Price", value: fresh.price == null ? "" : money.format(fresh.price) },
                      { label: "Commission", value: fresh.commission == null ? "" : money.format(fresh.commission) },
                      { label: "Earnest money", value: earnestLine({ earnest_money: fresh.earnest_money, earnest_money_delivered: fresh.earnest_money_delivered }, fresh) },
                      { label: "Other agent", value: fresh.other_agent },
                      { label: "Other agent's email", value: fresh.other_agent_email, href: fresh.other_agent_email ? `mailto:${fresh.other_agent_email}` : undefined },
                      { label: "Other agent's TC", value: fresh.other_agent_tc_name },
                      { label: "Other agent's TC email", value: fresh.other_agent_tc_email, href: fresh.other_agent_tc_email ? `mailto:${fresh.other_agent_tc_email}` : undefined },
                      { label: "Title company", value: fresh.title_company },
                      { label: "Title company email", value: fresh.title_company_email, href: fresh.title_company_email ? `mailto:${fresh.title_company_email}` : undefined },
                      { label: "Title processor", value: fresh.title_processor_name },
                      { label: "Title processor email", value: fresh.title_processor_email, href: fresh.title_processor_email ? `mailto:${fresh.title_processor_email}` : undefined },
                      { label: "Lender", value: fresh.lender },
                      { label: "Lender email", value: fresh.lender_email, href: fresh.lender_email ? `mailto:${fresh.lender_email}` : undefined },
                    ]}
                  />
                  {edit && <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Dates are on the Overview tab.</p>}
                </div>
              )}
              <div className={`grid gap-3 sm:grid-cols-2 ${edit && editingDetails ? "" : "hidden"}`}>
                <div>
                  <label className={labelClass}>Client</label>
                  <p className="text-sm">{fresh.name}</p>
                </div>
                {CLIENT1.map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input type={key === "email" ? "email" : "tel"} autoComplete="off" {...bind(key, "text")} className={inputClass} />
                  </div>
                ))}
                {CLIENT2.map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    <input type={key.endsWith("email") ? "email" : "text"} autoComplete="off" {...bind(key, "text")} className={inputClass} />
                  </div>
                ))}
                <div>
                  <label className={labelClass}>Buyer or seller (listing)</label>
                  {edit ? (
                    <select
                      value={fresh.side === "both" ? "" : fresh.side || ""}
                      onChange={(e) => {
                        const v = e.target.value || null;
                        setFresh((f) => ({ ...f, side: v }));
                        save({ side: v });
                      }}
                      className={inputClass}
                    >
                      <option value="">Choose…</option>
                      <option value="buyer">Buyer</option>
                      <option value="seller">Seller (listing)</option>
                    </select>
                  ) : (
                    <p className="text-sm">{fresh.side === "buyer" ? "Buyer" : fresh.side === "seller" ? "Seller (listing)" : "Not set"}</p>
                  )}
                  {edit && <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Picking a side adds the agent's task and document checklists.</p>}
                </div>
                {deal._foreign && edit && (
                  <div>
                    <label className={labelClass}>Your board column</label>
                    <select
                      value={fresh._column || (myColumns.find((c) => c.toLowerCase() === String(fresh.stage || "").toLowerCase()) || "")}
                      onChange={async (e) => {
                        const stage = e.target.value;
                        if (!stage) return;
                        setFresh((f) => ({ ...f, _column: stage }));
                        const { error: err } = await supabase.from("deal_tc_stages").upsert({ person_id: deal.id, tc_id: user.id, stage, updated_at: new Date().toISOString() }, { onConflict: "person_id,tc_id" });
                        if (err) setError(err.message);
                      }}
                      className={inputClass}
                    >
                      <option value="">Choose…</option>
                      {[...new Set([fresh._column, ...myColumns].filter(Boolean))].map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Where it sits on your board. It doesn't change the agent's board.</p>
                  </div>
                )}
                <div>
                  <label className={labelClass}>{deal._foreign ? "Agent's stage" : "Stage"}</label>
                  <select
                    value={fresh.stage}
                    disabled={!edit}
                    onChange={(e) => {
                      setFresh((f) => ({ ...f, stage: e.target.value }));
                      save({ stage: e.target.value });
                    }}
                    className={inputClass}
                  >
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {NUMBERS.map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    {edit ? <input type="number" min="0" step="any" inputMode="decimal" {...bind(key, "number")} className={inputClass} /> : <p className="text-sm">{fresh[key] == null ? "–" : money.format(fresh[key])}</p>}
                  </div>
                ))}
                <label className="flex items-center gap-2.5 text-sm cursor-pointer self-end pb-2.5">
                  <input
                    type="checkbox"
                    checked={!!fresh.earnest_money_delivered}
                    disabled={!edit}
                    onChange={(e) => {
                      const v = e.target.checked;
                      const at = v ? new Date().toISOString() : null;
                      setFresh((f) => ({ ...f, earnest_money_delivered: v, earnest_money_delivered_at: at }));
                      save({ earnest_money_delivered: v, earnest_money_delivered_at: at });
                    }}
                    className="h-4 w-4 accent-[#ed2127]"
                  />
                  <span>Earnest money delivered to the title company</span>
                </label>
                {TEXT.map(([key, label]) => (
                  <div key={key} className={key === "property_address" ? "sm:col-span-2" : ""}>
                    <label className={labelClass}>{label}</label>
                    {edit ? <input type={key.endsWith("email") ? "email" : "text"} {...bind(key, "text")} className={inputClass} /> : <p className="text-sm">{fresh[key] || "–"}</p>}
                  </div>
                ))}
              </div>
            </section>
            </div>
          )}
        </div>
      {modal &&
        createPortal(
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && setModal(null)}>
          <div role="dialog" aria-label={modal === "share" ? "Share with the client" : "Archive this deal"} className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1c1c1c] text-[#1c1a17] dark:text-[#faf9f7] p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">{modal === "share" ? "Share with the client" : "Archive this deal"}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
            </div>
            {modal === "share" ? (
              <ClientTimelineCard person={fresh} dates={dealDates} agentName={agentName || "the agent"} />
            ) : (
              <div className="space-y-3">
                <select value={archiveReason} onChange={(e) => setArchiveReason(e.target.value)} className={inputClass}>
                  {ARCHIVE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">It is {agentName ? `${agentName}'s` : "the agent's"} deal, so it leaves their board too. Nothing is deleted.</p>
                <button type="button" onClick={handleArchive} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5">Archive</button>
                {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function toForm(p) {
  const f = {};
  for (const [k] of [...CLIENT1, ...CLIENT2, ...TEXT]) f[k] = p[k] || "";
  for (const [k] of NUMBERS) f[k] = p[k] == null ? "" : String(p[k]);
  for (const [k] of DATES) f[k] = p[k] || "";
  return f;
}
