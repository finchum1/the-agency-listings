import { useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useContacts } from "../../../../hooks/useContacts";
import { addDays, dayLabel, toKey } from "../../../../lib/homeDates";
import { BOARDS } from "../../../../lib/peopleStages";
import { EMPTY_FILTERS, RELATIONSHIPS, SORTS, addressLine, applyFilters, bestToKeep, duplicateGroups, cityLine, fullName, hasFilters, initials, lastContactLabel, relationshipLabel, sortContacts, toCsv, touchDue } from "../../../../lib/contacts";
import { ManageTags, TagChip, TagPicker } from "./TagParts";
import ContactPanel from "./ContactPanel";
import ImportContacts from "./ImportContacts";
import useUrlParamSync from "../../../../hooks/useUrlParamSync";
import StartPlanModal from "../StartPlanModal";
import { usePeopleStages } from "../../../../hooks/usePeopleStages";

// The list's columns on a wide screen. A column is either a fixed width (`fixed`) or flexible (`min` pixels and a share `fr` of the spare room). Dragging a
// header's right edge sets a width of your own (kept in this browser); until then a column uses these.
const COLUMNS = [
  { key: "name", title: "Name", min: 230, fr: 1.5 },
  { key: "phone", title: "Phone", fixed: 136 },
  { key: "email", title: "Email", min: 190, fr: 1.5 },
  { key: "address", title: "Address", min: 144, fr: 1.4 },
  { key: "tags", title: "Tags", min: 96, fr: 1 },
  { key: "relationship", title: "Relationship", fixed: 136 },
  { key: "contacted", title: "Last in touch", fixed: 88 },
  { key: "followup", title: "Follow-up", fixed: 88 },
];
const WIDTHS_KEY = "contactsColumnWidths";
const readWidths = () => {
  try {
    const v = JSON.parse(window.localStorage.getItem(WIDTHS_KEY) || "{}");
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
};
const gridFor = (widths) => ["40px", ...COLUMNS.map((c) => (widths[c.key] ? `${widths[c.key]}px` : c.fixed ? `${c.fixed}px` : `minmax(${c.min}px,${c.fr}fr)`))].join(" ");
const minWidthFor = (widths) => 40 + 24 + COLUMNS.reduce((n, c) => n + (widths[c.key] || c.fixed || c.min) + 12, 0);
const select = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const pill = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-2 text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#1c1a17]/90 disabled:opacity-60";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const PAGE = 100;
const BOARD_LETTER = { lead: ["L", "Lead"], pipeline: ["P", "Pipeline"], transaction: ["T", "Transaction"] };

function Modal({ title, onClose, children, width = "max-w-md" }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`w-full ${width} max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1a1a1a] p-6 shadow-2xl`} role="dialog" aria-label={title}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddContact({ onClose, onAdd }) {
  const [f, setF] = useState({ first_name: "", last_name: "", company: "", email: "", phone: "", relationship: "sphere" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const { error: err, contact } = await onAdd({ ...f, email: f.email.trim().toLowerCase() });
    setBusy(false);
    if (err) return setError(err);
    onClose(contact);
  };
  return (
    <Modal title="Add a contact" onClose={() => onClose()}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <input autoFocus value={f.first_name} onChange={set("first_name")} placeholder="First name" aria-label="First name" className={select} />
          <input value={f.last_name} onChange={set("last_name")} placeholder="Last name" aria-label="Last name" className={select} />
        </div>
        <input value={f.company} onChange={set("company")} placeholder="Company (optional)" aria-label="Company" className={`${select} w-full`} />
        <div className="grid grid-cols-2 gap-3">
          <input type="email" value={f.email} onChange={set("email")} placeholder="Email" aria-label="Email" className={select} />
          <input type="tel" value={f.phone} onChange={set("phone")} placeholder="Phone" aria-label="Phone" className={select} />
        </div>
        <select value={f.relationship} onChange={set("relationship")} aria-label="Relationship" className={`${select} w-full`}>
          {RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error.includes("contacts_has_a_name") ? "Add a name or a company." : error}</p>}
        <button type="submit" disabled={busy || !(f.first_name || f.last_name || f.company).trim()} className={primary}>
          {busy ? "Adding…" : "Add contact"}
        </button>
      </form>
    </Modal>
  );
}

function BulkFollowUp({ count, onClose, onSave }) {
  const [title, setTitle] = useState("");
  const [due, setDue] = useState(toKey(addDays(new Date(), 7)));
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={`Follow up with ${count} contact${count === 1 ? "" : "s"}`} onClose={onClose}>
      <div className="space-y-3">
        <p className={`text-sm ${muted}`}>Each person gets their own to-do on the date you pick.</p>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Follow up with {name}" aria-label="To-do title" className={`${select} w-full`} />
        <p className={`text-xs ${muted}`}>Leave it blank to use "Follow up with" and their name. Use {"{name}"} to put their name in your own wording.</p>
        <input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className={select} />
        <button type="button" disabled={busy || !due} onClick={async () => { setBusy(true); await onSave(title.trim(), due); setBusy(false); onClose(); }} className={primary}>
          {busy ? "Scheduling…" : "Schedule follow-ups"}
        </button>
      </div>
    </Modal>
  );
}

// Puts the picked contacts on the Leads or Pipeline board, in the column you choose. They stay in Contacts too: each card is linked to its contact, so their
// notes, tags and follow-ups are the same on both sides. Anyone already on that board, archived, or marked do not contact is left out.
function AddToBoardModal({ picked, cards, stages, onClose, onAdd }) {
  const [group, setGroup] = useState("lead");
  const [stage, setStage] = useState(stages.lead[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const onBoard = (c) => cards.some((x) => x.contact_id === c.id && x.stage_group === group);
  const blocked = picked.filter((c) => c.archived || c.do_not_contact);
  const already = picked.filter((c) => !c.archived && !c.do_not_contact && onBoard(c));
  const eligible = picked.filter((c) => !c.archived && !c.do_not_contact && !onBoard(c));
  const pickGroup = (g) => {
    setGroup(g);
    setStage(stages[g][0]);
  };
  return (
    <Modal title={`Add ${picked.length} contact${picked.length === 1 ? "" : "s"} to a board`} onClose={onClose}>
      <div className="space-y-4">
        <p className={`text-sm ${muted}`}>They stay in Contacts. Each one also gets a card on the board, linked to their contact, so notes and follow-ups stay together.</p>
        <div className="flex gap-2" role="group" aria-label="Board">
          {["lead", "pipeline"].map((g) => (
            <button key={g} type="button" aria-pressed={group === g} onClick={() => pickGroup(g)} className={`${pill} ${group === g ? "bg-[#1c1a17] text-white border-[#1c1a17] dark:bg-[#f2454b] dark:border-[#f2454b]" : ""}`}>
              {BOARDS[g].title}
            </button>
          ))}
        </div>
        <div>
          <label htmlFor="board-stage" className={`mb-1.5 block text-xs font-medium ${muted}`}>Put them in this column</label>
          <select id="board-stage" value={stage} onChange={(e) => setStage(e.target.value)} className={`${select} w-full`}>
            {stages[group].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <ul className={`space-y-1 text-sm ${muted}`}>
          <li><strong className="text-[#1c1a17] dark:text-[#faf9f7]">{eligible.length}</strong> will be added to {BOARDS[group].title}.</li>
          {already.length > 0 && <li>{already.length} already {already.length === 1 ? "has a card" : "have cards"} there and will be left alone.</li>}
          {blocked.length > 0 && <li>{blocked.length} {blocked.length === 1 ? "is" : "are"} archived or marked do not contact and will be skipped.</li>}
        </ul>
        {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="button"
          disabled={busy || eligible.length === 0}
          onClick={async () => {
            setBusy(true);
            const err = await onAdd(group, stage, eligible, already.length);
            setBusy(false);
            if (err) setError(err);
            else onClose();
          }}
          className={primary}
        >
          {busy ? "Adding…" : `Add ${eligible.length} to ${BOARDS[group].title}`}
        </button>
      </div>
    </Modal>
  );
}

const DUP_KEY = "contactsNotDuplicates";
const readNotDupes = () => {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DUP_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const REASON = { email: "Same email", phone: "Same phone", name: "Same name" };

// Contacts that look like the same person, grouped, with a button to merge each group into the one you keep. Merging moves notes, tags, follow-ups and
// board cards onto the kept contact and fills in what it was missing. A group you say is not the same person is hidden from now on (in this browser).
function DuplicatesModal({ groups, boardsByContact, onClose, onMerge }) {
  const [hidden, setHidden] = useState(readNotDupes);
  const [keep, setKeep] = useState({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const shown = groups.filter((g) => !hidden.has(g.id));
  const notSame = (g) => {
    const next = new Set(hidden).add(g.id);
    setHidden(next);
    try {
      window.localStorage.setItem(DUP_KEY, JSON.stringify([...next]));
    } catch {
      /* hidden until the page reloads */
    }
  };
  const merge = async (g) => {
    const keepId = keep[g.id] || bestToKeep(g.members).id;
    setBusy(g.id);
    setError("");
    for (const m of g.members.filter((x) => x.id !== keepId)) {
      const r = await onMerge(keepId, m.id);
      if (r.error) {
        setError(r.error);
        break;
      }
    }
    setBusy("");
  };
  return (
    <Modal title={shown.length ? `${shown.length} possible repeat${shown.length === 1 ? "" : "s"}` : "No repeats found"} onClose={onClose} width="max-w-2xl">
      <p className={`text-sm ${muted}`}>People who share an email, a phone number or a name. Pick the one to keep in each group and merge. "Same name only" is the weakest match, so look before you merge.</p>
      {shown.length === 0 && <p className={`mt-4 text-sm ${muted}`}>Nothing to merge right now.</p>}
      <div className="mt-4 space-y-4">
        {shown.map((g) => {
          const keepId = keep[g.id] || bestToKeep(g.members).id;
          return (
            <div key={g.id} className="rounded-xl border border-black/10 dark:border-white/15 p-3">
              <p className={`mb-2 text-xs font-semibold uppercase tracking-wide ${muted}`}>{g.reasons.length === 1 && g.reasons[0] === "name" ? "Same name only" : g.reasons.map((r) => REASON[r]).join(" · ")}</p>
              <div className="space-y-1.5">
                {g.members.map((c) => (
                  <label key={c.id} className={`flex items-start gap-3 rounded-lg border p-2.5 cursor-pointer ${keepId === c.id ? "border-[#ed2127] dark:border-[#f2454b] bg-[#ed2127]/[0.04]" : "border-black/10 dark:border-white/15"}`}>
                    <input type="radio" name={`keep-${g.id}`} checked={keepId === c.id} onChange={() => setKeep((k) => ({ ...k, [g.id]: c.id }))} className="mt-1 accent-[#ed2127]" />
                    <span className="min-w-0 text-sm">
                      <span className="flex items-center gap-1.5">
                        <span className="font-semibold">{fullName(c)}</span>
                        {[...(boardsByContact.get(c.id) || [])].map((b) => (
                          <span key={b} title={`On ${BOARDS[b].title}`} className="grid h-4 w-4 place-items-center rounded bg-[#1c1a17]/80 text-[9px] font-bold text-white">{BOARD_LETTER[b][0]}</span>
                        ))}
                      </span>
                      <span className={`block truncate ${muted}`}>{[c.email, c.phone, cityLine(c), relationshipLabel(c.relationship)].filter(Boolean).join(" · ")}</span>
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => merge(g)} disabled={Boolean(busy)} className={`${primary} !px-4 !py-2 !text-xs`}>
                  {busy === g.id ? "Merging…" : `Merge ${g.members.length} into the one I picked`}
                </button>
                <button type="button" onClick={() => notSame(g)} disabled={Boolean(busy)} className={`text-xs font-semibold hover:underline ${muted}`}>
                  Not the same person
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </Modal>
  );
}

function MergeModal({ pair, onClose, onMerge }) {
  const [keep, setKeep] = useState(pair[0].id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <Modal title="Merge these two contacts" onClose={onClose}>
      <p className={`text-sm ${muted}`}>Pick the one to keep. Notes, tags, follow-ups and cards from the other move onto it, and anything the kept one is missing is filled in.</p>
      <div className="mt-4 space-y-2">
        {pair.map((c) => (
          <label key={c.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer ${keep === c.id ? "border-[#ed2127] dark:border-[#f2454b] bg-[#ed2127]/[0.04]" : "border-black/10 dark:border-white/15"}`}>
            <input type="radio" name="keep" checked={keep === c.id} onChange={() => setKeep(c.id)} className="mt-1 accent-[#ed2127]" />
            <span className="text-sm">
              <span className="block font-semibold">{fullName(c)}</span>
              <span className={`block ${muted}`}>{[c.email, c.phone, cityLine(c)].filter(Boolean).join(" · ") || "No contact details"}</span>
            </span>
          </label>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const { error: err } = await onMerge(keep, pair.find((c) => c.id !== keep).id);
          setBusy(false);
          if (err) setError(err);
          else onClose();
        }}
        className={`${primary} mt-4`}
      >
        {busy ? "Merging…" : "Merge"}
      </button>
    </Modal>
  );
}

// People > Contacts: everyone in your database. Search, filter by tag / relationship / last contact / follow-up, save the views you
// use as smart lists, act on many people at once, and open anyone for their details, follow-ups and history.
export default function ContactsPage() {
  const crm = useContacts();
  const { stages } = usePeopleStages();
  const { contacts, tags, cards, ctx, lists, loading, error } = crm;
  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, dates: new URLSearchParams(window.location.search).get("dates") || "" }));
  const [sort, setSort] = useState("name");
  const [desc, setDesc] = useState(false);
  const [activeList, setActiveList] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(() => new URLSearchParams(window.location.search).get("contact"));
  useUrlParamSync("contact", openId);
  const [modal, setModal] = useState(() => (new URLSearchParams(window.location.search).get("new") ? "add" : null)); // add | import | tags | followup | merge
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [widths, setWidths] = useState(readWidths);

  const filtered = useMemo(() => sortContacts(applyFilters(contacts, filters, ctx), sort, ctx, desc), [contacts, filters, sort, desc, ctx]);
  const visible = filtered.slice(0, shown);
  const picked = filtered.filter((c) => selected.has(c.id));
  const open = contacts.find((c) => c.id === openId);
  const active = useMemo(() => contacts.filter((c) => !c.archived), [contacts]);
  const dueCount = active.filter(touchDue).length;
  // How many people each relationship and tag has, shown in the filter menus so you know the size before you pick one.
  const relCounts = useMemo(() => {
    const c = {};
    for (const p of active) c[p.relationship] = (c[p.relationship] || 0) + 1;
    return c;
  }, [active]);
  const tagCounts = useMemo(() => {
    const c = new Map();
    for (const p of active) for (const id of ctx.tagsByContact.get(p.id) || []) c.set(id, (c.get(id) || 0) + 1);
    return c;
  }, [active, ctx]);
  const filtersOn = hasFilters(filters);
  const set = (patch) => {
    setFilters((f) => ({ ...f, ...patch }));
    setActiveList("");
    setShown(PAGE);
  };

  const saveWidths = (next) => {
    setWidths(next);
    try {
      window.localStorage.setItem(WIDTHS_KEY, JSON.stringify(next));
    } catch {
      /* the widths just last until the page reloads */
    }
  };
  // Drag the right edge of a header to resize that column (or use the arrow keys on it); double-click puts it back.
  const startResize = (key) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.currentTarget.parentElement;
    const startX = e.clientX;
    const startW = cell.getBoundingClientRect().width;
    let latest = widths;
    const move = (ev) => {
      latest = { ...widths, [key]: Math.round(Math.min(700, Math.max(64, startW + ev.clientX - startX))) };
      setWidths(latest);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveWidths(latest);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const nudge = (key) => (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const cell = e.currentTarget.parentElement;
    const now = widths[key] || Math.round(cell.getBoundingClientRect().width);
    saveWidths({ ...widths, [key]: Math.min(700, Math.max(64, now + (e.key === "ArrowRight" ? 24 : -24))) });
  };
  const resetWidth = (key) => {
    const { [key]: _gone, ...rest } = widths;
    saveWidths(rest);
  };
  const customWidths = Object.keys(widths).length > 0;
  const sortBy = (key) => {
    if (sort === key) setDesc((d) => !d);
    else {
      setSort(key);
      setDesc(false);
    }
  };
  const moveList = (id, to) => {
    const ids = lists.map((l) => l.id);
    const from = ids.indexOf(id);
    if (from < 0 || to < 0 || to >= ids.length || to === from) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    crm.reorderLists(ids);
  };
  const flash = (m) => {
    setNote(m);
    setTimeout(() => setNote((n) => (n === m ? "" : n)), 3500);
  };
  const toggle = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const allShownSelected = visible.length > 0 && visible.every((c) => selected.has(c.id));

  const createTag = async (name) => crm.ensureTag(name);
  const bulkTag = async (tag) => {
    await crm.tagMany(picked.map((c) => c.id), tag.id);
    flash(`Tagged ${picked.length} with “${tag.name}”.`);
  };
  const bulkUntag = async (tag) => {
    await crm.untagMany(picked.map((c) => c.id), tag.id);
    flash(`Removed “${tag.name}” from ${picked.length}.`);
  };
  const bulkFollowUp = async (title, due) => {
    const rows = picked.slice(0, 500).map((c) => ({ title: (title ? title.replace(/\{name\}/gi, fullName(c)) : `Follow up with ${fullName(c)}`).slice(0, 300), due_date: due, contact_id: c.id }));
    const { error: err } = await supabase.from("agent_tasks").insert(rows);
    if (err) flash(err.message);
    else {
      flash(`Scheduled ${rows.length} follow-up${rows.length === 1 ? "" : "s"} for ${dayLabel(due, toKey(new Date()))}.`);
      crm.reload();
    }
  };
  // One card per contact on the board, in the chosen column. Returns an error message, or null when it worked.
  const addToBoard = async (group, stage, list, already) => {
    const rows = list.map((c) => ({ name: fullName(c), email: c.email || "", phone: c.phone || "", source: "From Contacts", stage_group: group, stage, contact_id: c.id }));
    for (let i = 0; i < rows.length; i += 200) {
      const { error: err } = await supabase.from("people").insert(rows.slice(i, i + 200));
      if (err) {
        crm.reload();
        return `${err.message}${i ? ` (${i} were added before it stopped.)` : ""}`;
      }
    }
    crm.reload();
    setSelected(new Set());
    flash(`Added ${rows.length} to ${BOARDS[group].title} (${stage}).${already ? ` ${already} ${already === 1 ? "was" : "were"} already there.` : ""}`);
    return null;
  };
  const dupes = useMemo(() => duplicateGroups(contacts).filter((g) => !readNotDupes().has(g.id)), [contacts, modal]);
  const exportCsv = (list) => {
    const head = ["First name", "Last name", "Company", "Email", "Phone", "Address", "City", "State", "Zip", "Relationship", "Source", "Tags", "Birthday", "Home anniversary", "Last contacted", "Notes"];
    const rows = list.map((c) => [c.first_name, c.last_name, c.company, c.email, c.phone, c.address_line1, c.city, c.state, c.zip, relationshipLabel(c.relationship), c.source, (ctx.tagsByContact.get(c.id) || []).map((id) => ctx.tagById.get(id)?.name).filter(Boolean).join("; "), c.birthday || "", c.home_anniversary || "", c.last_contacted_at ? c.last_contacted_at.slice(0, 10) : "", c.about]);
    const url = URL.createObjectURL(new Blob([toCsv([head, ...rows])], { type: "text/csv" }));
    Object.assign(document.createElement("a"), { href: url, download: `contacts-${toKey(new Date())}.csv` }).click();
    URL.revokeObjectURL(url);
  };

  const openWith = (patch) => {
    setFilters({ ...EMPTY_FILTERS, ...patch });
    setActiveList("");
  };

  return (
    <div className="max-w-6xl">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Contacts</h1>
          <p className={`text-sm mt-1 ${muted}`}>
            {loading ? (
              "Loading…"
            ) : filtersOn || activeList ? (
              <>
                <b className="text-lg font-semibold text-[#1c1a17] dark:text-[#faf9f7]" data-testid="match-count">{filtered.length.toLocaleString()}</b>{" "}
                {filtered.length === 1 ? "person matches" : "people match"}
                {activeList ? ` “${lists.find((l) => l.id === activeList)?.name || "this list"}”` : " these filters"} · of {active.length.toLocaleString()} total ·{" "}
                <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setActiveList(""); setShown(PAGE); }} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  Clear filters
                </button>
              </>
            ) : (
              `${active.length.toLocaleString()} ${active.length === 1 ? "person" : "people"} in your database`
            )}
            {dueCount > 0 && !(filtersOn || activeList) && (
              <>
                {" · "}
                <button type="button" onClick={() => openWith({ touch: true })} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  {dueCount} due for a touch
                </button>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setModal("tags")} className={pill}>Tags</button>
          <button type="button" onClick={() => setModal("import")} className={pill}>Import</button>
          <button type="button" onClick={() => exportCsv(filtered)} className={pill}>Export</button>
          <button type="button" onClick={() => setModal("dupes")} className={pill} title="People who share an email, a phone number or a name">Find repeats{dupes.length ? ` (${dupes.length})` : ""}</button>
          <button type="button" onClick={() => setModal("add")} className={primary}>+ Add contact</button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Smart lists">
        <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setActiveList(""); setShown(PAGE); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${!filtersOn && !activeList ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`}>
          All contacts
        </button>
        {lists.map((l, i) =>
          arranging ? (
            <span
              key={l.id}
              draggable
              onDragStart={() => setDragId(l.id)}
              onDragOver={(e) => dragId && e.preventDefault()}
              onDrop={() => { dragId && moveList(dragId, i); setDragId(null); }}
              onDragEnd={() => setDragId(null)}
              className={`inline-flex items-center rounded-full bg-black/5 dark:bg-white/10 text-xs font-semibold cursor-grab ${dragId === l.id ? "opacity-40" : ""}`}
            >
              <button type="button" aria-label={`Move ${l.name} earlier`} disabled={i === 0} onClick={() => moveList(l.id, i - 1)} className="pl-2.5 pr-1 py-1.5 disabled:opacity-25">←</button>
              <span className="px-1 py-1.5 select-none">{l.name}</span>
              <button type="button" aria-label={`Move ${l.name} later`} disabled={i === lists.length - 1} onClick={() => moveList(l.id, i + 1)} className="pl-1 pr-2.5 py-1.5 disabled:opacity-25">→</button>
            </span>
          ) : (
            <span key={l.id} className={`inline-flex items-center rounded-full text-xs font-semibold ${activeList === l.id ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10"}`}>
              <button type="button" onClick={() => { setFilters({ ...EMPTY_FILTERS, ...l.filters }); setActiveList(l.id); setShown(PAGE); }} className="pl-3.5 pr-1.5 py-1.5">{l.name}</button>
              <button type="button" aria-label={`Rename the list ${l.name}`} title="Rename" onClick={() => { const name = prompt("Rename this smart list", l.name); if (name?.trim() && name.trim() !== l.name) crm.renameList(l.id, name); }} className="px-1 py-1.5 opacity-60 hover:opacity-100">✎</button>
              <button type="button" aria-label={`Delete the list ${l.name}`} onClick={() => confirm(`Delete the list “${l.name}”? The contacts aren't affected.`) && crm.deleteList(l.id)} className="pr-2.5 pl-1 py-1.5 opacity-60 hover:opacity-100">×</button>
            </span>
          ),
        )}
        {lists.length > 1 && (
          <button type="button" onClick={() => { setArranging((v) => !v); setDragId(null); }} aria-pressed={arranging} className="rounded-full px-3 py-1.5 text-xs font-semibold text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:underline">
            {arranging ? "Done" : "Rearrange"}
          </button>
        )}
        {filtersOn && !activeList && (
          <button
            type="button"
            onClick={() => {
              const name = prompt("Name this smart list (for example: Past clients, not called in 90 days)");
              if (name?.trim()) crm.saveList(name, filters);
            }}
            className="rounded-full border border-dashed border-black/25 dark:border-white/30 px-3.5 py-1.5 text-xs font-semibold"
          >
            + Save this view as a smart list
          </button>
        )}
      </div>

      <div className="mb-4 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-3 flex flex-wrap items-center gap-2">
        <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search contacts" aria-label="Search contacts" className={`${select} min-w-0 flex-1 md:flex-none md:w-72`} />
        <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className={`${pill} md:hidden`}>
          Filters{filtersOn ? " •" : ""}
        </button>
        <div className={`${showFilters ? "flex" : "hidden"} md:contents flex-wrap items-center gap-2 w-full`}>
        <select value={filters.relationship} onChange={(e) => set({ relationship: e.target.value })} aria-label="Relationship" className={select}>
          <option value="">Any relationship</option>
          {RELATIONSHIPS.map((r) => (
            <option key={r.value} value={r.value}>{r.label} ({(relCounts[r.value] || 0).toLocaleString()})</option>
          ))}
        </select>
        <select value={filters.tags[0] || ""} onChange={(e) => set({ tags: e.target.value ? [e.target.value] : [] })} aria-label="Tag" className={select}>
          <option value="">Any tag</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({(tagCounts.get(t.id) || 0).toLocaleString()})</option>
          ))}
        </select>
        <select value={filters.board} onChange={(e) => set({ board: e.target.value })} aria-label="On a board" className={select}>
          <option value="">Any board</option>
          <option value="lead">On Leads</option>
          <option value="pipeline">On Pipeline</option>
          <option value="transaction">On Deals</option>
          <option value="none">Not on a board</option>
        </select>
        <select value={filters.contacted} onChange={(e) => set({ contacted: e.target.value })} aria-label="Last contacted" className={select}>
          <option value="">Any last contact</option>
          <option value="never">Never contacted</option>
          {[30, 60, 90, 180, 365].map((d) => (
            <option key={d} value={d}>Not in touch for {d}+ days</option>
          ))}
        </select>
        <select value={filters.followup} onChange={(e) => set({ followup: e.target.value })} aria-label="Follow-up" className={select}>
          <option value="">Any follow-up</option>
          <option value="overdue">Follow-up overdue</option>
          <option value="week">Follow-up this week</option>
          <option value="none">No follow-up scheduled</option>
        </select>
        <select value={filters.dates} onChange={(e) => set({ dates: e.target.value })} aria-label="Birthday and anniversary" className={select}>
          <option value="">Any birthday / anniversary</option>
          <option value="no_birthday">No birthday saved</option>
          <option value="has_birthday">Has a birthday</option>
          <option value="no_anniversary">No home anniversary saved</option>
          <option value="has_anniversary">Has a home anniversary</option>
        </select>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filters.touch} onChange={(e) => set({ touch: e.target.checked })} className="accent-[#ed2127]" /> Due for a touch</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filters.archived} onChange={(e) => set({ archived: e.target.checked })} className="accent-[#ed2127]" /> Archived</label>
        <select value={sort} onChange={(e) => { setSort(e.target.value); setDesc(false); }} aria-label="Sort" className={`${select} sm:ml-auto`}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="sticky top-14 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#1c1a17] text-white px-4 py-3 shadow-lg" role="region" aria-label="Bulk actions">
          <span className="text-sm font-semibold mr-1">{picked.length} selected</span>
          <TagPicker tags={tags} onPick={bulkTag} onCreate={async (n) => { const t = await createTag(n); return t; }} label="Tag" onDark />
          <TagPicker tags={tags} onPick={bulkUntag} label="Untag" onDark />
          <select value="" onChange={(e) => e.target.value && crm.updateMany(picked.map((c) => c.id), { relationship: e.target.value }).then(() => flash(`Set ${picked.length} to ${relationshipLabel(e.target.value)}.`))} aria-label="Set relationship" className="rounded-full bg-white/10 text-white text-xs font-semibold px-3 py-1.5">
            <option value="">Set relationship…</option>
            {RELATIONSHIPS.map((r) => (
              <option key={r.value} value={r.value} className="text-black">{r.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => setModal("followup")} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Schedule follow-up</button>
          {!filters.archived && <button type="button" onClick={() => setModal("board")} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Add to Leads / Pipeline</button>}
          {!filters.archived && <button type="button" onClick={() => setModal("plan")} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Start a plan</button>}
          {picked.length === 2 && <button type="button" onClick={() => setModal("merge")} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Merge</button>}
          <button type="button" onClick={() => exportCsv(picked)} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">Export</button>
          <button type="button" onClick={() => crm.updateMany(picked.map((c) => c.id), { archived: !filters.archived }).then(() => { setSelected(new Set()); flash(filters.archived ? "Restored." : "Archived."); })} className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/20">{filters.archived ? "Restore" : "Archive"}</button>
          <button type="button" onClick={() => setSelected(new Set())} className="ml-auto text-xs font-semibold text-white/70 hover:text-white">Clear</button>
        </div>
      )}
      {note && <p className="mb-3 text-sm font-medium text-emerald-700 dark:text-emerald-400" role="status">{note}</p>}

      {loading ? (
        <div className="h-64 rounded-2xl bg-black/[0.04] dark:bg-white/[0.05] animate-pulse" />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-12 text-center">
          {contacts.length === 0 ? (
            <>
              <p className="font-display text-xl font-semibold">Build your database</p>
              <p className={`mt-1 text-sm ${muted}`}>Add people one at a time, or bring in a spreadsheet or Google Contacts export.</p>
              <div className="mt-4 flex justify-center gap-2">
                <button type="button" onClick={() => setModal("add")} className={primary}>+ Add contact</button>
                <button type="button" onClick={() => setModal("import")} className={pill}>Import a CSV</button>
              </div>
            </>
          ) : (
            <p className={muted}>No contacts match. <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setActiveList(""); }} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">Clear filters</button></p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] overflow-hidden">
          {customWidths && (
            <div className="hidden md:flex justify-end border-b border-black/5 dark:border-white/10 px-4 py-1.5">
              <button type="button" onClick={() => saveWidths({})} className={`text-xs font-semibold hover:underline ${muted}`}>
                Reset column widths
              </button>
            </div>
          )}
          <div className="overflow-x-auto">
          <div className="md:min-w-[var(--minw)]" style={{ "--cols": gridFor(widths), "--minw": `${minWidthFor(widths)}px` }}>
          <div className={`hidden md:grid md:[grid-template-columns:var(--cols)] items-center gap-3 border-b border-black/5 dark:border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45`}>
            <input type="checkbox" checked={allShownSelected} onChange={() => setSelected((s) => { const n = new Set(s); visible.forEach((c) => (allShownSelected ? n.delete(c.id) : n.add(c.id))); return n; })} aria-label="Select all shown" className="accent-[#ed2127]" />
            {COLUMNS.map(({ key, title }) => (
              <div key={key} className="relative min-w-0">
                {key === "tags" ? (
                  <span>{title}</span>
                ) : (
                  <button type="button" onClick={() => sortBy(key)} aria-label={`Sort by ${title}`} className={`flex items-center gap-1 text-left uppercase tracking-wider hover:text-[#1c1a17] dark:hover:text-[#faf9f7] ${sort === key ? "text-[#1c1a17] dark:text-[#faf9f7]" : ""}`}>
                    {title}
                    <span aria-hidden="true" className="text-[10px]">{sort === key ? (desc ? "↓" : "↑") : ""}</span>
                  </button>
                )}
                <span
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize the ${title} column`}
                  tabIndex={0}
                  title="Drag to resize. Double-click to reset."
                  onPointerDown={startResize(key)}
                  onKeyDown={nudge(key)}
                  onDoubleClick={() => resetWidth(key)}
                  className="absolute -right-2 top-[-6px] bottom-[-6px] w-3 cursor-col-resize touch-none select-none after:absolute after:left-1/2 after:top-1 after:bottom-1 after:w-px after:bg-black/10 dark:after:bg-white/15 hover:after:bg-[#ed2127] focus:outline-none focus-visible:after:bg-[#ed2127] focus-visible:after:w-0.5"
                />
              </div>
            ))}
          </div>
          <ul>
            {visible.map((c) => {
              const mine = (ctx.tagsByContact.get(c.id) || []).map((id) => ctx.tagById.get(id)).filter(Boolean);
              const boards = [...(ctx.boardsByContact.get(c.id) || [])];
              const next = ctx.nextTaskByContact.get(c.id);
              const today = toKey(new Date());
              return (
                <li key={c.id} className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] md:[grid-template-columns:var(--cols)] items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${fullName(c)}`} className="accent-[#ed2127]" />
                    <button type="button" onClick={() => setOpenId(c.id)} className="flex items-center gap-3 min-w-0 text-left">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.07] dark:bg-white/10 text-xs font-semibold">{initials(c)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate" title={fullName(c)}>{fullName(c)}</span>
                          {boards.map((g) => (
                            <span key={g} title={`On ${BOARDS[g].title}`} className="shrink-0 grid h-4 w-4 place-items-center rounded bg-[#1c1a17]/80 dark:bg-white/20 text-[9px] font-bold text-white">{BOARD_LETTER[g][0]}</span>
                          ))}
                        </span>
                        <span className={`block text-xs truncate md:hidden ${muted}`}>{[c.company && c.first_name ? c.company : "", c.email || c.phone, cityLine(c)].filter(Boolean).join(" · ") || "No details yet"}</span>
                        {c.company && c.first_name && <span className={`hidden md:block text-xs truncate ${muted}`}>{c.company}</span>}
                      </span>
                    </button>
                    <span className="hidden md:block min-w-0 truncate text-xs">
                      {c.phone ? <a href={`tel:${c.phone}`} className="hover:underline">{c.phone}</a> : <span className={muted}>–</span>}
                    </span>
                    <span className="hidden md:block min-w-0 truncate text-xs">
                      {c.email ? <a href={`mailto:${c.email}`} title={c.email} className="hover:underline">{c.email}</a> : <span className={muted}>–</span>}
                    </span>
                    <span className={`hidden md:block min-w-0 truncate text-xs ${addressLine(c) ? "" : muted}`} title={addressLine(c)}>{addressLine(c) || "–"}</span>
                    <div className="col-start-2 md:col-start-auto flex flex-wrap gap-1 min-w-0">
                      {mine.slice(0, 3).map((t) => (
                        <TagChip key={t.id} tag={t} size="sm" />
                      ))}
                      {mine.length > 3 && <span className={`text-[10px] font-semibold self-center ${muted}`}>+{mine.length - 3}</span>}
                    </div>
                    <select value={c.relationship} onChange={(e) => crm.updateContact(c.id, { relationship: e.target.value })} aria-label={`Relationship for ${fullName(c)}`} className="hidden md:block w-full min-w-0 rounded-md border border-transparent hover:border-black/15 dark:hover:border-white/20 bg-transparent py-0.5 pl-0 text-xs cursor-pointer text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
                      {RELATIONSHIPS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>
                    <span className={`hidden md:block text-xs ${touchDue(c) ? "font-semibold text-red-600 dark:text-red-400" : muted}`} title={touchDue(c) ? "Due for a touch" : ""}>{lastContactLabel(c)}</span>
                    <span className={`hidden md:block text-xs ${next && next < today ? "font-semibold text-red-600 dark:text-red-400" : muted}`}>{next === undefined ? "–" : next ? dayLabel(next, today) : "No date"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
          </div>
          </div>
          {filtered.length > shown && (
            <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full border-t border-black/5 dark:border-white/10 py-3 text-sm font-semibold text-[#ed2127] dark:text-[#f2454b] hover:bg-black/[0.02]">
              Show {Math.min(PAGE, filtered.length - shown)} more ({filtered.length - shown} left)
            </button>
          )}
        </div>
      )}
      <p className={`mt-3 text-xs ${muted}`}>{filtered.length.toLocaleString()} shown{filtersOn ? " with these filters" : ""}. L, P and T mark someone who is on your Leads, Pipeline or Deals board.</p>

      {open && (
        <ContactPanel
          key={open.id}
          contact={open}
          ctx={ctx}
          tags={tags}
          cards={cards}
          onClose={() => setOpenId(null)}
          onUpdate={crm.updateContact}
          onTagAdd={crm.tagMany}
          onTagRemove={crm.untagMany}
          onCreateTag={createTag}
          onDelete={crm.deleteContact}
          onChanged={crm.reload}
        />
      )}
      {modal === "add" && <AddContact onClose={(c) => { setModal(null); if (c) setOpenId(c.id); }} onAdd={crm.addContact} />}
      {modal === "import" && <ImportContacts existing={contacts} tags={tags} ensureTag={crm.ensureTag} onClose={() => setModal(null)} onDone={crm.reload} />}
      {modal === "tags" && <ManageTags tags={tags} links={crm.ctx.tagsByContact ? [...crm.ctx.tagsByContact].flatMap(([c, ts]) => ts.map((t) => ({ contact_id: c, tag_id: t }))) : []} onClose={() => setModal(null)} onUpdate={crm.updateTag} onDelete={crm.deleteTag} />}
      {modal === "plan" && <StartPlanModal contactIds={picked.map((c) => c.id)} onClose={() => setModal(null)} onDone={() => setSelected(new Set())} />}
      {modal === "board" && <AddToBoardModal picked={picked} cards={cards} stages={stages} onClose={() => setModal(null)} onAdd={addToBoard} />}
      {modal === "dupes" && <DuplicatesModal groups={duplicateGroups(contacts)} boardsByContact={ctx.boardsByContact} onClose={() => setModal(null)} onMerge={crm.merge} />}
      {modal === "followup" && <BulkFollowUp count={picked.length} onClose={() => setModal(null)} onSave={bulkFollowUp} />}
      {modal === "merge" && picked.length === 2 && <MergeModal pair={picked} onClose={() => { setModal(null); setSelected(new Set()); }} onMerge={crm.merge} />}
    </div>
  );
}
