import { useEffect, useState } from "react";
import { boardPath } from "../../../lib/deals";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";
import StartDealModal from "../people/StartDealModal";
import QuickAddModal, { KINDS } from "../people/QuickAddModal";
import { card } from "./styles";

// Deals are started the same way here as on the Deals page (people/StartDealModal): the same window, and a coordinator can also pick an agent.
const DEAL = { where: "Deals" };

const chip =
  "inline-flex items-center justify-center rounded-full text-sm font-semibold px-5 py-2.5 transition-colors whitespace-nowrap";

const placeOf = (kind) => (kind === "transaction" ? DEAL.where : KINDS[kind].where);

// One-click starts for the things done most: a blog post, and a new lead, pipeline contact or deal.
export default function Shortcuts({ wantsBlog, wantsPeople }) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(null); // lead | pipeline | transaction
  const [added, setAdded] = useState(null);
  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(null), 10000);
    return () => clearTimeout(t);
  }, [added]);

  if (!wantsBlog && !wantsPeople) return null;
  return (
    <section className={`${card} !py-4`} aria-label="Shortcuts">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mr-1">Shortcuts</span>
        {wantsBlog && (
          <Link to="/dashboard/site/blog?new=1" className={`${chip} bg-[#ed2127] dark:bg-[#f2454b] text-white hover:opacity-90`}>
            + Write a blog post
          </Link>
        )}
        {wantsPeople &&
          Object.entries(KINDS).map(([kind, k]) => (
            <button
              key={kind}
              type="button"
              onClick={() => {
                setAdded(null);
                setOpen(kind);
              }}
              className={`${chip} border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10`}
            >
              + {k.label}
            </button>
          ))}
        {wantsPeople && (
          <button
            type="button"
            onClick={() => {
              setAdded(null);
              setOpen("transaction");
            }}
            className={`${chip} border border-black/10 dark:border-white/15 hover:bg-black/5 dark:hover:bg-white/10`}
          >
            + Start a deal
          </button>
        )}
      </div>
      {added && (
        <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-400" role="status">
          Added {added.name} to {placeOf(added.kind)}.{" "}
          <Link to={boardPath(added.kind)} className="font-semibold underline">
            Open {placeOf(added.kind)}
          </Link>
          {added.note && <span className="block mt-1 text-amber-700 dark:text-amber-400">{added.note}</span>}
        </p>
      )}
      {open === "transaction" && (
        <StartDealModal
          coordinator={dealAccess(profile).isTc}
          onClose={() => setOpen(null)}
          onStarted={(id, note, own, name) => {
            setOpen(null);
            setAdded({ name: name || "the deal", kind: "transaction", note });
          }}
        />
      )}
      {open && open !== "transaction" && (
        <QuickAddModal
          kind={open}
          onClose={() => setOpen(null)}
          onAdded={(info) => {
            setOpen(null);
            setAdded(info);
          }}
        />
      )}
    </section>
  );
}
