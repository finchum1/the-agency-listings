import { useEffect, useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";
import { resolveLanding } from "../../lib/landingPages";
import "./instagram.css";

// "Follow our world": the agent's latest Instagram posts as a row of square photos above the footer, closing the home page after Let's Connect.
// The posts come from a Behold feed (behold.so: the agent connects their Instagram there once and pastes the feed address into Site Details, in
// landing.instagram.feed_url), so the strip updates by itself when they post. No feed address, nothing shown.
const FEED_HOST = /^https:\/\/feeds\.behold\.so\//;

// Behold's JSON is { username, posts: [...] } (older feeds are a bare array); each post has a permalink and sizes of its picture.
function readFeed(json) {
  const posts = Array.isArray(json) ? json : Array.isArray(json?.posts) ? json.posts : [];
  const tiles = posts
    .map((p) => ({
      id: p.id || p.permalink,
      href: p.permalink,
      src: p.sizes?.medium?.mediaUrl || p.sizes?.small?.mediaUrl || p.thumbnailUrl || p.mediaUrl || "",
      alt: String(p.prunedCaption || p.caption || "").replace(/\s+/g, " ").slice(0, 120),
    }))
    .filter((t) => t.src && t.href);
  return { username: json?.username || "", tiles: tiles.slice(0, 8) };
}

const handleFrom = (value) => String(value || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");

export default function InstagramStrip() {
  const { site } = useAgentSiteContext();
  const { instagram } = resolveLanding(site.landing, site.agent.first);
  const [feed, setFeed] = useState(null);
  const url = instagram.feedUrl;

  useEffect(() => {
    if (!instagram.on || !FEED_HOST.test(url)) return undefined;
    let live = true;
    fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`feed ${r.status}`))))
      .then((j) => live && setFeed(readFeed(j)))
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
          <p className="ig-kicker">Follow our world</p>
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
