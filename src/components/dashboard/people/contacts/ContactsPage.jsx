import { useMemo, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useContacts } from "../../../../hooks/useContacts";
import { addDays, dayLabel, toKey } from "../../../../lib/homeDates";
import { BOARDS } from "../../../../lib/peopleStages";
import { EMPTY_FILTERS, RELATIONSHIPS, SORTS, applyFilters, cityLine, fullName, hasFilters, initials, lastContactLabel, relationshipLabel, sortContacts, toCsv, touchDue } from "../../../../lib/contacts";
import { ManageTags, TagChip, TagPicker } from "./TagParts";
import ContactPanel from "./ContactPanel";
import ImportContacts from "./ImportContacts";

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
  const { contacts, tags, cards, ctx, lists, loading, error } = crm;
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState("name");
  const [activeList, setActiveList] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [modal, setModal] = useState(null); // add | import | tags | followup | merge
  const [shown, setShown] = useState(PAGE);
  const [note, setNote] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => sortContacts(applyFilters(contacts, filters, ctx), sort, ctx), [contacts, filters, sort, ctx]);
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
          <button type="button" onClick={() => setModal("add")} className={primary}>+ Add contact</button>
        </div>
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="mb-3 flex flex-wrap items-center gap-2" role="group" aria-label="Smart lists">
        <button type="button" onClick={() => { setFilters(EMPTY_FILTERS); setActiveList(""); setShown(PAGE); }} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${!filtersOn && !activeList ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10 hover:bg-black/10"}`}>
          All contacts
        </button>
        {lists.map((l) => (
          <span key={l.id} className={`inline-flex items-center rounded-full text-xs font-semibold ${activeList === l.id ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "bg-black/5 dark:bg-white/10"}`}>
            <button type="button" onClick={() => { setFilters({ ...EMPTY_FILTERS, ...l.filters }); setActiveList(l.id); setShown(PAGE); }} className="pl-3.5 pr-1.5 py-1.5">{l.name}</button>
            <button type="button" aria-label={`Delete the list ${l.name}`} onClick={() => confirm(`Delete the list “${l.name}”? The contacts aren't affected.`) && crm.deleteList(l.id)} className="pr-2.5 pl-1 py-1.5 opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
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
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filters.touch} onChange={(e) => set({ touch: e.target.checked })} className="accent-[#ed2127]" /> Due for a touch</label>
        <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={filters.archived} onChange={(e) => set({ archived: e.target.checked })} className="accent-[#ed2127]" /> Archived</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" className={`${select} sm:ml-auto`}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        </div>
      </div>

      {picked.length > 0 && (
        <div className="sticky top-2 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[#1c1a17] text-white px-4 py-3 shadow-lg" role="region" aria-label="Bulk actions">
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
          <div className="hidden md:grid grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.6fr)_7rem_7rem_7rem] items-center gap-3 border-b border-black/5 dark:border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#1c1a17]/45 dark:text-[#faf9f7]/45">
            <input type="checkbox" checked={allShownSelected} onChange={() => setSelected((s) => { const n = new Set(s); visible.forEach((c) => (allShownSelected ? n.delete(c.id) : n.add(c.id))); return n; })} aria-label="Select all shown" className="accent-[#ed2127]" />
            <span>Name</span><span>Tags</span><span>Relationship</span><span>Last in touch</span><span>Follow-up</span>
          </div>
          <ul>
            {visible.map((c) => {
              const mine = (ctx.tagsByContact.get(c.id) || []).map((id) => ctx.tagById.get(id)).filter(Boolean);
              const boards = [...(ctx.boardsByContact.get(c.id) || [])];
              const next = ctx.nextTaskByContact.get(c.id);
              const today = toKey(new Date());
              return (
                <li key={c.id} className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                  <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] md:grid-cols-[2.5rem_minmax(0,2.2fr)_minmax(0,1.6fr)_7rem_7rem_7rem] items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} aria-label={`Select ${fullName(c)}`} className="accent-[#ed2127]" />
                    <button type="button" onClick={() => setOpenId(c.id)} className="flex items-center gap-3 min-w-0 text-left">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-black/[0.07] dark:bg-white/10 text-xs font-semibold">{initials(c)}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span className="font-medium truncate">{fullName(c)}</span>
                          {boards.map((g) => (
                            <span key={g} title={`On ${BOARDS[g].title}`} className="shrink-0 grid h-4 w-4 place-items-center rounded bg-[#1c1a17]/80 dark:bg-white/20 text-[9px] font-bold text-white">{BOARD_LETTER[g][0]}</span>
                          ))}
                        </span>
                        <span className={`block text-xs truncate ${muted}`}>{[c.company && c.first_name ? c.company : "", c.email || c.phone, cityLine(c)].filter(Boolean).join(" · ") || "No details yet"}</span>
                      </span>
                    </button>
                    <div className="col-start-2 md:col-start-auto flex flex-wrap gap-1 min-w-0">
                      {mine.slice(0, 3).map((t) => (
                        <TagChip key={t.id} tag={t} size="sm" />
                      ))}
                      {mine.length > 3 && <span className={`text-[10px] font-semibold self-center ${muted}`}>+{mine.length - 3}</span>}
                    </div>
                    <span className={`hidden md:block text-xs ${muted}`}>{relationshipLabel(c.relationship)}</span>
                    <span className={`hidden md:block text-xs ${touchDue(c) ? "font-semibold text-red-600 dark:text-red-400" : muted}`} title={touchDue(c) ? "Due for a touch" : ""}>{lastContactLabel(c)}</span>
                    <span className={`hidden md:block text-xs ${next && next < today ? "font-semibold text-red-600 dark:text-red-400" : muted}`}>{next === undefined ? "–" : next ? dayLabel(next, today) : "No date"}</span>
                  </div>
                </li>
              );
            })}
          </ul>
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
      {modal === "followup" && <BulkFollowUp count={picked.length} onClose={() => setModal(null)} onSave={bulkFollowUp} />}
      {modal === "merge" && picked.length === 2 && <MergeModal pair={picked} onClose={() => { setModal(null); setSelected(new Set()); }} onMerge={crm.merge} />}
    </div>
  );
}
