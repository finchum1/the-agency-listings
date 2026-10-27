import { useState } from "react";
import { BOARDS } from "../../../lib/peopleStages";
import { RELATIONSHIPS } from "../../../lib/contacts";
import { useProspectContacts } from "../../../hooks/useProspectContacts";
import { TagChip } from "./contacts/TagParts";
import PeopleBoard from "./PeopleBoard";
import ProspectsList from "./ProspectsList";

// A setting remembered in this browser (the view below).
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
const control = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const todayKey = () => {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// Leads and Pipeline, built like Deals: the board or a list of the same people, filters that match Contacts (relationship, tag, who's due),
// and cards and rows that show the tags from their contact record. Opening a card opens a panel with Overview, Activity and Details tabs.
export default function ProspectsPage({ group }) {
  const board = BOARDS[group];
  const [view, setView] = useRemembered(`prospectsView:${group}`, "board", ["board", "list"]);
  const [relationship, setRelationship] = useState("");
  const [tagId, setTagId] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [q, setQ] = useState("");
  const { byPerson, tags, tagById, reload } = useProspectContacts(group);

  const filtered = !!(relationship || tagId || dueOnly || q.trim());
  const personFilter = filtered
    ? (p) => {
        const c = byPerson.get(p.id);
        if (relationship && c?.relationship !== relationship) return false;
        if (tagId && !c?.tagIds.includes(tagId)) return false;
        if (dueOnly && !(p.next_follow_up && p.next_follow_up <= todayKey())) return false;
        const needle = q.trim().toLowerCase();
        if (needle && !`${p.name} ${p.email} ${p.phone}`.toLowerCase().includes(needle)) return false;
        return true;
      }
    : undefined;

  const toolbar = ({ ownCount }) => (
    <>
      <div className={seg} role="group" aria-label="View">
        <button type="button" onClick={() => setView("board")} aria-pressed={view === "board"} className={segBtn(view === "board")}>Board</button>
        <button type="button" onClick={() => setView("list")} aria-pressed={view === "list"} className={segBtn(view === "list")}>List</button>
      </div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${board.title.toLowerCase()}`} aria-label={`Search ${board.title}`} className={`${control} w-44 font-normal`} />
      <select value={relationship} onChange={(e) => setRelationship(e.target.value)} aria-label="Relationship" className={control}>
        <option value="">Any relationship</option>
        {RELATIONSHIPS.map((r) => (
          <option key={r.value} value={r.value}>{r.label}</option>
        ))}
      </select>
      {tags.length > 0 && (
        <select value={tagId} onChange={(e) => setTagId(e.target.value)} aria-label="Tag" className={control}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}
      <button type="button" onClick={() => setDueOnly((v) => !v)} aria-pressed={dueOnly} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${dueOnly ? "border-[#1c1a17] bg-[#1c1a17] text-white dark:border-[#faf9f7] dark:bg-[#faf9f7] dark:text-[#1c1a17]" : "border-black/10 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}`}>
        Due now
      </button>
      {filtered && (
        <button type="button" onClick={() => { setRelationship(""); setTagId(""); setDueOnly(false); setQ(""); }} className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55 underline underline-offset-2">
          Clear
        </button>
      )}
      <span role="status" className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">
        {filtered ? `${ownCount} shown` : `${ownCount} ${ownCount === 1 ? "person" : "people"}`}
      </span>
    </>
  );

  const cardExtra = (p) => {
    const t = (byPerson.get(p?.id)?.tagIds || []).map((id) => tagById.get(id)).filter(Boolean);
    if (!t.length) return null;
    return (
      <div className="flex flex-wrap items-center gap-1">
        {t.slice(0, 2).map((x) => (
          <TagChip key={x.id} tag={x} size="sm" />
        ))}
        {t.length > 2 && <span className="text-[10px] text-[#1c1a17]/50 dark:text-[#faf9f7]/50">+{t.length - 2}</span>}
      </div>
    );
  };

  return (
    <PeopleBoard
      group={group}
      view={view}
      toolbarLeft={toolbar}
      personFilter={personFilter}
      cardExtra={cardExtra}
      onPeopleChanged={reload}
      renderList={(props) => <ProspectsList {...props} group={group} title={board.title} info={byPerson} tagById={tagById} />}
    />
  );
}
