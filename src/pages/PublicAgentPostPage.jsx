import { useParams } from "react-router-dom";
import { useAgentPost } from "../hooks/useAgentPost";
import AgentPostPage from "./AgentPostPage";

// Fetches by :slug/:postSlug and delegates rendering to AgentPostPage —
// used for the /sites/:slug/blog/:postSlug route in App.jsx.
export default function PublicAgentPostPage() {
  const { slug: siteSlug, postSlug } = useParams();
  const result = useAgentPost({ siteSlug, postSlug });
  return <AgentPostPage {...result} />;
}
