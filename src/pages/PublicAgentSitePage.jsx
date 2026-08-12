import { useParams } from "react-router-dom";
import { useAgentSite } from "../hooks/useAgentSite";
import AgentSitePage from "./AgentSitePage";

// Fetches by :slug and delegates rendering to AgentSitePage — used for
// every /sites/:slug... route in App.jsx, each passing its own pageTitle
// and section(s) as children.
export default function PublicAgentSitePage({ pageTitle, children }) {
  const { slug } = useParams();
  const result = useAgentSite({ slug });
  return (
    <AgentSitePage {...result} pageTitle={pageTitle}>
      {children}
    </AgentSitePage>
  );
}
