import { useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { Link } from "react-router-dom";
import { useTransactionDocuments } from "../../../hooks/useTransactionDocuments";
import { SIDE_LABELS, loadDocumentTemplate } from "../../../lib/checklists";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const smallInput =
  "rounded-md border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40";

// The deal's document checklist — the paperwork to collect for a buyer or
// seller/listing deal. Mirrors TransactionChecklist (sections, completed
// toggle) without due dates.
//
// viewer: "owner" (the agent), "tc" (their coordinator: can tick and edit) or "compliance" (reads the list and marks each
// document OK or needs fixing). Everyone sees those marks.
export default function TransactionDocuments({ person, side, onSummary, viewer = "owner" }) {
  const { docs, loading, error, applyTemplate, addDoc, updateDoc, removeDoc, clearAll, reload } = useTransactionDocuments(person.id);
  const reviewer = viewer === "compliance";
  const canTemplate = viewer === "owner";
  const [flagging, setFlagging] = useState(null); // { id, note } while compliance types why a document needs fixing
  const [markError, setMarkError] = useState("");
  const mark = async (id, status, note = "") => {
    setMarkError("");
    const { error: err } = await supabase.rpc("deal_mark_document", { p_doc: id, p_status: status, p_note: note });
    if (err) setMarkError(err.message);
    setFlagging(null);
    reload();
  };
  const [collapsed, setCollapsed] = useState({});
  const [completedShown, setCompletedShown] = useState({});
  const [addingTo, setAddingTo] = useState(null);
  const [newText, setNewText] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    if (!loading) onSummary?.({ done: docs.filter((d) => d.done).length, total: docs.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, loading]);

  // Picking a side applies that side's document list automatically.
  // Switching sides swaps it too, but only while nothing has been ticked
  // off, so collected documents are never thrown away.
  const prevSide = useRef(side);
  const docsRef = useRef(docs);
  docsRef.current = docs;
  useEffect(() => {
    const prev = prevSide.current;
    if (loading || prev === side || !canTemplate) return;
    prevSide.current = side;
    if (!side) return;
    const current = docsRef.current;
    const swap = current.length > 0 && prev && !current.some((d) => d.done);
    if (current.length > 0 && !swap) return;
    (async () => {
      setWorking(true);
      if (swap) await clearAll();
      await applyTemplate(await loadDocumentTemplate(side));
      setWorking(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side, loading]);

  // A section whose items are all done collapses itself. `collapsed` only
  // holds the user's manual choices; ticking off the last item (or
  // un-ticking / adding one) clears that section's choice so it follows
  // the automatic rule again.
  const completeKey = (() => {
    const total = {};
    const done = {};
    for (const d of docs) {
      total[d.section] = (total[d.section] || 0) + 1;
      if (d.done) done[d.section] = (done[d.section] || 0) + 1;
    }
    return Object.keys(total)
      .filter((title) => done[title] === total[title])
      .join("\u0001");
  })();
  const prevComplete = useRef(null);
  useEffect(() => {
    if (loading) return;
    const now = new Set(completeKey ? completeKey.split("\u0001") : []);
    const prev = prevComplete.current;
    prevComplete.current = now;
    if (!prev) return;
    const changed = [...now].filter((t) => !prev.has(t)).concat([...prev].filter((t) => !now.has(t)));
    if (changed.length)
      setCollapsed((c) => {
        const next = { ...c };
        for (const t of changed) delete next[t];
        return next;
      });
  }, [completeKey, loading]);

  if (loading) return null;

  const sections = [];
  for (const d of [...docs].sort((a, b) => a.position - b.position)) {
    let sec = sections.find((s) => s.title === d.section);
    if (!sec) {
      sec = { title: d.section, docs: [] };
      sections.push(sec);
    }
    sec.docs.push(d);
  }

  const handleApply = async () => {
    setWorking(true);
    await applyTemplate(await loadDocumentTemplate(side));
    setWorking(false);
  };

  const handleClear = async () => {
    if (!confirm("Remove every document from this list? You can add your template again afterward.")) return;
    setWorking(true);
    await clearAll();
    setWorking(false);
  };

  const submitNew = async (e, title) => {
    e.preventDefault();
    if (!newText.trim()) return;
    await addDoc(title, newText.trim());
    setNewText("");
    setAddingTo(null);
  };

  const renderDoc = (d) => (
    <li key={d.id} className="rounded-lg px-1 py-1.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={d.done}
          disabled={reviewer}
          onChange={(e) =>
            updateDoc(d.id, { done: e.target.checked, done_at: e.target.checked ? new Date().toISOString() : null })
          }
          className="mt-1 h-4 w-4 shrink-0 accent-[#ed2127]"
        />
        <textarea
          defaultValue={d.text}
          readOnly={reviewer}
          rows={Math.max(1, Math.ceil(d.text.length / 42))}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (!v) e.target.value = d.text;
            else if (v !== d.text && !reviewer) updateDoc(d.id, { text: v });
          }}
          className={`min-w-0 flex-1 resize-none bg-transparent text-sm leading-snug focus:outline-none focus:bg-black/[0.03] dark:focus:bg-white/[0.05] rounded ${
            d.done ? "line-through opacity-50" : ""
          }`}
        />
        {d.review_status === "ok" && (
          <span title="Compliance marked this OK" className="shrink-0 mt-0.5 rounded-full bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 text-[11px] font-semibold">
            OK
          </span>
        )}
        {d.review_status === "issue" && (
          <span title="Compliance flagged this" className="shrink-0 mt-0.5 rounded-full bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300 px-2 py-0.5 text-[11px] font-semibold">
            Needs fixing
          </span>
        )}
        {!reviewer && (
          <button
            type="button"
            onClick={() => removeDoc(d.id)}
            aria-label="Delete document"
            className="shrink-0 px-1 text-[#1c1a17]/30 dark:text-[#faf9f7]/30 hover:text-red-600 dark:hover:text-red-400"
          >
            ✕
          </button>
        )}
      </div>
      {d.review_status === "issue" && d.review_note && (
        <p className="ml-6 mt-1 text-xs text-red-700 dark:text-red-300">{d.review_note}</p>
      )}
      {reviewer && (
        <div className="ml-6 mt-1.5 flex flex-wrap items-center gap-2">
          {flagging?.id === d.id ? (
            <form
              className="flex w-full items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                mark(d.id, "issue", flagging.note);
              }}
            >
              <input
                autoFocus
                value={flagging.note}
                onChange={(e) => setFlagging({ id: d.id, note: e.target.value })}
                placeholder="What needs fixing?"
                aria-label="What needs fixing"
                className={`${smallInput} min-w-0 flex-1 py-1.5`}
              />
              <button type="submit" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b]">Flag</button>
              <button type="button" onClick={() => setFlagging(null)} className={`text-xs ${muted}`}>Cancel</button>
            </form>
          ) : (
            <>
              <button
                type="button"
                onClick={() => mark(d.id, d.review_status === "ok" ? null : "ok")}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  d.review_status === "ok" ? "border-emerald-600 bg-emerald-600 text-white" : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {d.review_status === "ok" ? "Marked OK" : "Mark OK"}
              </button>
              <button
                type="button"
                onClick={() => (d.review_status === "issue" ? mark(d.id, null) : setFlagging({ id: d.id, note: "" }))}
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                  d.review_status === "issue" ? "border-red-600 bg-red-600 text-white" : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                {d.review_status === "issue" ? "Flagged · clear" : "Flag a problem"}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );

  const addForm = (title) =>
    reviewer ? null : addingTo === title ? (
      <form onSubmit={(e) => submitNew(e, title)} className="flex items-center gap-2 ml-1">
        <input
          autoFocus
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="New document"
          className={`${smallInput} flex-1 py-1.5`}
        />
        <button type="submit" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b]">
          Add
        </button>
        <button type="button" onClick={() => setAddingTo(null)} className={`text-xs ${muted}`}>
          Cancel
        </button>
      </form>
    ) : (
      <button
        type="button"
        onClick={() => {
          setAddingTo(title);
          setNewText("");
        }}
        className="ml-1 text-xs font-medium text-[#ed2127] dark:text-[#f2454b] hover:underline"
      >
        + Add document
      </button>
    );

  return (
    <div className="space-y-3">
      {(error || markError) && <p className="text-sm text-red-600 dark:text-red-400">{error || markError}</p>}

      {docs.length === 0 ? (
        <div className="space-y-2">
          {!canTemplate ? (
            <>
              <p className={`text-sm ${muted}`}>No documents on this deal yet.</p>
              {addForm("Documents")}
            </>
          ) : side ? (
            <>
              <p className={`text-sm ${muted}`}>No documents on this deal yet.</p>
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={working}
                  className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 disabled:opacity-60"
                >
                  {working ? "Adding…" : `Add ${SIDE_LABELS[side]} documents`}
                </button>
                {addForm("Documents")}
              </div>
              <p className={`text-xs ${muted}`}>
                Set up your {SIDE_LABELS[side].toLowerCase()} document list in{" "}
                <Link to="/dashboard/settings" className="underline hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
                  Settings
                </Link>
                .
              </p>
            </>
          ) : (
            <p className={`text-sm ${muted}`}>Choose Buyer or Seller in Details above and the document list is added automatically.</p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {sections.map((sec) => {
            // A reviewer sees every document in the section, collected or not, and sections start open.
            const collected = sec.docs.filter((d) => d.done).length;
            const openDocs = reviewer ? sec.docs : sec.docs.filter((d) => !d.done);
            const doneDocs = reviewer ? [] : sec.docs.filter((d) => d.done);
            const open = collapsed[sec.title] === undefined ? reviewer || collected < sec.docs.length : !collapsed[sec.title];
            const completedOpen = !!completedShown[sec.title];
            return (
              <div key={sec.title} className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [sec.title]: open }))}
                  className="w-full flex items-center justify-between gap-2 text-left"
                  aria-expanded={open}
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      className={`shrink-0 transition-transform ${open ? "rotate-90" : ""}`}
                    >
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-sm font-semibold truncate">{sec.title}</span>
                  </span>
                  <span className={`text-xs shrink-0 ${muted}`}>
                    {collected}/{sec.docs.length}
                  </span>
                </button>
                {open && (
                  <>
                    <ul className="space-y-1">{openDocs.map(renderDoc)}</ul>
                    {addForm(sec.title)}
                    {doneDocs.length > 0 && (
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => setCompletedShown((c) => ({ ...c, [sec.title]: !completedOpen }))}
                          aria-expanded={completedOpen}
                          className={`flex items-center gap-1.5 text-xs font-medium hover:text-[#1c1a17] dark:hover:text-[#faf9f7] ${muted}`}
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 24 24"
                            fill="none"
                            className={`shrink-0 transition-transform ${completedOpen ? "rotate-90" : ""}`}
                          >
                            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          Collected ({doneDocs.length})
                        </button>
                        {completedOpen && <ul className="space-y-1 mt-1">{doneDocs.map(renderDoc)}</ul>}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
          {canTemplate && (
            <button
              type="button"
              onClick={handleClear}
              disabled={working}
              className={`text-xs hover:text-red-600 dark:hover:text-red-400 ${muted}`}
            >
              Remove document list
            </button>
          )}
        </div>
      )}
    </div>
  );
}
