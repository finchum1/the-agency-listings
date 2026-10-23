import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import { groupByCategory, telHref, websiteHref } from "../lib/vendors";
import { AgentFooter, ClientHeader } from "../components/public/ClientPageParts";

// /vendors/<token>: the list of vendors an agent picked for a client. No sign-in; the token in the address is the credential,
// and the page tells search engines to stay away. Phone numbers are tap-to-call.
export default function VendorSharePage() {
  useForceLight();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    document.title = "Recommended vendors";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/vendor-share?token=${encodeURIComponent(token)}`)
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
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask whoever sent it for a new one.</p>
        </div>
      </div>
    );
  }

  const { agent, org, vendors, title } = state.data;
  const brand = brandFromOrg(org);
  const groups = groupByCategory(vendors);
  const slug = (c) => `cat-${c.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const btn = "inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold";

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <ClientHeader brand={brand} />

      <section className="bg-[#1c1a17] text-white">
        <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
          <p className="text-[11px] font-semibold tracking-[0.28em] uppercase text-white/60">Preferred vendors</p>
          <h1 className="mt-2 font-display text-4xl sm:text-5xl font-semibold leading-tight">{title || "Recommended vendors"}</h1>
          <p className="mt-3 max-w-xl text-base text-white/75">People we trust and send our own clients to. Tap a number to call, or a button to email or visit their website.</p>
          {agent && !(title || "").includes(agent.full_name) && (
            <div className="mt-6 inline-flex items-center gap-3 rounded-full bg-white/10 pl-1.5 pr-5 py-1.5">
              {agent.photo_url && <img src={agent.photo_url} alt="" className="h-10 w-10 rounded-full object-cover" />}
              <span className="text-sm">Shared by {agent.full_name}</span>
            </div>
          )}
        </div>
      </section>

      {groups.length > 1 && (
        <nav aria-label="Categories" className="sticky top-0 z-10 bg-[#f7f4ee]/95 backdrop-blur border-b border-black/10">
          <div className="mx-auto max-w-5xl px-5 py-3 flex gap-2 overflow-x-auto">
            {groups.map((g) => (
              <a key={g.category} href={`#${slug(g.category)}`} className="shrink-0 rounded-full border border-black/15 bg-white px-3.5 py-1.5 text-sm font-medium hover:bg-black/[0.04]">
                {g.category}
              </a>
            ))}
          </div>
        </nav>
      )}

      <main className="mx-auto max-w-5xl px-5 py-8 space-y-10">
        {groups.map((g) => (
          <section key={g.category} id={slug(g.category)} aria-label={g.category} className="scroll-mt-20">
            <div className="flex items-baseline gap-3 mb-3 border-b border-black/10 pb-2">
              <h2 className="font-display text-2xl font-semibold">{g.category}</h2>
              <span className="text-sm text-[#1c1a17]/50">{g.vendors.length}</span>
            </div>
            <ul className="grid sm:grid-cols-2 gap-4">
              {g.vendors.map((v) => (
                <li key={v.id} className="rounded-2xl bg-white border border-black/[0.06] p-5 shadow-sm shadow-black/[0.03] flex flex-col">
                  <p className="font-display text-xl font-semibold leading-snug">{v.name}</p>
                  {v.contact_name && <p className="text-sm text-[#1c1a17]/60 mt-0.5">{v.contact_name}</p>}
                  {v.notes && <p className="mt-2 text-sm text-[#1c1a17]/70">{v.notes}</p>}
                  <div className="mt-auto pt-4 flex flex-wrap gap-2">
                    {v.phone && (
                      <a href={telHref(v.phone)} className={`${btn} bg-[#1c1a17] text-white`}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
                        </svg>
                        {v.phone}
                      </a>
                    )}
                    {v.email && (
                      <a href={`mailto:${v.email}`} className={`${btn} border border-black/15`}>
                        Email
                      </a>
                    )}
                    {v.website && (
                      <a href={websiteHref(v.website)} target="_blank" rel="noreferrer" className={`${btn} border border-black/15`}>
                        Website
                      </a>
                    )}
                    {!v.phone && !v.email && !v.website && <span className="text-sm text-[#1c1a17]/50">Ask {agent?.full_name?.split(" ")[0] || "your agent"} for contact details</span>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <AgentFooter agent={agent} brand={brand} note="Questions about any of these? Reach out any time." />
    </div>
  );
}
