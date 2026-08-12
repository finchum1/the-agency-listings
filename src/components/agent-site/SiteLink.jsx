import { Link } from "react-router-dom";
import { agentSiteHref, isAgentSiteAppHost } from "../../lib/agentSiteLinks";

// A link to another page of THIS agent site — a real SPA route on the app
// host, or a plain (possibly cross-host) anchor otherwise. See
// lib/agentSiteLinks.js for why the custom-domain case differs. Shared by
// Navbar, Hero, and Footer so all three agree on how agent-site links work.
export default function SiteLink({ slug, path, className, onClick, children }) {
  const href = agentSiteHref(slug, path);
  if (isAgentSiteAppHost()) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}
