import { useEffect, useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { resolveLanding } from "../../lib/landingPages";
import { FEED_HOST, fetchFeed, handleFrom } from "../../lib/instagramFeed";
import "./instagram.css";

// "Follow along" (the line is the agent's own to change): the agent's latest Instagram posts as a row of square photos above the footer, closing the home page after Let's Connect.
// The posts come from a Behold feed (behold.so: the agent connects their Instagram there once and pastes the feed address into Site Details, in
// landing.instagram.feed_url), so the strip updates by itself when they post. No feed address, nothing shown.
export default function InstagramStrip() {
  const { site } = useAgentSiteContext();
  const { instagram } = resolveLanding(site.landing, site.agent.first);
  const [feed, setFeed] = useState(null);
  const url = instagram.feedUrl;

  useEffect(() => {
    if (!instagram.on || !FEED_HOST.test(url)) return undefined;
    let live = true;
    fetchFeed(url)
      .then((f) => live && setFeed(f))
      .catch(() => live && setFeed({ username: "", tiles: [] }));
    return () => {
      live = false;
    };
  }, [url, instagram.on]);

  if (!instagram.on || !FEED_HOST.test(url) || !feed || feed.tiles.length === 0) return null;
  const handle = handleFrom(instagram.handle) || handleFrom(site.social?.instagram) || feed.username;

  return (
    <section id="instagram" className="ig-strip px-6 lg:px-10 py-20 sm:py-24 bg-[var(--as-bg)] text-[var(--as-text)]">
      <div className="mx-auto max-w-7xl">
        <div className="ig-card">
          <a href={handle ? `https://instagram.com/${handle}` : undefined} target="_blank" rel="noopener noreferrer" className="ig-badge" aria-label="Instagram">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
            </svg>
          </a>
          <p className="ig-kicker">{instagram.label}</p>
          {handle && (
            <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" className="ig-handle font-display">
              @{handle.toUpperCase()}
            </a>
          )}
        </div>
        <ul className="ig-row">
          {feed.tiles.map((t) => (
            <li key={t.id}>
              <a href={t.href} target="_blank" rel="noopener noreferrer" aria-label={t.alt || "View on Instagram"}>
                <img src={t.src} alt="" loading="lazy" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
