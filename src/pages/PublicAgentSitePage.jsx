import { useParams } from "react-router-dom";
import { useAgentSite } from "../hooks/useAgentSite";
import AgentSitePage from "./AgentSitePage";

export default function PublicAgentSitePage() {
  const { slug } = useParams();
  const result = useAgentSite({ slug });
  return <AgentSitePage {...result} />;
}
