import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import { daysBetween, inDays, prettyDate } from "../lib/timeline";
import { AgentFooter, ClientHeader } from "../components/public/ClientPageParts";

const DATES = [
  ["contract_date", "Contract"],
  ["inspection_date", "Inspection"],
  ["appraisal_date", "Appraisal"],
  ["financing_deadline", "Financing deadline"],
  ["closing_date", "Closing"],
];
const COMPLIANCE = { submitted: "In compliance review", approved: "Compliance approved", needs_changes: "Sent back by compliance" };

const card = "rounded-2xl bg-white border border-black/[0.06]";
const eyebrow = "text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/50";

function Bar({ done, total, dark }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div className={`mt-3 h-2 rounded-full overflow-hidden ${dark ? "bg-white/15" : "bg-black/10"}`} role="img" aria-label={`${pct}% done`}>
      <div className="h-full rounded-full bg-[#ed2127] transition-all duration-[1200ms] ease-out" style={{ width: `${pct}%` }} />
    </div>
  );
}

function Stat({ label, big, sub, done, total }) {
  return (
    <div className="rounded-2xl bg-white/[0.07] border border-white/10 p-4">
      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/55">{label}</p>
      <p className="mt-1 font-display text-4xl font-semibold leading-none tabular-nums">{big}</p>
      {sub && <p className="mt-1.5 text-sm text-white/65">{sub}</p>}
      {total > 0 && <Bar done={done} total={total} dark />}
    </div>
  );
}

function Pill({ tone = "grey", children }) {
  const tones = { red: "text-[#b3261e] bg-[#b3261e]/10", green: "text-[#2f7d4f] bg-[#2f7d4f]/10", grey: "text-[#1c1a17]/60 bg-black/[0.06]", amber: "text-[#8a5a00] bg-[#e8a317]/15" };
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

// /update/<token>: where a deal stands, written by the coordinator for the agent who owns it. Same look as the client's timeline, with
// the working detail an agent wants: tasks, documents, signatures. No sign-in; the token in the address is the credential.
export default function AgentUpdatePage() {
  useForceLight();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });
  const [showDone, setShowDone] = useState(false);

  useEffect(() => {
    document.title = "Deal Update";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);
  useEffect(() => {
    let live = true;
    fetch(`/api/deal-update-link?token=${encodeURIComponent(token)}`)
      .then(async (r) => (r.ok ? { data: await r.json() } : { gone: true }))
      .catch(() => ({ gone: true }))
      .then((s) => live && setState(s));
    return () => {
      live = false;
    };
  }, [token]);

  if (state.loading) return <p className="min-h-screen grid place-items-center text-sm text-[#1c1a17]/50">Loading…</p>;
  if (state.gone) {
    return (
      <div className="min-h-screen grid place-items-center px-6 text-center bg-[#f7f4ee] text-[#1c1a17]">
        <div>
          <h1 className="font-display text-2xl font-semibold">This link has expired</h1>
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask your coordinator for a new one.</p>
        </div>
      </div>
    );
  }

  const { deal, sender, agent, org, message, today, counts, openTasks, doneTasks, docs, signatures } = state.data;
  const brand = brandFromOrg(org);
  const agentFirst = (agent?.full_name || "").split(" ")[0];
  const senderFirst = (sender?.full_name || "").split(" ")[0];
  const dated = DATES.filter(([k]) => deal[k]).map(([k, label]) => ({ key: k, label, date: deal[k], days: daysBetween(today, deal[k]) })).sort((a, b) => a.date.localeCompare(b.date));
  const nextKey = dated.find((d) => d.days >= 0)?.key;
  const closing = dated.find((d) => d.key === "closing_date");
  const overdue = openTasks.filter((t) => t.due && t.due < today);
  const missing = docs.filter((d) => !d.done);
  const collected = docs.filter((d) => d.done);
  const flagged = docs.filter((d) => d.review_status === "issue");
  const out = signatures.filter((g) => g.status === "pending" || g.status === "sending");
  const attention = overdue.length + flagged.length + out.length + (deal.compliance_status === "needs_changes" ? 1 : 0);
  const team = [deal.lender && ["Lender", deal.lender], deal.title_company && ["Title company", deal.title_company], deal.other_agent && [deal.side === "seller" ? "Buyer's agent" : "Seller's agent", deal.other_agent]].filter(Boolean);

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <ClientHeader brand={brand} />

      <section className="relative overflow-hidden bg-[#14130f] text-white">
        <div className="absolute inset-0 opacity-60" style={{ background: "radial-gradient(60% 120% at 85% 0%, rgba(237,33,39,0.45), transparent 60%)" }} />
        <div className="relative mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/60">Deal update{agentFirst ? ` for ${agentFirst}` : ""}</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{deal.property_address || deal.name}</h1>
          <p className="mt-2 text-white/70">
            {[deal.property_address ? deal.name : "", deal.side === "seller" ? "Seller" : deal.side === "buyer" ? "Buyer" : "", deal.stage].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat label="Closing" big={closing ? (closing.days < 0 ? "Closed" : closing.days === 0 ? "Today" : closing.days) : "–"} sub={closing ? (closing.days > 0 ? `day${closing.days === 1 ? "" : "s"} · ${prettyDate(closing.date, { weekday: "short", month: "short", day: "numeric" })}` : prettyDate(closing.date, { month: "long", day: "numeric", year: "numeric" })) : "No closing date yet"} />
            <Stat label="Tasks" big={counts.tasksTotal ? `${counts.tasksDone}/${counts.tasksTotal}` : "–"} sub={overdue.length ? `${overdue.length} overdue` : counts.tasksTotal ? "None overdue" : "No checklist yet"} done={counts.tasksDone} total={counts.tasksTotal} />
            <Stat label="Documents" big={counts.docsTotal ? `${counts.docsDone}/${counts.docsTotal}` : "–"} sub={missing.length ? `${missing.length} still needed` : counts.docsTotal ? "All collected" : "No document list yet"} done={counts.docsDone} total={counts.docsTotal} />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-10">
        {message && (
          <div className={`${card} p-5 flex gap-4 items-start`}>
            {sender?.photo_url && <img src={sender.photo_url} alt="" className="h-14 w-14 rounded-full object-cover shrink-0" />}
            <div>
              <p className={eyebrow}>A note from {senderFirst || "your coordinator"}</p>
              <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{message}</p>
            </div>
          </div>
        )}

        <section aria-label="Needs you">
          <h2 className="font-display text-2xl font-semibold mb-3">Needs you</h2>
          {attention === 0 ? (
            <p className="rounded-2xl bg-[#2f7d4f]/10 text-[#2f7d4f] px-5 py-4 font-medium">Nothing needs you right now. {COMPLIANCE[deal.compliance_status] ? `${COMPLIANCE[deal.compliance_status]}.` : ""}</p>
          ) : (
            <ul className="space-y-2">
              {deal.compliance_status === "needs_changes" && (
                <li className={`${card} border-[#b3261e]/30 p-4 flex items-center justify-between gap-3`}>
                  <span className="font-medium">Compliance sent this deal back</span>
                  <Pill tone="red">Needs changes</Pill>
                </li>
              )}
              {overdue.map((t) => (
                <li key={t.id} className={`${card} border-[#b3261e]/30 p-4 flex items-center justify-between gap-3`}>
                  <span className="min-w-0 font-medium">{t.text}</span>
                  <Pill tone="red">Was due {prettyDate(t.due, { month: "short", day: "numeric" })}</Pill>
                </li>
              ))}
              {flagged.map((d, i) => (
                <li key={`f${i}`} className={`${card} border-[#b3261e]/30 p-4`}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="min-w-0 font-medium">{d.text}</span>
                    <Pill tone="red">Flagged</Pill>
                  </div>
                  {d.review_note && <p className="mt-1 text-sm text-[#1c1a17]/65">{d.review_note}</p>}
                </li>
              ))}
              {out.map((g, i) => (
                <li key={`s${i}`} className={`${card} p-4 flex items-center justify-between gap-3`}>
                  <span className="min-w-0 font-medium">{g.title}</span>
                  <Pill tone="amber">{g.waiting_on.length ? `Waiting on ${g.waiting_on.slice(0, 2).join(", ")}${g.waiting_on.length > 2 ? "…" : ""}` : "Out for signature"}</Pill>
                </li>
              ))}
            </ul>
          )}
        </section>

        {dated.length > 0 && (
          <section aria-label="Key dates">
            <h2 className="font-display text-2xl font-semibold mb-3">Key dates</h2>
            <ul className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {dated.map((d) => {
                const done = d.days < 0;
                const next = d.key === nextKey;
                return (
                  <li key={d.key} className={`rounded-2xl p-4 border ${next ? "bg-[#1c1a17] text-white border-[#1c1a17]" : done ? "bg-white/70 border-black/[0.05]" : "bg-white border-black/[0.06]"}`}>
                    <p className={`text-[11px] font-semibold uppercase tracking-wider ${next ? "text-[#ff8a8e]" : done ? "text-[#2f7d4f]" : "text-[#d3181d]"}`}>{done ? "Done" : inDays(d.days)}</p>
                    <p className="mt-1 font-display text-lg font-semibold leading-tight">{d.label}</p>
                    <p className={`text-sm ${next ? "text-white/70" : "text-[#1c1a17]/60"}`}>{prettyDate(d.date, { month: "short", day: "numeric" })}</p>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-label="Tasks">
          <h2 className="font-display text-2xl font-semibold mb-3">Tasks</h2>
          {openTasks.length === 0 ? (
            <p className={`${card} px-5 py-4 text-[#1c1a17]/60`}>{counts.tasksTotal ? "Every task is done." : "No tasks on this deal yet."}</p>
          ) : (
            <ul className="space-y-2">
              {openTasks.map((t) => {
                const late = t.due && t.due < today;
                return (
                  <li key={t.id} className={`${card} px-4 py-3 flex items-center justify-between gap-3`}>
                    <span className="min-w-0 text-[15px]">{t.text}</span>
                    {t.due ? <Pill tone={late ? "red" : "grey"}>{late ? `Overdue · ${prettyDate(t.due, { month: "short", day: "numeric" })}` : `${prettyDate(t.due, { month: "short", day: "numeric" })} · ${inDays(daysBetween(today, t.due)).toLowerCase()}`}</Pill> : <Pill>No date</Pill>}
                  </li>
                );
              })}
            </ul>
          )}
          {doneTasks.length > 0 && (
            <div className="mt-3">
              <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} className="text-sm font-semibold text-[#d3181d] hover:underline">
                {showDone ? "Hide" : "Show"} recently completed ({doneTasks.length})
              </button>
              {showDone && (
                <ul className="mt-2 space-y-1.5">
                  {doneTasks.map((t) => (
                    <li key={t.id} className="flex items-center gap-2.5 px-1 text-[15px] text-[#1c1a17]/55">
                      <span className="text-[#2f7d4f]" aria-hidden="true">✓</span>
                      <span className="line-through">{t.text}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        {docs.length > 0 && (
          <section aria-label="Documents">
            <h2 className="font-display text-2xl font-semibold mb-3">Documents</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className={`${card} p-5`}>
                <p className={eyebrow}>Still needed · {missing.length}</p>
                {missing.length === 0 ? (
                  <p className="mt-2 text-[#2f7d4f] font-medium">All collected.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {missing.map((d, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-[15px]">
                        <span>{d.text}</span>
                        {d.review_status === "issue" && <Pill tone="red">Flagged</Pill>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className={`${card} p-5`}>
                <p className={eyebrow}>Collected · {collected.length}</p>
                {collected.length === 0 ? (
                  <p className="mt-2 text-[#1c1a17]/55">Nothing collected yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1.5">
                    {collected.map((d, i) => (
                      <li key={i} className="flex items-start justify-between gap-3 text-[15px] text-[#1c1a17]/70">
                        <span><span className="text-[#2f7d4f]" aria-hidden="true">✓ </span>{d.text}</span>
                        {d.review_status === "issue" ? <Pill tone="red">Flagged</Pill> : d.review_status === "ok" ? <Pill tone="green">Reviewed</Pill> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        )}

        {signatures.length > 0 && (
          <section aria-label="Signatures">
            <h2 className="font-display text-2xl font-semibold mb-3">Signatures</h2>
            <ul className="space-y-2">
              {signatures.map((g, i) => (
                <li key={i} className={`${card} px-4 py-3 flex items-center justify-between gap-3`}>
                  <span className="min-w-0 text-[15px]">{g.title}</span>
                  {g.status === "completed" ? <Pill tone="green">Signed by everyone</Pill> : g.status === "pending" || g.status === "sending" ? <Pill tone="amber">Out for signature</Pill> : <Pill>{g.status}</Pill>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {team.length > 0 && (
          <section aria-label="Who's involved">
            <h2 className="font-display text-2xl font-semibold mb-3">Who’s involved</h2>
            <ul className="grid sm:grid-cols-3 gap-3">
              {team.map(([role, name]) => (
                <li key={role} className={`${card} p-4`}>
                  <p className={eyebrow}>{role}</p>
                  <p className="mt-1 font-semibold">{name}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {COMPLIANCE[deal.compliance_status] && <p className="text-xs text-[#1c1a17]/50">{COMPLIANCE[deal.compliance_status]}. This page shows the deal as of today and refreshes each time you open it.</p>}
      </main>

      <AgentFooter agent={sender} brand={brand} note="Your transaction coordinator" />
    </div>
  );
}
