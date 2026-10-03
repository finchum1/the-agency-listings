import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";
import { ANCHORS, DEFAULT_TEMPLATES, SIDE_LABELS, ruleLabel } from "../../../lib/checklists";

const inputClass =
  "rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const iconBtn =
  "h-7 w-7 flex items-center justify-center rounded-full text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed";
const SAVE_DELAY_MS = 800;

const clone = (v) => JSON.parse(JSON.stringify(v));

function move(list, from, to) {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

// Edits one side's template. Saves automatically; applying a template to a
// transaction copies it, so changing it here never touches deals already
// in progress.
export default function ChecklistTemplateEditor({ side }) {
  const { user } = useAuth();
  const [sections, setSections] = useState(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const timerRef = useRef(null);
  const latestRef = useRef(null);

  useEffect(() => {
    let active = true;
    setSections(null);
    supabase
      .from("checklist_templates")
      .select("sections")
      .eq("side", side)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const loaded = data?.sections?.length ? data.sections : clone(DEFAULT_TEMPLATES[side]);
        latestRef.current = loaded;
        setSections(loaded);
      });
    return () => {
      active = false;
    };
  }, [side]);

  const save = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (!user?.id || !latestRef.current) return;
    setStatus("Saving…");
    const { error: err } = await supabase.from("checklist_templates").upsert({
      owner_id: user.id,
      side,
      sections: latestRef.current,
      updated_at: new Date().toISOString(),
    });
    if (err) {
      setError(err.message);
      setStatus("");
    } else {
      setError("");
      setStatus("Saved");
    }
  }, [side, user?.id]);

  useEffect(() => () => void (timerRef.current && save()), [save]);

  const edit = (next) => {
    latestRef.current = next;
    setSections(next);
    setStatus("");
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(save, SAVE_DELAY_MS);
  };

  const patchSection = (i, changes) => edit(sections.map((s, idx) => (idx === i ? { ...s, ...changes } : s)));
  const patchItem = (i, j, text) =>
    patchSection(i, { items: sections[i].items.map((t, idx) => (idx === j ? text : t)) });

  const handleReset = async () => {
    if (!confirm(`Replace your ${SIDE_LABELS[side]} template with the original default? Your edits will be lost.`)) return;
    clearTimeout(timerRef.current);
    timerRef.current = null;
    const { error: err } = await supabase.from("checklist_templates").delete().eq("side", side);
    if (err) {
      setError(err.message);
      return;
    }
    const fresh = clone(DEFAULT_TEMPLATES[side]);
    latestRef.current = fresh;
    setSections(fresh);
    setStatus("Reset");
  };

  if (!sections) return <p className={`text-sm ${muted}`}>Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-sm ${muted}`}>
          {sections.reduce((n, s) => n + s.items.length, 0)} tasks in {sections.length} sections
        </p>
        <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{status}</span>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {sections.map((sec, i) => {
        const offset = sec.offset_days || 0;
        return (
          <section key={i} className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                value={sec.title}
                onChange={(e) => patchSection(i, { title: e.target.value })}
                placeholder="Section title"
                className={`${inputClass} flex-1 font-semibold`}
              />
              <button type="button" className={iconBtn} disabled={i === 0} onClick={() => edit(move(sections, i, i - 1))} aria-label="Move section up">
                ↑
              </button>
              <button type="button" className={iconBtn} disabled={i === sections.length - 1} onClick={() => edit(move(sections, i, i + 1))} aria-label="Move section down">
                ↓
              </button>
              <button
                type="button"
                className={`${iconBtn} hover:!text-red-600`}
                onClick={() => {
                  if (confirm(`Delete the "${sec.title || "untitled"}" section and its ${sec.items.length} tasks?`)) edit(sections.filter((_, idx) => idx !== i));
                }}
                aria-label="Delete section"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className={muted}>Due</span>
              <input
                type="number"
                min="0"
                value={Math.abs(offset)}
                onChange={(e) => {
                  const n = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  patchSection(i, { offset_days: offset < 0 ? -n : n });
                }}
                className={`${inputClass} w-20`}
              />
              <span className={muted}>days</span>
              <select
                value={offset < 0 ? "before" : "after"}
                onChange={(e) => {
                  const n = Math.abs(offset) || 1;
                  patchSection(i, { offset_days: e.target.value === "before" ? -n : n });
                }}
                className={inputClass}
              >
                <option value="after">after</option>
                <option value="before">before</option>
              </select>
              <span className={muted}>the</span>
              <select value={sec.anchor} onChange={(e) => patchSection(i, { anchor: e.target.value })} className={inputClass}>
                {ANCHORS.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
            <p className={`text-xs -mt-1 ${muted}`}>{ruleLabel(sec.anchor, offset)}. You can still pick a specific date on any task.</p>

            <ul className="space-y-1.5">
              {sec.items.map((text, j) => (
                <li key={j} className="flex items-start gap-1.5">
                  <textarea
                    value={text}
                    rows={Math.max(1, Math.ceil(text.length / 70))}
                    onChange={(e) => patchItem(i, j, e.target.value)}
                    className={`${inputClass} flex-1 resize-none leading-snug`}
                  />
                  <div className="flex flex-col">
                    <button type="button" className={`${iconBtn} h-5`} disabled={j === 0} onClick={() => patchSection(i, { items: move(sec.items, j, j - 1) })} aria-label="Move task up">
                      ↑
                    </button>
                    <button type="button" className={`${iconBtn} h-5`} disabled={j === sec.items.length - 1} onClick={() => patchSection(i, { items: move(sec.items, j, j + 1) })} aria-label="Move task down">
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    className={`${iconBtn} hover:!text-red-600`}
                    onClick={() => patchSection(i, { items: sec.items.filter((_, idx) => idx !== j) })}
                    aria-label="Delete task"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => patchSection(i, { items: [...sec.items, ""] })}
              className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline"
            >
              + Add task
            </button>
          </section>
        );
      })}

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => edit([...sections, { title: "New section", anchor: "contract_date", offset_days: 7, items: [""] }])}
          className="rounded-full border border-black/10 dark:border-white/15 text-sm font-semibold px-5 py-2.5 hover:bg-black/5 dark:hover:bg-white/10"
        >
          + Add section
        </button>
        <button type="button" onClick={handleReset} className={`text-xs hover:text-red-600 dark:hover:text-red-400 ${muted}`}>
          Reset to default
        </button>
      </div>
    </div>
  );
}
