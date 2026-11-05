// Social posts for a listing: an Instagram square or a Story, with the listing's photo, details and the brokerage logo, drawn on a <canvas> so the
// preview on the page and the downloaded PNG are the same pixels. The page (components/dashboard/SocialPostPage.jsx) holds the choices; this file
// holds the sizes, the four kinds of post, the starting words for a listing, and the drawing.

export const FORMATS = {
  square: { label: "Instagram square", note: "1080 × 1080", w: 1080, h: 1080 },
  story: { label: "Story", note: "1080 × 1920", w: 1080, h: 1920 },
};

// The layouts a post can have. Each draws the same words and photo a different way (see drawPost).
export const TEMPLATES = {
  classic: { label: "Classic", note: "Photo with the words at the bottom, left aligned." },
  centered: { label: "Centered", note: "Everything centered, the logo on top." },
  band: { label: "Band", note: "The photo above a solid color band that holds the words." },
  card: { label: "Card", note: "A white card floating over the photo." },
  bold: { label: "Bold", note: "A huge headline over a darkened photo." },
};

// `badge` is the big word on the post; `price` says whether the price shows to start with (an agent often leaves it off a sold or under contract post).
export const POST_TYPES = {
  new: { label: "New Listing", badge: "Just Listed", price: true },
  sale: { label: "For Sale", badge: "For Sale", price: true },
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
    agent: agent?.full_name ? `Listed by: ${agent.full_name}` : "",
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

/** Draws the photo to fill (x, y, w, h), `zoom` of 1 or more, `ox` / `oy` from -1 to 1 placing the frame in the spare picture. */
function drawPhoto(ctx, img, x, y, w, h, post) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = "#14130f";
  ctx.fillRect(x, y, w, h);
  if (img) {
    const base = Math.max(w / img.naturalWidth, h / img.naturalHeight) * Math.max(1, post.zoom || 1);
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    ctx.drawImage(img, x + (w - dw) / 2 + ((post.ox || 0) * (dw - w)) / 2, y + (h - dh) / 2 + ((post.oy || 0) * (dh - h)) / 2, dw, dh);
  }
  ctx.restore();
}

function shade(ctx, x, y, w, h, from, to, a0, a1) {
  const g = ctx.createLinearGradient(0, y + h * from, 0, y + h * to);
  g.addColorStop(0, `rgba(12,11,9,${a0})`);
  g.addColorStop(1, `rgba(12,11,9,${a1})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
}

function drawLogo(ctx, logo, x, y, lh, align = "left") {
  if (!logo) return;
  const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
  ctx.drawImage(logo, align === "center" ? x - lw / 2 : x, y, lw, lh);
}

// The pill that carries the kind of post: outlined in the text color, or filled with the accent. `draw(left, top)` paints it.
function badgeBox(ctx, label, story, mode, ink, accent) {
  const size = story ? 32 : 28;
  ctx.font = `600 ${size}px ${SANS}`;
  const text = label.toUpperCase();
  const padX = 30;
  const padY = 17;
  const bw = spacedWidth(ctx, text, 6) + padX * 2;
  const bh = size + padY * 2;
  return {
    bw,
    bh,
    draw: (left, top) => {
      ctx.beginPath();
      ctx.roundRect(left + 1, top + 1, bw, bh - 2, bh / 2);
      if (mode === "solid") {
        ctx.fillStyle = accent;
        ctx.fill();
      } else {
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = ink;
        ctx.stroke();
      }
      ctx.font = `600 ${size}px ${SANS}`;
      ctx.fillStyle = mode === "solid" ? "#ffffff" : ink;
      ctx.textAlign = "left";
      spaced(ctx, text, left + padX + 1, top + padY + size * 0.78, 6);
    },
  };
}

/**
 * The words as a list of blocks, lowest first: { h, gap, draw(y) } where `y` is the block's baseline (its bottom edge) and `h` is how far it reaches
 * above it. `S` = { x, maxW, align, ink, soft, rule, badge: "outline" | "solid" | "giant", stack, story }.
 * `stack` puts the price on a line of its own (centered looks), instead of at the right of the details.
 */
function buildBlocks(ctx, post, S) {
  const t = post.text;
  const { x, maxW, align, ink, soft, story } = S;
  const blocks = [];
  ctx.textBaseline = "alphabetic";
  const put = (str, px, py) => {
    ctx.textAlign = align === "center" ? "center" : "left";
    ctx.fillText(str, px, py);
    ctx.textAlign = "left";
  };

  if (t.agent && t.showAgent) {
    const size = story ? 30 : 27;
    blocks.push({ h: 34, gap: 38, draw: (y) => {
      ctx.font = `400 ${size}px ${SANS}`;
      ctx.fillStyle = soft;
      put(t.agent, x, y);
    } });
  }

  const specSize = story ? 36 : 33;
  const priceSize = Math.round((story ? 64 : 58) * 0.82);
  const hasSpecs = Boolean(t.specs);
  const hasPrice = t.showPrice && t.price;
  const specText = (t.specs || "").replace(/\s{2,}/g, "  ");
  if (S.stack) {
    if (hasSpecs) {
      blocks.push({ h: specSize * 0.8, gap: hasPrice ? 26 : 34, draw: (y) => {
        ctx.font = `500 ${specSize}px ${SANS}`;
        const fit = fitLines(ctx, specText, maxW, 1, (s2) => `500 ${s2}px ${SANS}`, specSize, 22);
        ctx.font = `500 ${fit.size}px ${SANS}`;
        ctx.fillStyle = ink;
        put(fit.lines[0], x, y);
      } });
    }
    if (hasPrice) {
      blocks.push({ h: priceSize * 0.74, gap: 34, draw: (y) => {
        ctx.font = `600 ${priceSize}px ${SANS}`;
        ctx.fillStyle = ink;
        put(t.price, x, y);
      } });
    }
  } else if (hasSpecs || hasPrice) {
    blocks.push({ h: hasPrice ? priceSize * 0.74 : specSize * 0.8, gap: 34, draw: (y) => {
      if (hasPrice) {
        // the price is in the sans face: the serif's numerals are old-style (some digits hang below the line)
        ctx.font = `600 ${priceSize}px ${SANS}`;
        ctx.fillStyle = ink;
        ctx.textAlign = "right";
        ctx.fillText(t.price, x + maxW, y);
        ctx.textAlign = "left";
      }
      if (hasSpecs) {
        ctx.font = `600 ${priceSize}px ${SANS}`;
        const room = hasPrice ? maxW - ctx.measureText(t.price).width - 40 : maxW;
        const fit = fitLines(ctx, specText, room, 1, (s2) => `500 ${s2}px ${SANS}`, specSize, 22);
        ctx.font = `500 ${fit.size}px ${SANS}`;
        ctx.fillStyle = ink;
        ctx.fillText(fit.lines[0], x, y);
      }
    } });
  }

  blocks.push({ h: 4, gap: 34, draw: (y) => {
    ctx.fillStyle = S.rule;
    ctx.fillRect(align === "center" ? x - 60 : x, y - 4, 120, 4);
  } });

  if (t.place) {
    blocks.push({ h: 30, gap: 26, draw: (y) => {
      ctx.font = `500 ${story ? 30 : 27}px ${SANS}`;
      ctx.fillStyle = soft;
      spaced(ctx, t.place.toUpperCase(), x, y, 5, align === "center" ? "center" : "left");
    } });
  }

  if (t.address) {
    const size = story ? 96 : 84;
    const fit = fitLines(ctx, t.address, maxW, 2, (s2) => `600 ${s2}px ${SERIF}`, size, 44);
    const lineH = fit.size * 1.08;
    blocks.push({ h: lineH * (fit.lines.length - 1) + fit.size * 0.72, gap: S.addrGap ?? 46, draw: (y) => {
      ctx.font = `600 ${fit.size}px ${SERIF}`;
      ctx.fillStyle = ink;
      fit.lines.forEach((l, i) => put(l, x, y - lineH * (fit.lines.length - 1 - i)));
    } });
  }

  if (post.type === "open" && (t.detailDay || t.detailTime)) {
    const size = story ? 52 : 46;
    blocks.push({ h: size + 6, gap: 46, draw: (y) => {
      const text = [t.detailDay, t.detailTime].filter(Boolean).join("   ·   ");
      const fit = fitLines(ctx, text, maxW, 1, (s2) => `500 ${s2}px ${SERIF}`, size, 26);
      ctx.font = `500 ${fit.size}px ${SERIF}`;
      ctx.fillStyle = ink;
      put(fit.lines[0], x, y);
    } });
  }

  if (t.badge && (S.badge === "outline" || S.badge === "solid")) {
    const box = badgeBox(ctx, t.badge, story, S.badge, ink, S.accent);
    blocks.push({ h: box.bh, gap: 0, draw: (y) => box.draw(align === "center" ? x - box.bw / 2 : x, y - box.bh) });
  }

  // The giant headline of the Bold layout: each word on its own line, as large as the width allows.
  if (t.badge && S.badge === "giant") {
    const words = t.badge.toUpperCase().split(/\s+/).filter(Boolean).slice(0, 3);
    const fit = fitLines(ctx, words.reduce((a, b) => (a.length >= b.length ? a : b), ""), maxW, 1, (s2) => `700 ${s2}px ${SANS}`, story ? 190 : 150, 70);
    const lineH = fit.size * 0.98;
    blocks.push({ h: lineH * (words.length - 1) + fit.size * 0.72, gap: 54, draw: (y) => {
      ctx.font = `700 ${fit.size}px ${SANS}`;
      ctx.fillStyle = ink;
      words.forEach((w, i) => put(w, x, y - lineH * (words.length - 1 - i)));
    } });
  }
  return blocks;
}

const stackHeight = (blocks) => blocks.reduce((a, b) => a + b.h + b.gap, 0) - (blocks.length ? blocks[blocks.length - 1].gap : 0);
function paint(blocks, bottom) {
  let y = bottom;
  for (const b of blocks) {
    b.draw(y);
    y -= b.h + b.gap;
  }
}

/**
 * Draws the post. `post` = { format, template, type, zoom, ox, oy, text }, `pictures` = { photo, logo } (loaded images, either may be missing).
 * `zoom` is 1 or more (1 fills the frame), `ox` / `oy` are -1 to 1: where in the spare picture the frame sits.
 */
export function drawPost(canvas, post, pictures) {
  const { w: W, h: H } = FORMATS[post.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const story = post.format === "story";
  const template = TEMPLATES[post.template] ? post.template : "classic";
  const { photo, logo } = pictures;
  const ACCENT = "#ed2127";
  const M = 88;
  // A Story keeps its words and logo clear of the strips the app covers at the top and bottom.
  const topY = story ? 250 : 84;
  const bottomY = H - (story ? 280 : 88);
  const white = { ink: "#ffffff", soft: "rgba(255,255,255,0.8)", rule: ACCENT, accent: ACCENT, story };

  if (template === "centered") {
    drawPhoto(ctx, photo, 0, 0, W, H, post);
    shade(ctx, 0, 0, W, H, story ? 0.4 : 0.34, 1, 0, 0.92);
    shade(ctx, 0, 0, W, H, 0, 0.24, 0.45, 0);
    drawLogo(ctx, logo, W / 2, topY, story ? 104 : 90, "center");
    const blocks = buildBlocks(ctx, post, { ...white, x: W / 2, maxW: W - M * 2, align: "center", badge: "outline", stack: true });
    paint(blocks, bottomY);
    return;
  }

  if (template === "band") {
    // The band is only as tall as its words need (an open house's date line makes it taller); the photo gets the rest.
    const blocks = buildBlocks(ctx, post, { ...white, x: M, maxW: W - M * 2, align: "left", badge: "none" });
    const box = post.text.badge ? badgeBox(ctx, post.text.badge, story, "solid", "#ffffff", ACCENT) : null;
    const bandBottom = H - (story ? 280 : 76);
    const wanted = bandBottom - stackHeight(blocks) - (box ? box.bh / 2 : 0) - 52;
    const photoH = Math.round(Math.min(H * (story ? 0.62 : 0.56), Math.max(H * 0.36, wanted)));
    drawPhoto(ctx, photo, 0, 0, W, photoH, post);
    shade(ctx, 0, 0, W, photoH * 0.3, 0, 1, 0.4, 0);
    ctx.fillStyle = "#14130f";
    ctx.fillRect(0, photoH, W, H - photoH);
    ctx.fillStyle = ACCENT;
    ctx.fillRect(0, photoH, W, 8);
    drawLogo(ctx, logo, M, topY, story ? 104 : 88);
    // The kind of post sits on the edge between the photo and the band.
    if (box) box.draw(M, photoH + 4 - box.bh / 2);
    paint(blocks, bandBottom);
    return;
  }

  if (template === "card") {
    drawPhoto(ctx, photo, 0, 0, W, H, post);
    shade(ctx, 0, 0, W, H, 0, 0.25, 0.4, 0);
    shade(ctx, 0, 0, W, H, 0.6, 1, 0, 0.35);
    drawLogo(ctx, logo, M, topY, story ? 104 : 88);
    const pad = 56;
    const cardX = 52;
    const cardW = W - cardX * 2;
    const ink = { ink: "#1c1a17", soft: "rgba(28,26,23,0.62)", rule: ACCENT, accent: ACCENT, story };
    const blocks = buildBlocks(ctx, post, { ...ink, x: cardX + pad, maxW: cardW - pad * 2, align: "left", badge: "solid" });
    const inner = stackHeight(blocks);
    const cardBottom = bottomY + (story ? 40 : 36);
    const cardTop = Math.max(topY + 140, cardBottom - inner - pad * 2 + 14);
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = "#faf9f7";
    ctx.beginPath();
    ctx.roundRect(cardX, cardTop, cardW, cardBottom - cardTop, 28);
    ctx.fill();
    ctx.restore();
    paint(blocks, cardBottom - pad);
    return;
  }

  if (template === "bold") {
    drawPhoto(ctx, photo, 0, 0, W, H, post);
    ctx.fillStyle = "rgba(12,11,9,0.38)";
    ctx.fillRect(0, 0, W, H);
    shade(ctx, 0, 0, W, H, 0.45, 1, 0, 0.7);
    drawLogo(ctx, logo, M, topY, story ? 104 : 88);
    const blocks = buildBlocks(ctx, post, { ...white, x: M, maxW: W - M * 2, align: "left", badge: "giant", addrGap: 72 });
    paint(blocks, bottomY);
    return;
  }

  // classic
  drawPhoto(ctx, photo, 0, 0, W, H, post);
  shade(ctx, 0, 0, W, H, story ? 0.45 : 0.4, 1, 0, 0.9);
  shade(ctx, 0, 0, W, H, 0, 0.22, 0.45, 0);
  drawLogo(ctx, logo, M, topY, story ? 112 : 96);
  const blocks = buildBlocks(ctx, post, { ...white, x: M, maxW: W - M * 2, align: "left", badge: "outline" });
  paint(blocks, bottomY);
}
