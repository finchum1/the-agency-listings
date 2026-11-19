// The Instagram strip's feed (a Behold feed address, see components/agent-site/InstagramStrip.jsx): how to recognise one, fetch it and read the posts.
// Used by the public strip and by the feed check in Site Details, so the two always agree on what a good feed looks like.
export const FEED_HOST = /^https:\/\/feeds\.behold\.so\/[A-Za-z0-9_-]+/;

/** Behold's JSON is { username, posts: [...] } (older feeds are a bare array); each post has a permalink and sizes of its picture. */
export function readFeed(json) {
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

/** Fetches and reads a feed. Throws an Error whose message is safe to show the agent. */
export async function fetchFeed(url, signal) {
  if (!FEED_HOST.test(url)) throw new Error("That isn't a Behold feed address. It should start with https://feeds.behold.so/");
  let res;
  try {
    res = await fetch(url, { signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new Error("Couldn't reach that address. Check your connection and that the address is copied in full.");
  }
  if (res.status === 404) throw new Error("Behold doesn't have a feed at that address. Copy the feed address again from your Behold dashboard.");
  if (!res.ok) throw new Error(`Behold answered with an error (${res.status}). Try again in a minute.`);
  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("That address didn't return a feed. In Behold, copy the feed's JSON address (the one that starts with https://feeds.behold.so/).");
  }
  return readFeed(json);
}

/** "@name", an instagram.com link or a bare name, down to the name. */
export const handleFrom = (value) => String(value || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "");
