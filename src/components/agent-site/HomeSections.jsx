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

export default function HomeSections() {
  const { site } = useAgentSiteContext();
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
        <div className="relative z-10">
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
      {sectionOrder.map((key) => {
        const Section = SECTION_COMPONENTS[key];
        return Section ? <Section key={key} /> : null;
      })}
      <Contact />
    </>
  );
}
