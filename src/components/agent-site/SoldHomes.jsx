import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { formatPrice } from "../../lib/format";

// "Sold" tag text: the month and year of the closing, or just "Sold" when the agent left the date off.
const soldTag = (sale) => (sale.sold_on ? `Sold ${new Date(`${sale.sold_on}T12:00:00`).toLocaleDateString("en-US", { month: "short", year: "numeric" })}` : "Sold");

// The agent's past sales (agent_site_sales), shown right under their current listings in every layout. Nothing renders
// until the agent has added one.
export default function SoldHomes() {
  const { site } = useAgentSiteContext();
  if (site.sales.length === 0) return null;
  return (
    <section id="sold" className="px-6 lg:px-10 py-20 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Track record</p>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold mb-8 text-[var(--as-text)]">Recently Sold</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
          {site.sales.map((sale) => (
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
      </div>
    </section>
  );
}
