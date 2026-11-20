import { Navigate } from "react-router-dom";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { agentSiteHref } from "../../lib/agentSiteLinks";
import IdxListings from "../brokerage-site/IdxListings";

// /home-search on an agent's site: the open-market MLS search (map, filters, hearts, saved searches, sign-in) with the site's own look. This is where a
// saved search opens, including the ones the agent saved for a client. Only exists once the agent has turned Home Search (IDX) on for the site.
export default function AgentHomeSearchPage() {
  const { site, siteId } = useAgentSiteContext();
  if (!site.idxEnabled) return <Navigate to={agentSiteHref(site.slug)} replace />;
  return (
    <IdxListings
      isStandalonePage
      officeOnly={false}
      brand={site.brokerage}
      visitorSite={{ kind: "agent", id: siteId }}
      sectionId="home-search"
      eyebrowOverride="Home Search"
      titleOverride={`Search homes with ${site.agent.first || site.agent.name || "us"}`}
    />
  );
}
