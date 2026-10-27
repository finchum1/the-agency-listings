import { useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { formatPrice } from "../../lib/format";
import SiteLink from "./SiteLink";

// "Sold" tag text: the month and year of the closing, or just "Sold" when the agent left the date off.
const soldTag = (sale) => (sale.sold_on ? `Sold ${new Date(`${sale.sold_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "Sold");

// How many show: a taste on Home with a button through to the Listings page, which opens with a couple of rows and adds
// more each time its button is pressed.
const HOME_COUNT = 3;
const PAGE_FIRST = 6;
const PAGE_STEP = 6;

const moreButton = "as-btn inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

// The agent's past sales (agent_site_sales), shown right under their current listings in every layout. Nothing renders
// until the agent has added one.
export default function SoldHomes() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const [shown, setShown] = useState(PAGE_FIRST);
  if (site.sales.length === 0) return null;
  const sales = site.sales.slice(0, isStandalonePage ? shown : HOME_COUNT);
  const remaining = site.sales.length - sales.length;
  return (
    <section id="sold" className="px-6 lg:px-10 py-20 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Track record</p>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-8 text-[var(--as-text)]">Recently Sold</h2>
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
            {isStandalonePage ? (
              <button type="button" onClick={() => setShown((n) => n + PAGE_STEP)} className={moreButton}>
                Show more
              </button>
            ) : (
              <SiteLink slug={site.slug} path="/listings" className={moreButton}>
                See more sold homes
              </SiteLink>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
