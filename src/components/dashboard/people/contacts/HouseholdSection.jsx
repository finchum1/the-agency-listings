import { useMemo, useState } from "react";
import { fullName, initials, relationshipLabel } from "../../../../lib/contacts";

const input = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const pill = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";

// Find someone in the agent's contacts to put in this household: type a name, email or phone, pick one.
function PersonPicker({ contacts, exclude, onPick, busy }) {
  const [text, setText] = useState("");
  const hits = useMemo(() => {
    const t = text.trim().toLowerCase();
    if (t.length < 2) return [];
    const digitsOnly = t.replace(/\D/g, "");
    return contacts.filter((c) => !c.archived && !exclude.has(c.id) && ((c.search_text || "").includes(t) || (digitsOnly.length >= 4 && (c.search_text || "").includes(digitsOnly)))).slice(0, 6);
  }, [text, contacts, exclude]);
  return (
    <div className="relative">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search your contacts by name, email or phone" className={input} aria-label="Find a person to link" disabled={busy} />
      {hits.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-lg">
          {hits.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { setText(""); onPick(c); }} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                <span className="truncate font-medium">{fullName(c)}</span>
                <span className={`shrink-0 truncate text-xs ${muted}`}>{c.email || c.phone || relationshipLabel(c.relationship)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// On a contact's Overview: the household they belong to (a couple or family linked as one relationship) and a way to link someone. Everyone keeps their own
// details; a household shares one history on the Activity tab and being in touch with one person counts for all of them.
export default function HouseholdSection({ contact, household, members, contacts, onLink, onLeave, onRename, onOpen }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(household?.name || "");
  const inHousehold = Boolean(contact.household_id && household);
  const exclude = useMemo(() => new Set([contact.id, ...members.map((m) => m.id)]), [contact.id, members]);
  const run = async (fn) => {
    setBusy(true);
    setError("");
    const r = await fn();
    setBusy(false);
    if (r?.error) setError(r.error);
    else setAdding(false);
  };

  return (
    <section className="space-y-2.5" aria-label="Household">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-base font-semibold">Household</h3>
        {inHousehold && <button type="button" disabled={busy} onClick={() => run(() => onLeave(contact.id))} className={`text-xs ${muted} hover:text-red-600 dark:hover:text-red-400`}>Take {contact.first_name || "them"} out</button>}
      </div>
      {inHousehold ? (
        <>
          <input
            key={household.id}
            defaultValue={household.name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== (household.name || "") && onRename(household.id, name)}
            placeholder="Name this household (optional)"
            maxLength={80}
            className={input}
            aria-label="Household name"
          />
          <ul className="space-y-1.5">
            {members.map((m) => (
              <li key={m.id}>
                {m.id === contact.id ? (
                  <div className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] dark:bg-white/[0.05] px-3 py-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-[11px] font-semibold text-white">{initials(m)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{fullName(m)} <span className={`text-xs font-normal ${muted}`}>(this contact)</span></span>
                  </div>
                ) : (
                  <button type="button" onClick={() => onOpen(m.id)} className="flex w-full items-center gap-2.5 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-black/[0.07] dark:bg-white/10 text-[11px] font-semibold">{initials(m)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{fullName(m)}</span>
                      <span className={`block truncate text-xs ${muted}`}>{[relationshipLabel(m.relationship), m.phone || m.email].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className={`text-xs ${muted}`}>Everyone's calls, texts, emails and notes show together on the Activity tab, and being in touch with one counts for all.</p>
        </>
      ) : (
        <p className={`text-sm ${muted}`}>Not part of a household. Link a spouse, partner or family member to keep their history together.</p>
      )}
      {adding || !inHousehold ? (
        <div className="space-y-1.5">
          <PersonPicker contacts={contacts} exclude={exclude} busy={busy} onPick={(c) => run(() => onLink(contact.id, c.id))} />
          {adding && <button type="button" onClick={() => setAdding(false)} className={`text-xs ${muted} hover:underline`}>Cancel</button>}
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className={pill}>+ Add someone</button>
      )}
      {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
    </section>
  );
}
