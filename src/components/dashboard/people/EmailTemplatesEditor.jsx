import { useMemo, useRef, useState } from "react";
import { MERGE_FIELDS, RECIPIENT_ROLES, STARTER_TEMPLATES, renderDealEmail } from "../../../lib/dealEmails";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50";
const ghost = "rounded-full border border-black/10 dark:border-white/15 text-sm font-medium px-4 py-2 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]";

const SIDES = [
  ["both", "Buyer and seller deals"],
  ["buyer", "Buyer deals only"],
  ["seller", "Seller deals only"],
];
const GROUPS = [...new Set(MERGE_FIELDS.map(([, , g]) => g))];

// A made-up deal, so the preview shows how a template reads once it's filled in.
const SAMPLE_DEAL = {
  name: "Jordan & Casey Smith", email: "jordan@example.com", client2_email: "casey@example.com", side: "buyer", property_address: "1234 NW 50th St, Oklahoma City, OK 73112",
  price: 285000, earnest_money: 3000, contract_date: "2026-11-02", inspection_date: "2026-11-09", inspection_time: "14:00", inspection_period_end: "2026-11-12",
  appraisal_date: "2026-11-16", financing_deadline: "2026-11-20", closing_date: "2026-11-30", closing_time: "10:30", title_company: "Heartland Title",
  title_company_email: "orders@heartland.example", title_processor_name: "Pat Lee", title_processor_email: "pat@heartland.example", lender: "First Plains Bank",
  lender_email: "loans@firstplains.example", loan_processor_name: "Alex Rivera", loan_processor_email: "alex@firstplains.example", other_agent: "Jane Doe",
  other_agent_email: "jane@example.com", other_agent_tc_name: "Sam Cole", other_agent_tc_email: "sam@example.com",
};
const SAMPLE_CTX = {
  me: { name: "You", email: "you@example.com", phone: "(405) 555-0100" },
  agent: { name: "You", email: "you@example.com", phone: "(405) 555-0100" },
  coordinators: [],
};

const blank = () => ({ id: null, key: "", name: "", subject: "", body: "", to_roles: ["client"], cc_roles: [], side: "both", starter: false });

function RoleChecks({ legend, value, onChange }) {
  const toggle = (key) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <fieldset className="min-w-0">
      <legend className={labelClass}>{legend}</legend>
      <div className="grid gap-x-3 gap-y-1 sm:grid-cols-2">
        {RECIPIENT_ROLES.map((r) => (
          <label key={r.key} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={value.includes(r.key)} onChange={() => toggle(r.key)} className="h-4 w-4 accent-[#ed2127]" />
            {r.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// Your deal email templates: the built-in starters (edit one to make your own copy) and any you add. `tpl` is useEmailTemplates().
export default function EmailTemplatesEditor({ tpl }) {
  const { templates, loading, error, save, remove } = tpl;
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const bodyRef = useRef(null);
  const subjectRef = useRef(null);
  const lastField = useRef("body");

  const preview = useMemo(() => (draft ? renderDealEmail(draft, SAMPLE_DEAL, SAMPLE_CTX) : null), [draft]);
  const set = (patch) => {
    setSaved("");
    setDraft((d) => ({ ...d, ...patch }));
  };

  const insertField = (key) => {
    if (!key) return;
    const field = lastField.current === "subject" ? "subject" : "body";
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const text = `{${key}}`;
    const start = el?.selectionStart ?? draft[field].length;
    const end = el?.selectionEnd ?? start;
    const next = draft[field].slice(0, start) + text + draft[field].slice(end);
    set({ [field]: next });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + text.length, start + text.length);
    });
  };

  const onSave = async () => {
    setBusy(true);
    const ok = await save(draft);
    setBusy(false);
    if (ok) {
      setSaved("Saved.");
      // After saving a starter the list shows your copy; keep editing it.
      if (draft.starter && !draft.id) setDraft(null);
    }
  };
  const onDelete = async () => {
    const what = draft.starter ? "Go back to the original wording of this template?" : `Delete “${draft.name}”?`;
    if (!confirm(what)) return;
    setBusy(true);
    await remove(draft.id);
    setBusy(false);
    setDraft(null);
  };

  const editing = draft !== null;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className={`text-sm ${muted}`}>Pick one to edit, or add your own. Editing a starter makes your own copy; the original stays available.</p>
          <button type="button" onClick={() => { setSaved(""); setDraft(blank()); }} className={ghost}>New template</button>
        </div>
        {loading ? (
          <p className={`text-sm ${muted}`}>Loading…</p>
        ) : (
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {templates.map((t) => {
              const active = draft && (draft.id ? draft.id === t.id : draft.key === t.key && !draft.id && draft.starter);
              return (
                <li key={t.id || t.key}>
                  <button
                    type="button"
                    onClick={() => { setSaved(""); setDraft({ ...t, to_roles: [...t.to_roles], cc_roles: [...t.cc_roles] }); }}
                    className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm hover:bg-black/[0.02] dark:hover:bg-white/[0.03] ${active ? "border-[#1c1a17] dark:border-[#faf9f7]" : "border-black/10 dark:border-white/15"}`}
                  >
                    <span className="min-w-0 truncate font-medium">{t.name}</span>
                    <span className={`shrink-0 text-xs ${muted}`}>{t.customized ? "Your copy" : t.starter ? "Starter" : "Yours"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {editing && (
        <div className="space-y-4 rounded-2xl border border-black/10 dark:border-white/15 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div>
              <label className={labelClass}>Name</label>
              <input value={draft.name} onChange={(e) => set({ name: e.target.value })} className={inputClass} placeholder="Intro to title" />
            </div>
            <div>
              <label className={labelClass}>Shows on</label>
              <select value={draft.side} onChange={(e) => set({ side: e.target.value })} className={inputClass}>
                {SIDES.map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RoleChecks legend="Send to" value={draft.to_roles} onChange={(v) => set({ to_roles: v })} />
            <RoleChecks legend="Copy" value={draft.cc_roles} onChange={(v) => set({ cc_roles: v })} />
          </div>
          <div>
            <label className={labelClass}>Subject</label>
            <input ref={subjectRef} value={draft.subject} onFocus={() => (lastField.current = "subject")} onChange={(e) => set({ subject: e.target.value })} className={inputClass} placeholder="New contract: {property_address}" />
          </div>
          <div>
            <div className="mb-1 flex items-end justify-between gap-3">
              <label className={labelClass + " !mb-0"}>Message</label>
              <select value="" onChange={(e) => insertField(e.target.value)} aria-label="Insert a field" className="rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-2 py-1 text-xs">
                <option value="">Insert a field…</option>
                {GROUPS.map((g) => (
                  <optgroup key={g} label={g}>
                    {MERGE_FIELDS.filter(([, , grp]) => grp === g).map(([k, label]) => (
                      <option key={k} value={k}>{label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <textarea ref={bodyRef} rows={12} value={draft.body} onFocus={() => (lastField.current = "body")} onChange={(e) => set({ body: e.target.value })} className={`${inputClass} font-mono leading-relaxed`} />
            <p className={`mt-1 text-xs ${muted}`}>
              Fields in curly braces fill in from the deal. A blank one shows as [its name] so it can't go out empty by accident. Start a line with “? ” to drop that line whenever a field on it is blank.
            </p>
          </div>

          <details className="rounded-xl bg-black/[0.03] dark:bg-white/[0.04] px-3.5 py-2.5">
            <summary className="cursor-pointer text-sm font-medium">Preview with a sample deal</summary>
            <div className="mt-3 space-y-2 text-sm">
              <p className={muted}>To: {preview.to.join(", ") || "nobody yet"}{preview.cc.length ? ` · Cc: ${preview.cc.join(", ")}` : ""}</p>
              <p className="font-semibold">{preview.subject}</p>
              <pre className="whitespace-pre-wrap font-sans leading-relaxed">{preview.body}</pre>
            </div>
          </details>

          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={onSave} disabled={busy} className={primary}>{draft.starter && !draft.id ? "Save as my copy" : "Save"}</button>
            {draft.id && (
              <button type="button" onClick={onDelete} disabled={busy} className={`${ghost} ${draft.starter ? "" : "text-red-600 dark:text-red-400"}`}>
                {draft.starter ? "Go back to the original" : "Delete"}
              </button>
            )}
            <button type="button" onClick={() => setDraft(null)} className={ghost}>Close</button>
            {saved && <span role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{saved}</span>}
          </div>
        </div>
      )}
      <p className={`text-xs ${muted}`}>{STARTER_TEMPLATES.length} starter templates are built in. Nothing here sends an email: the Email button on a deal opens the filled-in message in your own email app.</p>
    </div>
  );
}
