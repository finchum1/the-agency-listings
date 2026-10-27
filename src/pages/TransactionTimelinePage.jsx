import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import { buildTimeline, daysBetween, inDays, prettyDate } from "../lib/timeline";
import { AgentFooter, ClientHeader } from "../components/public/ClientPageParts";

const ICONS = {
  doc: <path d="M7 3h7l4 4v14H7zM14 3v4h4M10 12h5M10 16h5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  scale: <path d="M12 4v16M5 20h14M5 8h14M7 8l-3 6a3 3 0 0 0 6 0zM17 8l-3 6a3 3 0 0 0 6 0z" />,
  bank: <path d="M3 9l9-5 9 5M5 10v8M9 10v8M15 10v8M19 10v8M3 20h18" />,
  key: (
    <>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l8-8M16 6l3 3M14 8l2 2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
const Icon = ({ name, size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICONS[name]}
  </svg>
);

function Node({ m }) {
  const base = "relative h-12 w-12 shrink-0 rounded-full grid place-items-center";
  if (m.state === "done") return <div className={`${base} bg-[#ed2127] text-white`}><Icon name="check" /></div>;
  if (m.state === "later") return <div className={`${base} bg-white border-2 border-[#d9d3c5] text-[#9a9486]`}><Icon name={m.icon} /></div>;
  return (
    <div className={`${base} bg-[#1c1a17] text-white`}>
      <span className="absolute inset-0 rounded-full bg-[#ed2127]/50 animate-ping" aria-hidden="true" />
      <span className="relative"><Icon name={m.icon} /></span>
    </div>
  );
}

// /timeline/<token>: where a buyer's or seller's deal stands and what's still coming, branded with their agent. No sign-in; the
// token in the address is the credential, and the page tells search engines to stay away.
export default function TransactionTimelinePage() {
  useForceLight();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  const [go, setGo] = useState(false);

  useEffect(() => {
    document.title = "Your Closing Timeline";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    let live = true;
    fetch(`/api/transaction-timeline?token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? { data: await r.json() } : { gone: true }))
      .catch(() => ({ gone: true }))
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [token]);
  // The line fills in once the page is up, so it draws itself.
  useEffect(() => {
    if (!state.data) return undefined;
    const t = setTimeout(() => setGo(true), 150);
    return () => clearTimeout(t);
  }, [state.data]);

  if (state.loading) return <p className="min-h-screen grid place-items-center text-sm text-[#1c1a17]/50">Loading…</p>;
  if (state.gone) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-[#f7f4ee] text-[#1c1a17]">
        <div>
          <h1 className="font-display text-2xl font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask your agent for a new one.</p>
        </div>
      </div>
    );
  }

  const { deal, agent, org, message, today } = state.data;
  const brand = brandFromOrg(org);
  const { milestones, fill, closed, closing } = buildTimeline(deal, today);
  const upcoming = milestones.filter((m) => m.days >= 0);
  const first = milestones[0];
  const daysToClose = closing ? closing.days : null;
  const span = first && closing ? Math.max(1, daysBetween(first.date, closing.date)) : 1;
  const overall = first && closing ? Math.max(0, Math.min(1, daysBetween(first.date, today) / span)) : 0;
  const firstName = (agent?.full_name || "").split(" ")[0];
  const team = [
    deal.lender && ["Lender", deal.lender],
    deal.title_company && ["Title company", deal.title_company],
    deal.other_agent && [deal.side === "seller" ? "Buyer's agent" : "Seller's agent", deal.other_agent],
  ].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <ClientHeader brand={brand} />

      <section className="relative overflow-hidden bg-[#14130f] text-white">
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 120% at 85% 0%, rgba(237,33,39,0.45), transparent 60%)" }} />
        <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/60">Your closing timeline</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{deal.property_address || "Your home"}</h1>
          <p className="mt-2 text-white/70">Prepared for {deal.name}</p>

          <div className="mt-8 flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-12">
            {closed ? (
              <div>
                <p className="font-display text-5xl sm:text-6xl font-semibold leading-none">Congratulations!</p>
                <p className="mt-3 text-white/75">{deal.side === "seller" ? "Your home is sold." : "The home is yours."}{closing ? ` Closed ${prettyDate(closing.date, { month: "long", day: "numeric", year: "numeric" })}.` : ""}</p>
              </div>
            ) : daysToClose != null ? (
              <div>
                <p className="font-display text-7xl sm:text-8xl font-semibold leading-none tabular-nums">{daysToClose === 0 ? "Today" : daysToClose}</p>
                <p className="mt-2 text-lg text-white/80">{daysToClose === 0 ? "is closing day" : `day${daysToClose === 1 ? "" : "s"} until closing on ${prettyDate(closing.date, { weekday: "long", month: "long", day: "numeric" })}`}</p>
              </div>
            ) : (
              <p className="font-display text-3xl font-semibold">Your dates are coming together</p>
            )}
            {first && closing && !closed && (
              <div className="flex-1 min-w-0 sm:max-w-md">
                <div className="h-2.5 rounded-full bg-white/15 overflow-hidden">
                  <div className="h-full rounded-full bg-[#ed2127] transition-all duration-[1400ms] ease-out" style={{ width: go ? `${Math.max(4, overall * 100)}%` : "0%" }} />
                </div>
                <div className="mt-2 flex justify-between text-xs text-white/60">
                  <span>{prettyDate(first.date)}</span>
                  <span>{Math.round(overall * 100)}% of the way</span>
                  <span>{prettyDate(closing.date)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-10">
        {message && (
          <div className="rounded-2xl bg-white border border-black/[0.06] p-5 flex gap-4 items-start">
            {agent?.photo_url && <img src={agent.photo_url} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/50">A note from {firstName || "your agent"}</p>
              <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        )}

        {!closed && upcoming.length > 0 && (
          <section aria-label="What's still coming">
            <h2 className="font-display text-2xl font-semibold mb-3">What’s still coming</h2>
            <ul className="grid sm:grid-cols-3 gap-3">
              {upcoming.slice(0, 3).map((m, i) => (
                <li key={m.key} className={`rounded-2xl p-4 border ${i === 0 ? "bg-[#1c1a17] text-white border-[#1c1a17]" : "bg-white border-black/[0.06]"}`}>
                  <p className={`text-xs font-semibold uppercase tracking-wider ${i === 0 ? "text-[#ff8a8e]" : "text-[#d3181d]"}`}>{inDays(m.days)}</p>
                  <p className="mt-1 font-display text-xl font-semibold">{m.label}</p>
                  <p className={`text-sm ${i === 0 ? "text-white/70" : "text-[#1c1a17]/60"}`}>{prettyDate(m.date, { weekday: "long", month: "long", day: "numeric" })}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {milestones.length > 0 && (
          <section aria-label="The full timeline">
            <h2 className="font-display text-2xl font-semibold mb-5">The full timeline</h2>
            <ol>
              {milestones.map((m, i) => {
                const last = i === milestones.length - 1;
                return (
                  <li key={m.key} className="flex gap-5">
                    <div className="flex flex-col items-center">
                      <Node m={m} />
                      {!last && (
                        <div className="relative my-1 w-1 flex-1 min-h-10 rounded-full bg-[#ddd7c9] overflow-hidden">
                          <div className="absolute top-0 left-0 w-full rounded-full bg-[#ed2127] transition-all duration-[1400ms] ease-out" style={{ height: go ? `${fill[i] * 100}%` : "0%" }} />
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 min-w-0 pb-8 ${last ? "pb-0" : ""}`}>
                      <div className={`rounded-2xl border p-5 ${m.state === "next" || m.state === "today" ? "bg-white border-[#ed2127]/50 shadow-md shadow-[#ed2127]/10" : m.state === "done" ? "bg-white/70 border-black/[0.05]" : "bg-white border-black/[0.06]"}`}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-display text-xl font-semibold">{m.label}</h3>
                          {m.state === "done" && <span className="text-xs font-semibold text-[#2f7d4f] bg-[#2f7d4f]/10 rounded-full px-2.5 py-1">Done</span>}
                          {(m.state === "next" || m.state === "today") && <span className="text-xs font-semibold text-white bg-[#ed2127] rounded-full px-2.5 py-1">{m.state === "today" ? "Today" : "Up next"}</span>}
                        </div>
                        <p className="mt-0.5 text-sm font-medium text-[#1c1a17]/55">
                          {prettyDate(m.date, { weekday: "long", month: "long", day: "numeric" })}
                          {m.state !== "done" && m.state !== "today" ? ` · ${inDays(m.days).toLowerCase()}` : ""}
                        </p>
                        <p className={`mt-2 text-[15px] leading-relaxed ${m.state === "done" ? "text-[#1c1a17]/55" : "text-[#1c1a17]/80"}`}>{m.state === "done" ? m.doneText : m.text}</p>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        {team.length > 0 && (
          <section aria-label="Your team">
            <h2 className="font-display text-2xl font-semibold mb-3">Who’s helping</h2>
            <ul className="grid sm:grid-cols-3 gap-3">
              {team.map(([role, name]) => (
                <li key={role} className="rounded-2xl bg-white border border-black/[0.06] p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/50">{role}</p>
                  <p className="mt-1 font-semibold">{name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-xs text-[#1c1a17]/50">Dates can move if inspections, repairs or loan items take longer than planned. Your agent will tell you if anything changes.</p>
      </main>

      <AgentFooter agent={agent} brand={brand} note="Questions about any step? Reach out any time." />
    </div>
  );
}
