// A property site's video can be an uploaded file or a link to YouTube or Vimeo. This reads a pasted link; anything that isn't
// one of those (an uploaded file's address, a direct .mp4 link) returns null and is played as a plain video file.
//   YouTube: watch?v=ID, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID
//   Vimeo:   vimeo.com/ID, vimeo.com/ID/HASH (unlisted videos), player.vimeo.com/video/ID?h=HASH
// The ids are checked against the characters those services use, so nothing else ever ends up in an iframe address.
export function parseVideoLink(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  const parts = u.pathname.split("/").filter(Boolean);
  const YT = /^[\w-]{11}$/;

  if (host === "youtu.be" && YT.test(parts[0] || "")) return { provider: "youtube", id: parts[0] };
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    const id = u.searchParams.get("v") || (["shorts", "embed", "live", "v"].includes(parts[0]) ? parts[1] : "");
    if (YT.test(id || "")) return { provider: "youtube", id };
  }
  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const segs = host === "player.vimeo.com" ? parts.slice(parts[0] === "video" ? 1 : 0) : parts;
    const id = segs.find((s) => /^\d{5,12}$/.test(s));
    if (id) {
      const after = segs[segs.indexOf(id) + 1];
      const hash = u.searchParams.get("h") || (/^[0-9a-f]{6,20}$/i.test(after || "") ? after : "");
      return { provider: "vimeo", id, hash: /^[0-9a-f]{6,20}$/i.test(hash || "") ? hash : "" };
    }
  }
  return null;
}

/** The iframe address. `background` is the silent, looping, control-free version used behind a hero; otherwise a normal player. */
export function embedUrl(video, { background = false, autoplay = false } = {}) {
  if (!video) return "";
  if (video.provider === "youtube") {
    const p = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1", iv_load_policy: "3" });
    if (background) {
      p.set("autoplay", "1");
      p.set("mute", "1");
      p.set("controls", "0");
      p.set("loop", "1");
      p.set("playlist", video.id);
      p.set("disablekb", "1");
    } else if (autoplay) p.set("autoplay", "1");
    return `https://www.youtube-nocookie.com/embed/${video.id}?${p}`;
  }
  const p = new URLSearchParams({ dnt: "1", title: "0", byline: "0", portrait: "0" });
  if (video.hash) p.set("h", video.hash);
  if (background) {
    p.set("background", "1");
    p.set("autoplay", "1");
    p.set("loop", "1");
    p.set("muted", "1");
  } else if (autoplay) p.set("autoplay", "1");
  return `https://player.vimeo.com/video/${video.id}?${p}`;
}
