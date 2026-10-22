import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import { groupByCategory, telHref, websiteHref } from "../lib/vendors";

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

  return (
    <div className="min-h-screen bg-[#f7f4ee] text-[#1c1a17]">
      <header className="bg-white border-b border-black/5">
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          {brand.logo ? <img src={brand.logo} alt={brand.name} className="h-8 w-auto" /> : <span className="font-display font-semibold">{brand.name}</span>}
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="font-display text-3xl font-semibold">{title || "Recommended vendors"}</h1>
        <p className="mt-2 text-sm text-[#1c1a17]/65">People we trust and send our own clients to. Tap a number to call.</p>

        {agent && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-white border border-black/5 p-4">
            {agent.photo_url && <img src={agent.photo_url} alt="" className="h-12 w-12 rounded-full object-cover" />}
            <div className="min-w-0 text-sm">
              <p className="font-semibold">{agent.full_name}</p>
              <p className="text-[#1c1a17]/60">{[agent.title, brand.name].filter(Boolean).join(" · ")}</p>
              <p className="mt-0.5 flex flex-wrap gap-x-3">
                {agent.phone && (
                  <a href={telHref(agent.phone)} className="text-[#ed2127] font-medium">
                    {agent.phone}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="break-all">
                    {agent.email}
                  </a>
                )}
              </p>
            </div>
          </div>
        )}

        <div className="mt-8 space-y-8">
          {groups.map((g) => (
            <section key={g.category} aria-label={g.category}>
              <h2 className="font-display text-lg font-semibold mb-2">{g.category}</h2>
              <ul className="space-y-3">
                {g.vendors.map((v) => (
                  <li key={v.id} className="rounded-xl bg-white border border-black/5 p-4">
                    <p className="font-semibold">{v.name}</p>
                    {v.contact_name && <p className="text-sm text-[#1c1a17]/60">{v.contact_name}</p>}
                    {v.notes && <p className="mt-1 text-sm text-[#1c1a17]/65">{v.notes}</p>}
                    <div className="mt-3 flex flex-wrap gap-2 text-sm font-semibold">
                      {v.phone && (
                        <a href={telHref(v.phone)} className="rounded-full bg-[#1c1a17] text-white px-4 py-2">
                          Call {v.phone}
                        </a>
                      )}
                      {v.email && (
                        <a href={`mailto:${v.email}`} className="rounded-full border border-black/15 px-4 py-2">
                          Email
                        </a>
                      )}
                      {v.website && (
                        <a href={websiteHref(v.website)} target="_blank" rel="noreferrer" className="rounded-full border border-black/15 px-4 py-2">
                          Website
                        </a>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
