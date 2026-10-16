import { Link } from "react-router-dom";
import ContactButtons from "../people/ContactButtons";
import { card, linkClass, muted } from "./styles";

const SOURCES = { listing: "Listing inquiry", agent_site: "Website contact", brokerage_valuation: "Home valuation" };

function ago(iso) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}

// New website inquiries, newest first, with a quick way to reach each person and a flag on the ones still waiting.
export default function LeadAlertsCard({ alerts, loading, peopleEnabled }) {
  return (
    <section className={`${card} flex flex-col`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-semibold">New inquiries</h2>
        <p className={`text-xs ${muted}`}>Last 30 days</p>
      </div>

      {loading ? (
        <p className={`text-sm mt-4 ${muted}`}>Loading…</p>
      ) : alerts.length === 0 ? (
        <p className={`text-sm mt-4 ${muted}`}>No new inquiries from your website or listings in the last 30 days.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {alerts.slice(0, 5).map((a) => {
            const waiting = a.person ? a.person.stage_group === "lead" && a.person.stage === "New" : true;
            const stale = waiting && Date.now() - new Date(a.created_at).getTime() > 24 * 3600 * 1000;
            return (
              <li key={a.id} className="rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className={`text-[11px] truncate ${muted}`}>
                      {SOURCES[a.target_type] || "Inquiry"} · <span className={stale ? "text-red-600 dark:text-red-400 font-semibold" : ""}>{ago(a.created_at)}</span>
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      waiting ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    }`}
                  >
                    {waiting ? "New" : a.person.stage}
                  </span>
                </div>
                {a.message && <p className="text-xs leading-snug text-[#1c1a17]/70 dark:text-[#faf9f7]/70 line-clamp-2">{a.message}</p>}
                <ContactButtons person={{ name: a.name, phone: a.phone, email: a.email }} size="sm" />
              </li>
            );
          })}
        </ul>
      )}

      {peopleEnabled && (
        <div className="mt-auto pt-3">
          <Link to="/dashboard/people/leads" className={linkClass}>
            Open Leads →
          </Link>
        </div>
      )}
    </section>
  );
}
