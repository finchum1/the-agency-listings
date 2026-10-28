import { useEffect, useLayoutEffect, useRef } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import Hero from "./Hero";
import Bio from "./Bio";
import Testimonials from "./Testimonials";
import FeaturedListings from "./FeaturedListings";
import ServiceAreas from "./ServiceAreas";
import BlogTeaser from "./BlogTeaser";
import LandingCards from "./landing/LandingCards";
import Contact from "./Contact";
import { LISTINGS_FIRST_LAYOUTS } from "./layouts";

// Home page composition, driven by agent_sites.home_sections — which of
// the optional sections show, and in what order (set in the site editor,
// see SiteForm.jsx). Hero always leads and Contact always closes; neither
// is in that list or optional. Each section already no-ops on empty data
// (e.g. Testimonials renders nothing with zero testimonials) regardless
// of this toggle — this is for an agent who wants a section HIDDEN even
// though it has content, or wants a different order.
const SECTION_COMPONENTS = {
  bio: Bio,
  testimonials: Testimonials,
  listings: FeaturedListings,
  areas: ServiceAreas,
  blog: BlogTeaser,
  cards: LandingCards,
};

// Sections take their background from the theme's two light tones (--as-bg and --as-bg-alt), and which one a section uses is fixed in the section.
// With the agent choosing which sections show and in what order, two neighbours can land on the same tone and run together as one band (on
// the sand theme, Make your move, Areas and Let's connect did). So after layout, any section whose background matches the one above it swaps the
// two tones for itself, which also swaps its cards and fields to match. A section that doesn't use those tones (a dark band) never changes.
function useAlternatingBands(ref) {
  const apply = () => {
    const box = ref.current;
    if (!box) return;
    const sections = [...box.children].filter((el) => el.nodeType === 1);
    for (const el of sections) {
      el.style.removeProperty("--as-bg");
      el.style.removeProperty("--as-bg-alt");
    }
    const tones = getComputedStyle(box);
    const bg = tones.getPropertyValue("--as-bg");
    const alt = tones.getPropertyValue("--as-bg-alt");
    if (!bg || !alt) return;
    let above = null;
    for (const el of sections) {
      let color = getComputedStyle(el).backgroundColor;
      if (above && color === above && color !== "rgba(0, 0, 0, 0)") {
        el.style.setProperty("--as-bg", alt);
        el.style.setProperty("--as-bg-alt", bg);
        const flipped = getComputedStyle(el).backgroundColor;
        if (flipped === above) {
          el.style.removeProperty("--as-bg");
          el.style.removeProperty("--as-bg-alt");
        } else color = flipped;
      }
      above = color;
    }
  };
  // On every render (the order or the theme may have changed), and when a section appears or goes later (some load their own content).
  useLayoutEffect(apply);
  useEffect(() => {
    const box = ref.current;
    if (!box) return undefined;
    const watcher = new MutationObserver(apply);
    watcher.observe(box, { childList: true });
    return () => watcher.disconnect();
  }, []);
}

export default function HomeSections() {
  const { site } = useAgentSiteContext();
  const bands = useRef(null);
  useAlternatingBands(bands);
  // A "listings first" layout puts the listings straight after the hero, whatever order the agent set for the rest.
  const sectionOrder =
    LISTINGS_FIRST_LAYOUTS.includes(site.layout) && site.homeSections.includes("listings")
      ? ["listings", ...site.homeSections.filter((k) => k !== "listings")]
      : site.homeSections;
  // Classic layout: the hero stays pinned and the rest of the page scrolls up over it, so the first scroll covers the
  // photo instead of moving it away. The sections all have solid backgrounds; they sit in a layer above the hero.
  // The wrapper limits how long the hero stays pinned to this block, so the footer is never under it.
  if (site.layout === "classic") {
    return (
      <div className="relative">
        <Hero />
        <div ref={bands} className="relative z-10">
          {sectionOrder.map((key) => {
            const Section = SECTION_COMPONENTS[key];
            return Section ? <Section key={key} /> : null;
          })}
          <Contact />
        </div>
      </div>
    );
  }
  return (
    <>
      <Hero />
      <div ref={bands}>
        {sectionOrder.map((key) => {
          const Section = SECTION_COMPONENTS[key];
          return Section ? <Section key={key} /> : null;
        })}
        <Contact />
      </div>
    </>
  );
}
