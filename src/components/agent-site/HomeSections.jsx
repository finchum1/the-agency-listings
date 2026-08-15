import { useAgentSiteContext } from "../../context/AgentSiteContext";
import Hero from "./Hero";
import Bio from "./Bio";
import Testimonials from "./Testimonials";
import FeaturedListings from "./FeaturedListings";
import ServiceAreas from "./ServiceAreas";
import BlogTeaser from "./BlogTeaser";
import Contact from "./Contact";

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
};

export default function HomeSections() {
  const { site } = useAgentSiteContext();
  return (
    <>
      <Hero />
      {site.homeSections.map((key) => {
        const Section = SECTION_COMPONENTS[key];
        return Section ? <Section key={key} /> : null;
      })}
      <Contact />
    </>
  );
}
