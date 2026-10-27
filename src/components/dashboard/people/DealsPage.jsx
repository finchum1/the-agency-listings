import { useAuth } from "../../../hooks/useAuth";
import { dealAccess } from "../../../lib/deals";
import { useDealAttention } from "../../../hooks/useDealAttention";
import PeopleBoard from "./PeopleBoard";
import OfficeDeals from "./OfficeDeals";
import DealsHome from "./DealsHome";

// Deals, on one page. An agent gets their overview and board. A coordinator or compliance reviewer also gets the deals they can see for
// other agents: on their own page when they have no board of their own, or as a section under the board when they do (never as a separate tab).
export default function DealsPage() {
  const { profile } = useAuth();
  const access = dealAccess(profile);
  const attention = useDealAttention(access.any);
  const viewer = access.isCompliance ? "compliance" : "tc";

  if (!access.team) return <PeopleBoard group="transaction" renderOverview={(props) => <DealsHome {...props} />} />;

  const heading = access.isCompliance ? "Other agents' deals" : "Deals you coordinate";
  const intro = access.isCompliance
    ? "Every deal in the office. Review documents, approve, or send a deal back to the agent."
    : "Your agents' deals. You can update dates and checklists and message compliance.";

  if (!access.mine) {
    return (
      <div>
        <div className="mb-5">
          <h1 className="text-2xl font-display font-semibold">Deals</h1>
          <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{intro}</p>
        </div>
        <OfficeDeals viewer={viewer} />
      </div>
    );
  }

  // Own board first; the others' deals follow on the same page. A note at the top points down when something is waiting there.
  const waiting = access.isCompliance ? attention.to_review : 0;
  return (
    <div className="space-y-10">
      <PeopleBoard
        group="transaction"
        renderOverview={(props) => (
          <>
            {waiting > 0 && (
              <button
                type="button"
                onClick={() => document.getElementById("other-deals")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="flex w-full items-center justify-between gap-3 rounded-2xl border border-[#ed2127]/30 dark:border-[#f2454b]/40 bg-[#ed2127]/[0.04] px-4 py-3 text-left text-sm"
              >
                <span>
                  <span className="font-semibold">{waiting}</span> deal{waiting === 1 ? " is" : "s are"} waiting for your compliance review
                </span>
                <span className="shrink-0 font-semibold text-[#ed2127] dark:text-[#f2454b]">Review ↓</span>
              </button>
            )}
            <DealsHome {...props} />
          </>
        )}
      />
      <section id="other-deals" aria-label={heading} className="scroll-mt-4">
        <div className="mb-4 border-t border-black/10 dark:border-white/10 pt-8">
          <h2 className="text-xl font-display font-semibold">{heading}</h2>
          <p className="mt-1 text-sm text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{intro}</p>
        </div>
        <OfficeDeals viewer={viewer} excludeOwn />
      </section>
    </div>
  );
}
