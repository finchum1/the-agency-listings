import { useParams } from "react-router-dom";
import { useAgentArea } from "../hooks/useAgentArea";
import AgentAreaPage from "./AgentAreaPage";

// Fetches by :slug/:areaSlug and delegates rendering to AgentAreaPage —
// used for the /sites/:slug/areas/:areaSlug route in App.jsx.
export default function PublicAgentAreaPage() {
  const { slug: siteSlug, areaSlug } = useParams();
  const result = useAgentArea({ siteSlug, areaSlug });
  return <AgentAreaPage {...result} />;
}
