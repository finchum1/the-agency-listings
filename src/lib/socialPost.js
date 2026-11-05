// Social posts for a listing: an Instagram square or a Story, with the listing's photo, details and the brokerage logo, drawn on a <canvas> so the
// preview on the page and the downloaded PNG are the same pixels. The page (components/dashboard/SocialPostPage.jsx) holds the choices; this file
// holds the sizes, the four kinds of post, the starting words for a listing, and the drawing.

export const FORMATS = {
  square: { label: "Instagram square", note: "1080 × 1080", w: 1080, h: 1080 },
  story: { label: "Story", note: "1080 × 1920", w: 1080, h: 1920 },
};

// `badge` is the big word on the post; `price` says whether the price shows to start with (an agent often leaves it off a sold or under contract post).
export const POST_TYPES = {
  new: { label: "New Listing", badge: "Just Listed", price: true },
  contract: { label: "Under Contract", badge: "Under Contract", price: false },
  open: { label: "Open House", badge: "Open House", price: true },
  closed: { label: "Closed", badge: "Just Sold", price: false },
};

const money = (n) => (n || n === 0 ? `$${Math.round(Number(n)).toLocaleString("en-US")}` : "");
const trimNum = (n) => String(Number(n));

/** "4 Beds · 5.2 Baths · 6,886 Sq Ft", leaving out whatever the listing does not have. */
export function specsLine(listing) {
  return [
    listing.beds ? `${trimNum(listing.beds)} ${Number(listing.beds) === 1 ? "Bed" : "Beds"}` : "",
    listing.baths ? `${trimNum(listing.baths)} ${Number(listing.baths) === 1 ? "Bath" : "Baths"}` : "",
    listing.sqft ? `${Number(listing.sqft).toLocaleString("en-US")} Sq Ft` : "",
  ]
    .filter(Boolean)
    .join("  ·  ");
}

/** The next open house that has not ended, as "Sunday, November 8" and "1:00 – 3:00 PM"; null when there is none. */
export function openHouseLines(openHouses, now = new Date()) {
  const next = (openHouses || []).find((o) => new Date(o.ends_at || o.starts_at) >= now);
  if (!next) return null;
  const start = new Date(next.starts_at);
  const clock = (d) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }).replace(":00", "");
  return {
    day: start.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    time: next.ends_at ? `${clock(start)} – ${clock(new Date(next.ends_at))}` : clock(start),
  };
}

/** Which kind of post a listing most likely needs first, from where it stands. */
export function defaultType(listing) {
  if (listing.status === "closed") return "closed";
  if (listing.status === "pending") return "contract";
  return "new";
}

/** The words a post of this kind starts with, from the listing. All of it can be changed on the page. */
export function startingText(listing, agent, type, openHouses) {
  const kind = POST_TYPES[type];
  const oh = type === "open" ? openHouseLines(openHouses) : null;
  return {
    badge: kind.badge,
    address: listing.address_line1 || "",
    place: [listing.city, listing.state].filter(Boolean).join(", "),
    specs: specsLine(listing),
    showPrice: kind.price && Boolean(listing.price),
    price: money(listing.price),
    detailDay: oh?.day || "",
    detailTime: oh?.time || "",
    showAgent: true,
    agent: [agent?.full_name, agent?.phone].filter(Boolean).join("  ·  "),
  };
}

// ---- drawing -----------------------------------------------------------------------------------------------------------------------------

const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

/** Loads the web fonts the post uses, so the canvas does not fall back to a plain one on the first draw. */
export async function loadPostFonts() {
  if (!document.fonts?.load) return;
  await Promise.all([
    document.fonts.load(`600 80px ${SERIF}`),
    document.fonts.load(`500 80px ${SERIF}`),
    document.fonts.load(`500 30px ${SANS}`),
    document.fonts.load(`600 30px ${SANS}`),
    document.fonts.load(`400 30px ${SANS}`),
  ]).catch(() => {});
}

/** A picture ready to draw: fetched as bytes first so the canvas stays clean enough to export. */
export async function loadPicture(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Couldn't load that picture.");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Couldn't read that picture."));
      img.src = objectUrl;
    });
  } finally {
    // the decoded image stays usable after the URL is released
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}

// Letters spaced out by hand (ctx.letterSpacing is not in every browser), left, center or right aligned from `x`.
function spaced(ctx, text, x, y, space, align = "left") {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total = widths.reduce((a, b) => a + b, 0) + space * Math.max(0, chars.length - 1);
  let cx = align === "right" ? x - total : align === "center" ? x - total / 2 : x;
  chars.forEach((c, i) => {
    ctx.fillText(c, cx, y);
    cx += widths[i] + space;
  });
  return total;
}
const spacedWidth = (ctx, text, space) => [...text].reduce((a, c) => a + ctx.measureText(c).width, 0) + space * Math.max(0, [...text].length - 1);

// Breaks `text` into at most `maxLines` lines no wider than `maxWidth`, shrinking the font a few steps when it still does not fit.
function fitLines(ctx, text, maxWidth, maxLines, fontFor, size, minSize) {
  for (let s = size; s >= minSize; s -= 4) {
    ctx.font = fontFor(s);
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width <= maxWidth || !line) line = test;
      else {
        lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxWidth)) return { lines, size: s };
  }
  ctx.font = fontFor(minSize);
  return { lines: [String(text)], size: minSize };
}

/**
 * Draws the post. `post` = { format, type, photo, zoom, ox, oy, logo, text }, `pictures` = { photo, logo } (loaded images, either may be missing).
 * `zoom` is 1 or more (1 fills the frame), `ox` / `oy` are -1 to 1: where in the spare picture the frame sits.
 */
export function drawPost(canvas, post, pictures) {
  const { w: W, h: H } = FORMATS[post.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const story = post.format === "story";
  const t = post.text;

  // The photo, filling the frame.
  ctx.fillStyle = "#14130f";
  ctx.fillRect(0, 0, W, H);
  const img = pictures.photo;
  if (img) {
    const base = Math.max(W / img.naturalWidth, H / img.naturalHeight) * Math.max(1, post.zoom || 1);
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const dx = (W - dw) / 2 + ((post.ox || 0) * (dw - W)) / 2;
    const dy = (H - dh) / 2 + ((post.oy || 0) * (dh - H)) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  // Darker at the bottom, where the words sit, and a little at the top for the logo.
  const bottomShade = ctx.createLinearGradient(0, H * (story ? 0.45 : 0.4), 0, H);
  bottomShade.addColorStop(0, "rgba(12,11,9,0)");
  bottomShade.addColorStop(1, "rgba(12,11,9,0.9)");
  ctx.fillStyle = bottomShade;
  ctx.fillRect(0, 0, W, H);
  const topShade = ctx.createLinearGradient(0, 0, 0, H * 0.22);
  topShade.addColorStop(0, "rgba(12,11,9,0.45)");
  topShade.addColorStop(1, "rgba(12,11,9,0)");
  ctx.fillStyle = topShade;
  ctx.fillRect(0, 0, W, H);

  // Margins. A Story keeps its words and logo clear of the strips the app covers at the top and bottom.
  const M = 88;
  const topY = story ? 250 : 84;
  const bottomY = H - (story ? 280 : 88);
  const maxW = W - M * 2;

  // The logo, top left.
  const logo = pictures.logo;
  if (logo) {
    const lh = story ? 112 : 96;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    ctx.drawImage(logo, M, topY, lw, lh);
  }

  // The words, built from the bottom up: first work out what each line is, then stack them.
  const blocks = [];
  ctx.textBaseline = "alphabetic";

  if (t.agent && t.showAgent) {
    ctx.font = `400 ${story ? 30 : 27}px ${SANS}`;
    blocks.push({ h: 34, gap: 38, draw: (y) => {
      ctx.font = `400 ${story ? 30 : 27}px ${SANS}`;
      ctx.fillStyle = "rgba(255,255,255,0.78)";
      ctx.fillText(t.agent, M, y);
    } });
  }

  const specSize = story ? 36 : 33;
  const hasSpecs = Boolean(t.specs);
  const hasPrice = t.showPrice && t.price;
  if (hasSpecs || hasPrice) {
    ctx.font = `500 ${specSize}px ${SANS}`;
    const priceSize = story ? 64 : 58;
    blocks.push({ h: hasPrice ? priceSize * 0.74 : specSize * 0.8, gap: 34, draw: (y) => {
      if (hasPrice) {
        // the price is in the sans face: the serif's numerals are old-style (some digits hang below the line)
        ctx.font = `600 ${Math.round(priceSize * 0.82)}px ${SANS}`;
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "right";
        ctx.fillText(t.price, W - M, y);
        ctx.textAlign = "left";
      }
      if (hasSpecs) {
        ctx.font = `500 ${specSize}px ${SANS}`;
        ctx.fillStyle = "#ffffff";
        ctx.font = `600 ${Math.round(priceSize * 0.82)}px ${SANS}`;
        const room = hasPrice ? maxW - ctx.measureText(t.price).width - 40 : maxW;
        ctx.font = `500 ${specSize}px ${SANS}`;
        // the details drop to a smaller size rather than run into the price
        const fit = fitLines(ctx, t.specs.replace(/\s{2,}/g, "  "), room, 1, (s) => `500 ${s}px ${SANS}`, specSize, 22);
        ctx.font = `500 ${fit.size}px ${SANS}`;
        ctx.fillText(fit.lines[0], M, y);
      }
    } });
  }

  blocks.push({ h: 4, gap: 34, draw: (y) => {
    ctx.fillStyle = "#ed2127";
    ctx.fillRect(M, y - 4, 120, 4);
  } });

  if (t.place) {
    blocks.push({ h: 30, gap: 26, draw: (y) => {
      ctx.font = `500 ${story ? 30 : 27}px ${SANS}`;
      ctx.fillStyle = "rgba(255,255,255,0.82)";
      spaced(ctx, t.place.toUpperCase(), M, y, 5);
    } });
  }

  if (t.address) {
    const size = story ? 96 : 84;
    const fit = fitLines(ctx, t.address, maxW, 2, (s) => `600 ${s}px ${SERIF}`, size, 44);
    const lineH = fit.size * 1.08;
    blocks.push({ h: lineH * (fit.lines.length - 1) + fit.size * 0.72, gap: 46, draw: (y) => {
      ctx.font = `600 ${fit.size}px ${SERIF}`;
      ctx.fillStyle = "#ffffff";
      fit.lines.forEach((l, i) => ctx.fillText(l, M, y - lineH * (fit.lines.length - 1 - i)));
    } });
  }

  if (post.type === "open" && (t.detailDay || t.detailTime)) {
    blocks.push({ h: story ? 50 : 46, gap: 46, draw: (y) => {
      ctx.font = `500 ${story ? 52 : 46}px ${SERIF}`;
      ctx.fillStyle = "#ffffff";
      const text = [t.detailDay, t.detailTime].filter(Boolean).join("   ·   ");
      const fit = fitLines(ctx, text, maxW, 1, (s) => `500 ${s}px ${SERIF}`, story ? 52 : 46, 26);
      ctx.font = `500 ${fit.size}px ${SERIF}`;
      ctx.fillText(fit.lines[0], M, y);
    } });
  }

  if (t.badge) {
    const size = story ? 32 : 28;
    ctx.font = `600 ${size}px ${SANS}`;
    const label = t.badge.toUpperCase();
    const textW = spacedWidth(ctx, label, 6);
    const padX = 30;
    const padY = 17;
    blocks.push({ h: size + padY * 2, gap: 0, draw: (y) => {
      const bw = textW + padX * 2;
      const bh = size + padY * 2;
      const top = y - bh;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(M + 1, top + 1, bw, bh - 2, bh / 2);
      ctx.stroke();
      ctx.font = `600 ${size}px ${SANS}`;
      ctx.fillStyle = "#ffffff";
      spaced(ctx, label, M + padX + 1, top + padY + size * 0.78, 6);
    } });
  }

  // Stack them upward from the bottom edge, the first block (the agent line) lowest.
  let y = bottomY;
  for (const b of blocks) {
    b.draw(y);
    y -= b.h + b.gap;
  }
}
