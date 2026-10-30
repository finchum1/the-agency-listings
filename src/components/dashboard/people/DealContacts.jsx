import { useState } from "react";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

// Everyone on a deal who has a name and an email: the clients first, then the other side and the closing team. Each is a card (role, name, how to reach
// them) instead of a pair of loose fields. `name` and `email` are the column names on the deal's people row.
export const CONTACT_ROLES = [
  { key: "client", label: "Client", name: "name", email: "email", phone: "phone", nameLabel: "Name" },
  { key: "client2", label: "Second client", name: "client2_name", email: "client2_email", nameLabel: "Name" },
  { key: "agent", label: "Other agent", name: "other_agent", email: "other_agent_email", nameLabel: "Name" },
  { key: "agent_tc", label: "Other agent's TC", name: "other_agent_tc_name", email: "other_agent_tc_email", nameLabel: "Name" },
  { key: "title", label: "Title company", name: "title_company", email: "title_company_email", nameLabel: "Company" },
  { key: "processor", label: "Title processor", name: "title_processor_name", email: "title_processor_email", nameLabel: "Name" },
  { key: "lender", label: "Lender", name: "lender", email: "lender_email", nameLabel: "Name or company", cashHides: true },
  { key: "loan_processor", label: "Loan processor", name: "loan_processor_name", email: "loan_processor_email", nameLabel: "Name", cashHides: true },
];

const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      window.prompt("Copy this email address:", text);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button type="button" onClick={copy} className={`shrink-0 text-xs underline underline-offset-2 hover:opacity-80 ${muted}`}>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

/**
 * The deal's contacts as cards.
 *   values     the deal's fields (name, email, phone, client2_name, ... lender_email)
 *   editing    true shows inputs inside each card (every role, so an empty one can be filled in); false shows only the cards that have something
 *   onChange(column, value)   a field changed          onCommit(column)   the field was left (save it)
 *   cash       a cash purchase has no lender
 */
export default function DealContacts({ values, editing, onChange, onCommit, cash = false }) {
  const roles = CONTACT_ROLES.filter((r) => !(cash && r.cashHides));
  const filled = (r) => Boolean(values[r.name] || values[r.email] || (r.phone && values[r.phone]));
  const shown = editing ? roles : roles.filter(filled);
  const hidden = roles.length - shown.length;

  return (
    <section aria-label="People on this deal" className="min-w-0 space-y-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-[#1c1a17]/50 dark:text-[#faf9f7]/50">People on this deal</h4>
      <div className="grid gap-3 @md:grid-cols-2">
        {shown.map((r) => {
          const name = values[r.name] || "";
          const email = values[r.email] || "";
          const phone = r.phone ? values[r.phone] || "" : "";
          return (
            <div key={r.key} className="min-w-0 rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-3.5">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1c1a17]/[0.07] dark:bg-[#faf9f7]/10 text-xs font-semibold text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
                >
                  {initials(name) || "·"}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[11px] font-medium uppercase tracking-wide ${muted}`}>{r.label}</p>
                  {!editing && <p className="truncate text-sm font-semibold">{name || "No name yet"}</p>}
                </div>
              </div>
              {editing ? (
                <div className="mt-3 space-y-2.5">
                  <div>
                    <label className={labelClass}>{r.nameLabel}</label>
                    <input value={name} onChange={(e) => onChange(r.name, e.target.value)} onBlur={() => onCommit(r.name)} autoComplete="off" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Email</label>
                    <input type="email" value={email} onChange={(e) => onChange(r.email, e.target.value)} onBlur={() => onCommit(r.email)} autoComplete="off" className={inputClass} />
                  </div>
                  {r.phone && (
                    <div>
                      <label className={labelClass}>Phone</label>
                      <input type="tel" value={phone} onChange={(e) => onChange(r.phone, e.target.value)} onBlur={() => onCommit(r.phone)} autoComplete="off" className={inputClass} />
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-2.5 space-y-1 text-sm">
                  {email ? (
                    <div className="flex items-center justify-between gap-3">
                      <a href={`mailto:${email}`} className="min-w-0 truncate underline decoration-black/25 dark:decoration-white/30 underline-offset-2 hover:decoration-current">
                        {email}
                      </a>
                      <CopyButton text={email} />
                    </div>
                  ) : (
                    <p className={muted}>No email yet</p>
                  )}
                  {phone && (
                    <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block truncate underline decoration-black/25 dark:decoration-white/30 underline-offset-2 hover:decoration-current">
                      {phone}
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!editing && hidden > 0 && <p className={`text-xs ${muted}`}>{hidden} more {hidden === 1 ? "role isn't" : "roles aren't"} filled in. Press Edit to add them.</p>}
      {!editing && shown.length === 0 && <p className={`text-sm ${muted}`}>No contacts added yet. Press Edit to add them.</p>}
      {cash && <p className={`text-xs ${muted}`}>Cash purchase: no lender.</p>}
    </section>
  );
}
