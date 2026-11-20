import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useForceLight } from "../hooks/useForceLight";
import { brandFromOrg } from "../lib/brand";
import CmaReport from "../components/public/CmaReport";

// /cma/<token>: a CMA an agent shared with a client. No sign-in; the token in the address is the credential, and the page tells search
// engines to stay away. "Print / Save as PDF" prints just the report.
export default function CmaSharePage() {
  useForceLight();
  const { token } = useParams();
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    document.title = "Comparative Market Analysis";
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let live = true;
    fetch(`/api/cma-share?token=${encodeURIComponent(token)}`)
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
      <div className="agency-brand min-h-screen grid place-items-center px-6 text-center bg-[#F5F1E9] text-[#1C1C1B]">
        <div>
          <h1 className="font-display text-2xl font-semibold">This link isn't available anymore</h1>
          <p className="mt-2 text-sm text-[#1c1a17]/60">Ask whoever sent it for a new one.</p>
        </div>
      </div>
    );
  }
  const { agent, org, ...cma } = state.data;
  return <CmaReport cma={cma} agent={agent} brand={brandFromOrg(org)} />;
}
