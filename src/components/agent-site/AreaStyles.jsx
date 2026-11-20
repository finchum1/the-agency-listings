import { useAgentSiteContext } from "../../context/AgentSiteContext";
import useShowMore from "../../hooks/useShowMore";
import ShowMoreButton from "./ShowMoreButton";
import SiteLink from "./SiteLink";
import "./landing/panels.css";
import "./areas.css";

// Two ways to show the Areas of Expertise section without the map (landing.areas_style, set in Site Details):
//   "panels"  tall photo strips that open under the pointer, in rows of up to five (the same feel as the home page cards)
//   "index"   a big serif list of area names with one photo that changes as you point at a name
// Both link every area to its own page, and on a phone become plain stacked cards.

const stat = (area) => (area.stats?.[0] && area.stats[0].value ? `${area.stats[0].label}: ${area.stats[0].value}` : "Area of expertise");

// Splits a list into rows of at most `max`, as even as possible (9 becomes 5 and 4, not 5 and 4 by accident of order).
export function evenRows(items, max = 5) {
  const rows = Math.max(1, Math.ceil(items.length / max));
  const per = Math.ceil(items.length / rows);
  return Array.from({ length: rows }, (_, i) => items.slice(i * per, (i + 1) * per)).filter((r) => r.length);
}

export function AreaPanels({ header }) {
  const { site } = useAgentSiteContext();
  const more = useShowMore(site.areas, 4);
  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        {header}
        <div className="pn-wrap ar-rows">
          {evenRows(more.shown).map((row, i) => (
            <div key={i} className="pn-row ar-row">
              {row.map((a) => (
                <div key={a.id} className="pn">
                  {a.photo_url && <img src={a.photo_url} alt="" loading="lazy" className="pn-photo" />}
                  <div className="pn-shade" aria-hidden="true" />
                  <SiteLink slug={site.slug} path={`/areas/${a.slug}`} className="pn-link" aria-label={`${a.name}: explore this area`} />
                  <p className="pn-label">{a.name}</p>
                  <div className="pn-detail">
                    <span className="pn-eyebrow">{stat(a)}</span>
                    <p className="pn-title">{a.name}</p>
                    {a.blurb ? <p className="pn-blurb">{a.blurb}</p> : <span />}
                    <span className="pn-cta">Explore {a.name} →</span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        <ShowMoreButton more={more} />
      </div>
    </section>
  );
}
