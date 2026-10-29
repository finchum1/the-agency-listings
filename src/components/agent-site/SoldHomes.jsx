import { useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { formatPrice } from "../../lib/format";
import SiteLink from "./SiteLink";

// "Sold" tag text: the month and year of the closing, or just "Sold" when the agent left the date off.
const soldTag = (sale) => (sale.sold_on ? `Sold ${new Date(`${sale.sold_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "Sold");

// How many show: a taste on Home with a button through to the Past Sales page (/past-sales), which opens with a few rows and adds
// more each time its button is pressed.
const HOME_COUNT = 3;
const PAGE_FIRST = 12;
const PAGE_STEP = 12;

const moreButton = "as-btn inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

// The agent's past sales (agent_site_sales), shown right under their current listings in every layout. Nothing renders
// until the agent has added one.
// `limit`: show just that many with no "more" button (the Home Value page shows a taste of the track record).
// `page`: this is the Past Sales page itself: its own heading, a longer list, and a Show more button.
export default function SoldHomes({ limit, page = false }) {
  const { site } = useAgentSiteContext();
  const [shown, setShown] = useState(PAGE_FIRST);
  if (site.sales.length === 0) {
    return page ? (
      <section id="sold" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-3xl sm:text-4xl font-display font-semibold text-[var(--as-text)]">Past Sales</h1>
          <p className="mt-4 text-[var(--as-text)]/65">No past sales to show yet.</p>
        </div>
      </section>
    ) : null;
  }
  const sales = site.sales.slice(0, limit || (page ? shown : HOME_COUNT));
  const Heading = page ? "h1" : "h2";
  const remaining = limit ? 0 : site.sales.length - sales.length;
  return (
    <section id="sold" className="px-6 lg:px-10 py-20 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Track record</p>
        <Heading className={`${page ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"} font-display font-semibold mb-8 text-[var(--as-text)]`}>{page ? "Past Sales" : "Recently Sold"}</Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {sales.map((sale) => (
            <div key={sale.id}>
              <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                {sale.photo_url && <img src={sale.photo_url} alt={[sale.address, sale.city, sale.state].filter(Boolean).join(", ")} loading="lazy" className="h-full w-full object-cover" />}
                <span className="as-btn absolute top-4 left-4 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{soldTag(sale)}</span>
              </div>
              <p className="mt-4 font-medium text-[var(--as-text)]">{sale.address}</p>
              {(sale.city || sale.state) && <p className="text-sm text-[var(--as-text)]/60">{[sale.city, sale.state].filter(Boolean).join(", ")}</p>}
              {sale.price ? <p className="mt-1 font-display text-lg text-[var(--as-accent)]">{formatPrice(sale.price)}</p> : null}
            </div>
          ))}
        </div>
        {remaining > 0 && (
          <div className="mt-12 text-center">
            {page ? (
              <button type="button" onClick={() => setShown((n) => n + PAGE_STEP)} className={moreButton}>
                Show more
              </button>
            ) : (
              <SiteLink slug={site.slug} path="/past-sales" className={moreButton}>
                See all past sales
              </SiteLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
