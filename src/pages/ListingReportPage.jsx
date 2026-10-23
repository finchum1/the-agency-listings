import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import { RANGES, listingUrl } from "../lib/listingAnalytics";
import { formatPrice } from "../lib/format";
import ListingAnalyticsView from "../components/dashboard/ListingAnalyticsView";
import { AgentFooter, ClientHeader } from "../components/public/ClientPageParts";

// /report/<token>: the activity report an agent sends a seller. No sign-in; the token in the address is the credential, and
// search engines are told to stay away. Light theme only.
export default function ListingReportPage() {
  useForceLight();
  const { token } = useParams();
  const [days, setDays] = useState(30);
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    document.title = "Listing activity report";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let live = true;
    const first = state.loading ? "&first=1" : "";
    fetch(`/api/listing-report?token=${encodeURIComponent(token)}&days=${days}${first}`)
      .then(async (r) => (r.ok ? { data: await r.json() } : { gone: true }))
      .catch(() => ({ gone: true }))
      .then((s) => live && setState((prev) => ({ ...s, keep: prev.data })));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, days]);

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

  const { listing, analytics } = state.data;
  const brand = brandFromOrg(listing.org);
  const agent = listing.agent;
  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <ClientHeader brand={brand} />

      <section className="relative bg-[#1c1a17] text-white">
        {listing.photo && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${listing.photo})` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#1c1a17] via-[#1c1a17]/55 to-[#1c1a17]/30" />
        <div className="relative mx-auto max-w-5xl px-5 pt-24 sm:pt-32 pb-8">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/70">Online activity report</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{listing.address_line1}</h1>
          <p className="mt-2 text-sm sm:text-base text-white/80">
            {listing.city}, {listing.state}
            {listing.price ? ` · ${formatPrice(listing.price)}` : ""}
            {listing.status !== "draft" && (
              <>
                {" · "}
                <a href={listingUrl(listing)} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white">
                  View the listing website
                </a>
              </>
            )}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-[#1c1a17]/65">Live numbers for the property website, updated as visitors arrive.</p>
          <div className="flex items-center rounded-full border border-black/10 bg-white p-0.5 text-xs font-medium" role="group" aria-label="Time period">
            {RANGES.map((r) => (
              <button key={r.days} type="button" onClick={() => setDays(r.days)} className={`px-3.5 py-1.5 rounded-full ${days === r.days ? "bg-[#1c1a17] text-white" : "text-[#1c1a17]/60"}`}>
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <ListingAnalyticsView data={analytics} />
      </main>

      <AgentFooter agent={agent} brand={brand} note="Questions about this report? Reach out any time." />
    </div>
  );
}
