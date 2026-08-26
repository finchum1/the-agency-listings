import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";
import Hero from "./Hero";
import About from "./About";
import AgentRoster from "./AgentRoster";
import AreasOfExpertise from "./AreasOfExpertise";
import BlogList from "./BlogList";
import ContactCard from "./ContactCard";

// Home page composition, driven by brokerage_site.home_sections — which
// of the optional sections show, and in what order (set in the
// dashboard's BrokerageSiteForm). Hero always leads and Contact always
// closes, same as agent-site/HomeSections.jsx. Agents/Areas/Blog render
// in their "preview" (capped, "View All"/"see more" link) form here —
// the standalone /brokerage/agents, /brokerage/areas, and /brokerage/blog
// pages each show the full list.
const SECTION_COMPONENTS = {
  about: About,
  agents: () => <AgentRoster preview />,
  areas: () => <AreasOfExpertise preview />,
  blog: () => <BlogList preview />,
};

export default function HomeSections() {
  const { site } = useBrokerageSiteContext();
  return (
    <>
      <Hero />
      {site.homeSections.map((key) => {
        const Section = SECTION_COMPONENTS[key];
        return Section ? <Section key={key} /> : null;
      })}
      <ContactCard />
    </>
  );
}
