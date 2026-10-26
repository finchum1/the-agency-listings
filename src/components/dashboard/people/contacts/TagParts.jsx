import { useEffect, useRef, useState } from "react";
import { TAG_COLORS, TAG_COLOR_NAMES } from "../../../../lib/contacts";

export function TagChip({ tag, onRemove, size = "md" }) {
  if (!tag) return null;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"} ${TAG_COLORS[tag.color] || TAG_COLORS.gray}`}>
      {tag.name}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${tag.name}`} className="-mr-1 h-4 w-4 grid place-items-center rounded-full hover:bg-black/10 dark:hover:bg-white/15">
          ×
        </button>
      )}
    </span>
  );
}

const pop = "absolute z-30 mt-1 w-64 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-xl p-2";

/** Type to find a tag or make a new one. onPick(tag) is called with an existing or newly created tag. */
export function TagPicker({ tags, exclude = [], onPick, onCreate, label = "Add tag", align = "left", onDark = false }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const off = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", off);
    return () => document.removeEventListener("pointerdown", off);
  }, [open]);
  const query = q.trim().toLowerCase();
  const options = tags.filter((t) => !exclude.includes(t.id) && (!query || t.name.toLowerCase().includes(query)));
  const exact = tags.some((t) => t.name.toLowerCase() === query);
  const choose = async (tag) => {
    setOpen(false);
    setQ("");
    await onPick(tag);
  };
  return (
    <div className="relative inline-block" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} className={onDark ? "rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20" : "rounded-full border border-dashed border-black/25 dark:border-white/30 px-2.5 py-1 text-xs font-semibold text-[#1c1a17]/65 dark:text-[#faf9f7]/65 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}>
        {onDark ? label : `+ ${label}`}
      </button>
      {open && (
        <div className={`${pop} ${align === "right" ? "right-0" : "left-0"}`}>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (options[0] && (query === "" || options[0].name.toLowerCase() === query || !onCreate)) await choose(options[0]);
                else if (query && onCreate && !exact) {
                  const t = await onCreate(q.trim());
                  if (t) await choose(t);
                }
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="Find or create a tag"
            className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm"
          />
          <ul className="mt-1 max-h-52 overflow-y-auto">
            {options.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => choose(t)} className="w-full text-left rounded-lg px-2 py-1.5 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                  <TagChip tag={t} size="sm" />
                </button>
              </li>
            ))}
            {onCreate && query && !exact && (
              <li>
                <button
                  type="button"
                  onClick={async () => {
                    const t = await onCreate(q.trim());
                    if (t) await choose(t);
                  }}
                  className="w-full text-left rounded-lg px-2 py-1.5 text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                >
                  Create “{q.trim()}”
                </button>
              </li>
            )}
            {options.length === 0 && !(onCreate && query) && <li className="px-2 py-1.5 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">No tags yet. Type a name to make one.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Rename, recolor and delete tags. */
export function ManageTags({ tags, links, onClose, onUpdate, onDelete }) {
  const count = (id) => links.filter((l) => l.tag_id === id).length;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl" role="dialog" aria-label="Manage tags">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-semibold">Manage tags</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            ✕
          </button>
        </div>
        {tags.length === 0 && <p className="mt-4 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">No tags yet. Add one from a contact.</p>}
        <ul className="mt-4 space-y-3">
          {tags.map((t) => (
            <li key={t.id} className="rounded-xl border border-black/10 dark:border-white/10 p-3">
              <div className="flex items-center gap-3">
                <input defaultValue={t.name} onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== t.name && onUpdate(t.id, { name: e.target.value.trim().slice(0, 40) })} className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-1.5 text-sm" aria-label="Tag name" />
                <span className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 shrink-0">{count(t.id)} contact{count(t.id) === 1 ? "" : "s"}</span>
                <button
                  type="button"
                  onClick={() => confirm(`Delete the tag “${t.name}”? It's removed from ${count(t.id)} contact${count(t.id) === 1 ? "" : "s"}; the contacts stay.`) && onDelete(t.id)}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0"
                >
                  Delete
                </button>
              </div>
              <div className="mt-2 flex gap-1.5" role="group" aria-label="Tag color">
                {TAG_COLOR_NAMES.map((c) => (
                  <button key={c} type="button" onClick={() => onUpdate(t.id, { color: c })} aria-label={c} aria-pressed={t.color === c} className={`h-6 w-6 rounded-full ${TAG_COLORS[c]} ${t.color === c ? "ring-2 ring-[#1c1a17] dark:ring-white" : ""}`} />
                ))}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
