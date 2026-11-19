import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { resolveLanding } from "../../lib/landingPages";

// The Agency's paperclip A, huge and faint, running off the edge of a section (see .agency-clip in index.css). Only on The Agency offices' sites, and
// only while the agent hasn't turned it off (landing.paperclip). The section it goes in needs `relative overflow-hidden`, and its content `relative`.
//   side: "right" | "left"      pos: "center" | "bottom"      size: "lg" | "md"
//   tone: "accent" (the site's accent, on a light section) | "light" (white, on a dark band) | "onred" (white, a little stronger, on the red band)
export default function AgencyClip({ side = "right", pos = "center", size = "lg", tone = "accent" }) {
  const { site } = useAgentSiteContext();
  if (site.brokerage?.franchise !== "the-agency" || !resolveLanding(site.landing, site.agent.first).paperclip) return null;
  return <span className="agency-clip" data-side={side} data-pos={pos} data-size={size} data-tone={tone} aria-hidden="true" />;
}
