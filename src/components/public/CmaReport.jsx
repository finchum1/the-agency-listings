import { adjustedPrice, adjustmentTotal, computeCma, factsLine, pricePerSqft, subjectAddress, toNumber } from "../../lib/cma";
import { formatPrice } from "../../lib/format";
import { AgentFooter, ClientHeader } from "./ClientPageParts";

const STATUS_STYLE = { sold: "bg-[#1c1a17] text-white", pending: "bg-amber-100 text-amber-900", active: "bg-emerald-100 text-emerald-900" };
const STATUS_LABEL = { sold: "Sold", pending: "Pending", active: "Active" };
const when = (s) => (s ? new Date(`${String(s).slice(0, 10)}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");
const signed = (n) => `${n < 0 ? "−" : "+"}${formatPrice(Math.abs(n))}`;

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-white border border-black/[0.06] px-5 py-4 print:border-black/20">
      <p className="text-[11px] font-semibold tracking-[0.18em] uppercase text-[#1c1a17]/50">{label}</p>
      <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-[#1c1a17]/50">{hint}</p>}
    </div>
  );
}

function CompCard({ comp }) {
  const adj = adjustmentTotal(comp);
  const price = toNumber(comp.price);
  const ppsf = pricePerSqft(comp);
  const facts = [factsLine(comp), toNumber(comp.lot) != null ? `${comp.lot} lot` : "", comp.distance !== "" && comp.distance != null ? `${comp.distance} mi away` : ""].filter(Boolean).join(" · ");
  return (
    <li className="break-inside-avoid rounded-2xl bg-white border border-black/[0.06] overflow-hidden print:border-black/20">
      {comp.photo_url && <img src={comp.photo_url} alt="" loading="lazy" className="h-40 w-full object-cover print:h-32" />}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="font-display text-lg font-semibold leading-snug">{comp.address || "Address not entered"}</p>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[comp.status] || STATUS_STYLE.sold}`}>{STATUS_LABEL[comp.status] || "Sold"}</span>
        </div>
        <p className="mt-0.5 text-sm text-[#1c1a17]/60">{[comp.date && when(comp.date), toNumber(comp.dom) != null && `${comp.dom} days on market`].filter(Boolean).join(" · ")}</p>
        <p className="mt-2 font-display text-2xl font-semibold">{formatPrice(price)}</p>
        {facts && <p className="mt-1 text-sm text-[#1c1a17]/70">{facts}</p>}
        {ppsf != null && <p className="text-xs text-[#1c1a17]/50">${Math.round(ppsf).toLocaleString("en-US")} per sqft</p>}
        {(comp.adjustments || []).filter((a) => toNumber(a.amount)).length > 0 && (
          <div className="mt-3 border-t border-black/10 pt-3 text-sm">
            {comp.adjustments
              .filter((a) => toNumber(a.amount))
              .map((a, i) => (
                <p key={i} className="flex justify-between gap-3 text-[#1c1a17]/70">
                  <span>{a.label || "Adjustment"}</span>
                  <span>{signed(toNumber(a.amount))}</span>
                </p>
              ))}
            <p className="mt-1 flex justify-between gap-3 font-semibold">
              <span>Adjusted to match your home</span>
              <span>{formatPrice(price + adj)}</span>
            </p>
          </div>
        )}
        {comp.notes && <p className="mt-3 text-sm text-[#1c1a17]/70">{comp.notes}</p>}
      </div>
    </li>
  );
}

// The client-facing CMA: the agent's price opinion, the homes it rests on, and the agent's notes. Used by the share link page and, with the
// agent's own current numbers, the editor's preview. Light page; "Print / Save as PDF" prints it without the buttons.
export default function CmaReport({ cma, agent, brand, preview = false }) {
  const m = computeCma(cma);
  const comps = (cma.comps || []).filter((c) => c.include !== false && toNumber(c.price) != null);
  const sold = comps.filter((c) => c.status === "sold");
  const pending = comps.filter((c) => c.status === "pending");
  const active = comps.filter((c) => c.status === "active");
  const adjusted = [...sold, ...pending].map((c) => ({ c, v: adjustedPrice(c) }));
  // The bars start a little below the lowest price, so differences between the homes show instead of every bar looking full.
  const top = Math.max(1, ...adjusted.map((a) => a.v), m.high || 0);
  const floor = Math.floor(Math.min(top, ...adjusted.map((a) => a.v), m.low ?? top) * 0.9);
  const pct = (v) => Math.max(0, Math.min(100, ((v - floor) / Math.max(1, top - floor)) * 100));
  const address = subjectAddress(cma.subject);
  const basisWord = m.basisKind === "pending" ? "pending" : "sold";

  return (
    <div className="agency-brand bg-[#F5F1E9] text-[#1C1C1B] print:bg-white">
      {!preview && <ClientHeader brand={brand} />}
      <section className="bg-[#1c1a17] text-white print:bg-white print:text-[#1c1a17] print:border-b print:border-black/20">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/60 print:text-[#1c1a17]/60">Comparative market analysis</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{address || cma.title || "Your home"}</h1>
          {factsLine(cma.subject) && <p className="mt-3 text-base text-white/75 print:text-[#1c1a17]/70">{factsLine(cma.subject)}</p>}
          <p className="mt-1 text-sm text-white/50 print:text-[#1c1a17]/50">Prepared {when(cma.prepared || new Date().toISOString())}{agent?.full_name ? ` by ${agent.full_name}` : ""}</p>
          {!preview && (
            <button type="button" onClick={() => window.print()} className="mt-6 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#1c1a17] print:hidden">
              Print / Save as PDF
            </button>
          )}
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-10">
        <section aria-label="Price opinion">
          {m.suggested != null ? (
            <div className="rounded-3xl bg-white border border-black/[0.06] p-6 sm:p-8 print:border-black/20">
              <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-[#D8091B]">Suggested price</p>
              <p className="mt-1 font-display text-5xl sm:text-6xl font-semibold">{formatPrice(m.suggested)}</p>
              {m.low != null && m.high != null && (
                <p className="mt-2 text-lg text-[#1c1a17]/70">
                  Likely range {formatPrice(m.low)} to {formatPrice(m.high)}
                </p>
              )}
              <p className="mt-3 max-w-2xl text-sm text-[#1c1a17]/60">
                Based on {m.basisCount} comparable {basisWord} home{m.basisCount === 1 ? "" : "s"}, each adjusted for how it differs from your home. This is a market opinion from your agent, not an appraisal.
              </p>
            </div>
          ) : (
            <p className="rounded-2xl bg-white p-6 text-sm text-[#1c1a17]/60">Add sold homes to see a suggested price.</p>
          )}
        </section>

        {(m.averagePpsf != null || m.averageDom != null || m.saleToList != null || m.activeCount > 0) && (
          <section aria-label="Market snapshot" className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {m.averagePpsf != null && <Stat label="Average price per sqft" value={`$${Math.round(m.averagePpsf).toLocaleString("en-US")}`} hint={m.byPricePerSqft ? `About ${formatPrice(m.byPricePerSqft)} for your home` : undefined} />}
            {m.averageDom != null && <Stat label="Average days on market" value={Math.round(m.averageDom)} />}
            {m.saleToList != null && <Stat label="Sold vs. list price" value={`${(m.saleToList * 100).toFixed(1)}%`} hint="Average of the sold homes" />}
            {m.activeCount > 0 && <Stat label="Homes for sale now" value={m.activeCount} hint={m.activeLow != null ? `${formatPrice(m.activeLow)} to ${formatPrice(m.activeHigh)}` : undefined} />}
          </section>
        )}

        {adjusted.length > 0 && m.suggested != null && (
          <section aria-label="Comparison" className="break-inside-avoid">
            <h2 className="font-display text-2xl font-semibold mb-3 border-b border-black/10 pb-2">How the homes compare</h2>
            <div className="space-y-2">
              {adjusted.map(({ c, v }) => (
                <div key={c.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] sm:grid-cols-[14rem_1fr_auto] items-center gap-3 text-sm">
                  <span className="truncate">{c.address || "Address not entered"}</span>
                  <span className="relative h-5 rounded-full bg-black/[0.06]">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[#1c1a17]" style={{ width: `${Math.max(4, pct(v))}%` }} />
                    <span className="absolute inset-y-[-3px] w-0.5 bg-[#D8091B]" style={{ left: `${pct(m.suggested)}%` }} title="Suggested price" />
                  </span>
                  <span className="tabular-nums">{formatPrice(v)}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#1c1a17]/50">Each price is adjusted to match your home (bars start below the lowest price to make the differences clear). The red line is the suggested price.</p>
          </section>
        )}

        {[
          ["Recently sold", sold],
          ["Under contract", pending],
          ["For sale now", active],
        ].map(
          ([label, list]) =>
            list.length > 0 && (
              <section key={label} aria-label={label}>
                <h2 className="font-display text-2xl font-semibold mb-3 border-b border-black/10 pb-2">
                  {label} <span className="text-sm font-normal text-[#1c1a17]/50">{list.length}</span>
                </h2>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 print:grid-cols-2">
                  {list.map((c) => (
                    <CompCard key={c.id} comp={c} />
                  ))}
                </ul>
              </section>
            ),
        )}

        {cma.notes && (
          <section aria-label="Notes from your agent" className="break-inside-avoid">
            <h2 className="font-display text-2xl font-semibold mb-3 border-b border-black/10 pb-2">Notes from {agent?.full_name?.split(" ")[0] || "your agent"}</h2>
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-[#1c1a17]/80">{cma.notes}</p>
          </section>
        )}

        <p className="text-xs leading-relaxed text-[#1c1a17]/50">
          This comparative market analysis is an opinion of value prepared by a real estate agent from the sales and listings shown. It is not an appraisal and should not be used as one.
          {brand?.disclaimer ? ` ${brand.disclaimer}` : ""}
        </p>
      </main>
      {!preview && <AgentFooter agent={agent} brand={brand} note="Questions about this analysis? Reach out any time." />}
    </div>
  );
}
