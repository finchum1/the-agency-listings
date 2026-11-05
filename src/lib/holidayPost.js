// Holiday posts for the Marketing module: a greeting on a solid brand color, as an Instagram square or a Story. Nothing to do with a listing. This file
// holds the holiday calendar, the colors and the drawing; components/dashboard/HolidayPostPage.jsx holds the choices.
import { FORMATS, loadPostFonts, loadPicture } from "./socialPost";

export { FORMATS, loadPostFonts, loadPicture };

// ---- the calendar --------------------------------------------------------------------------------------------------------------------------

const pad = (n) => String(n).padStart(2, "0");
const key = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
// The nth (1-based) given weekday (0 = Sunday) of a month, e.g. the fourth Thursday of November.
const nth = (y, m, weekday, n) => 1 + ((7 + weekday - new Date(y, m, 1).getDay()) % 7) + (n - 1) * 7;
const last = (y, m, weekday) => {
  const end = new Date(y, m + 1, 0);
  return end.getDate() - ((7 + end.getDay() - weekday) % 7);
};
// Easter Sunday (the usual Gregorian computus).
function easter(y) {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return [month, day];
}

// Greeting and a line under it for each holiday. The lines are warm and plain: nothing that depends on how a person celebrates.
export const HOLIDAYS = [
  { id: "newyear", name: "New Year's Day", greeting: "Happy New Year", message: "Here's to a year of new beginnings and new homes.", on: (y) => key(y, 0, 1) },
  { id: "mlk", name: "Martin Luther King Jr. Day", greeting: "Martin Luther King Jr. Day", message: "Honoring a legacy of service and hope.", on: (y) => key(y, 0, nth(y, 0, 1, 3)) },
  { id: "valentines", name: "Valentine's Day", greeting: "Happy Valentine's Day", message: "Wishing you a day filled with love.", on: (y) => key(y, 1, 14) },
  { id: "presidents", name: "Presidents' Day", greeting: "Happy Presidents' Day", message: "Enjoy the long weekend.", on: (y) => key(y, 1, nth(y, 1, 1, 3)) },
  { id: "stpats", name: "St. Patrick's Day", greeting: "Happy St. Patrick's Day", message: "May your luck be as good as your location.", on: (y) => key(y, 2, 17) },
  { id: "easter", name: "Easter", greeting: "Happy Easter", message: "Wishing you a day of joy and time with family.", on: (y) => { const [m, d] = easter(y); return key(y, m, d); } },
  { id: "mothers", name: "Mother's Day", greeting: "Happy Mother's Day", message: "Celebrating the moms who make a house a home.", on: (y) => key(y, 4, nth(y, 4, 0, 2)) },
  { id: "memorial", name: "Memorial Day", greeting: "Memorial Day", message: "Honoring those who gave everything for our freedom.", on: (y) => key(y, 4, last(y, 4, 1)) },
  { id: "juneteenth", name: "Juneteenth", greeting: "Happy Juneteenth", message: "Celebrating freedom and reflecting on progress.", on: (y) => key(y, 5, 19) },
  { id: "fathers", name: "Father's Day", greeting: "Happy Father's Day", message: "Thank you to the dads who work to make a home.", on: (y) => key(y, 5, nth(y, 5, 0, 3)) },
  { id: "july4", name: "Independence Day", greeting: "Happy 4th of July", message: "Wishing you a safe and joyful holiday.", on: (y) => key(y, 6, 4) },
  { id: "labor", name: "Labor Day", greeting: "Happy Labor Day", message: "Thank you to everyone who works so hard. Enjoy your day off.", on: (y) => key(y, 8, nth(y, 8, 1, 1)) },
  { id: "halloween", name: "Halloween", greeting: "Happy Halloween", message: "Wishing you more treats than tricks.", on: (y) => key(y, 9, 31) },
  { id: "veterans", name: "Veterans Day", greeting: "Veterans Day", message: "Thank you to everyone who has served.", on: (y) => key(y, 10, 11) },
  { id: "thanksgiving", name: "Thanksgiving", greeting: "Happy Thanksgiving", message: "Grateful for you, your trust and your friendship.", on: (y) => key(y, 10, nth(y, 10, 4, 4)) },
  { id: "christmas", name: "Christmas", greeting: "Merry Christmas", message: "Wishing you a season of warmth and joy at home.", on: (y) => key(y, 11, 25) },
  { id: "newyears_eve", name: "New Year's Eve", greeting: "Happy New Year's Eve", message: "Cheers to a great year, and an even better one ahead.", on: (y) => key(y, 11, 31) },
];

/** Every holiday with its next date on or after `today` ("YYYY-MM-DD"), soonest first. */
export function upcomingHolidays(today) {
  const year = Number(today.slice(0, 4));
  return HOLIDAYS.map((h) => {
    const thisYear = h.on(year);
    return { ...h, date: thisYear >= today ? thisYear : h.on(year + 1) };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// ---- colors and layouts --------------------------------------------------------------------------------------------------------------------

export const LAYOUTS = {
  centered: { label: "Centered", note: "The greeting centered, with your logo at the bottom." },
  portrait: { label: "With your photo", note: "Your headshot above the greeting." },
  left: { label: "Big and left", note: "An oversized greeting, left aligned." },
};

/** The brand colors a post can use: the organization's own accents first, then the house colors. */
export function paletteFor(accentColors = []) {
  const house = [
    { name: "Agency red", hex: "#ed2127" },
    { name: "Ink", hex: "#14130f" },
    { name: "Cream", hex: "#f7f4ee" },
    { name: "Sand", hex: "#ddd0ba" },
  ];
  const named = (hex) => house.find((c) => c.hex.toLowerCase() === hex.toLowerCase())?.name;
  const own = accentColors.filter((c) => /^#[0-9a-f]{6}$/i.test(c)).map((hex, i) => ({ name: named(hex) || `Brand ${i + 1}`, hex }));
  const seen = new Set();
  return [...own, ...house].filter((c) => (seen.has(c.hex.toLowerCase()) ? false : seen.add(c.hex.toLowerCase())));
}

const luminance = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
/** True when text on this color should be dark. */
export const isLight = (hex) => luminance(hex) > 0.42;

// ---- drawing -------------------------------------------------------------------------------------------------------------------------------

const SERIF = '"Playfair Display", Georgia, serif';
const SANS = 'Inter, "Helvetica Neue", Arial, sans-serif';

function wrap(ctx, text, maxWidth, maxLines, font, size, minSize) {
  for (let s = size; s >= minSize; s -= 4) {
    ctx.font = font(s);
    const lines = [];
    let line = "";
    for (const w of String(text).split(/\s+/).filter(Boolean)) {
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
  ctx.font = font(minSize);
  return { lines: [String(text)], size: minSize };
}

/**
 * Draws the holiday post. `post` = { format, layout, bg, text: { greeting, message, signoff, showSign, showPhoto } }, `pictures` = { logo, photo }.
 * The logo and text colors follow the background: dark ink on a light color, white on a dark one (the red logo on cream or sand, the white logo elsewhere).
 */
export function drawHoliday(canvas, post, pictures, logos = {}) {
  const { w: W, h: H } = FORMATS[post.format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  const story = post.format === "story";
  const light = isLight(post.bg);
  const ink = light ? "#1c1a17" : "#ffffff";
  const soft = light ? "rgba(28,26,23,0.72)" : "rgba(255,255,255,0.82)";
  const faint = light ? "rgba(28,26,23,0.07)" : "rgba(255,255,255,0.08)";
  const line = light ? "rgba(28,26,23,0.35)" : "rgba(255,255,255,0.5)";
  const t = post.text;
  const layout = LAYOUTS[post.layout] ? post.layout : "centered";

  ctx.fillStyle = post.bg;
  ctx.fillRect(0, 0, W, H);

  // Tone-on-tone shapes, so a flat color still has some depth.
  ctx.fillStyle = faint;
  ctx.beginPath();
  ctx.arc(W * 0.92, H * (story ? 0.16 : 0.1), W * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.04, H * 0.96, W * 0.34, 0, Math.PI * 2);
  ctx.fill();

  // A thin inset frame.
  const inset = 44;
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);

  const M = 110;
  const maxW = W - M * 2;
  const top = story ? 300 : 120;
  const bottom = H - (story ? 300 : 120);
  // `logos` = { onLight, onDark }: the mark that reads on a light color, and the one that reads on a dark color.
  const logo = light ? logos.onLight || pictures.logo : logos.onDark || pictures.logo;
  const align = layout === "left" ? "left" : "center";
  const x = align === "left" ? M : W / 2;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";

  const drawLogoAt = (ly, lh) => {
    if (!logo) return;
    const lw = (logo.naturalWidth / logo.naturalHeight) * lh;
    ctx.drawImage(logo, align === "left" ? M : W / 2 - lw / 2, ly, lw, lh);
  };

  // The greeting and the line under it.
  const gSize = layout === "left" ? (story ? 190 : 150) : layout === "portrait" ? (story ? 140 : 100) : story ? 150 : 124;
  const g = wrap(ctx, t.greeting, maxW, layout === "left" ? 4 : 3, (s) => `600 ${s}px ${SERIF}`, gSize, 56);
  const gLine = g.size * 1.06;
  const gHeight = gLine * (g.lines.length - 1) + g.size * 0.75;
  const mSize = story ? 44 : 38;
  const m = t.message ? wrap(ctx, t.message, Math.min(maxW, 760), 3, (s) => `400 ${s}px ${SANS}`, mSize, 24) : null;
  const mLine = m ? m.size * 1.4 : 0;
  const mHeight = m ? mLine * (m.lines.length - 1) + m.size * 0.8 : 0;
  const ruleGap = 44;
  const total = gHeight + (m ? ruleGap + 4 + ruleGap + mHeight : 0);

  const photoR = story ? 200 : 96;
  const withPhoto = layout === "portrait" && t.showPhoto && pictures.photo;
  const block = total + (withPhoto ? photoR * 2 + 64 : 0);
  // Centered in the space between the top margin and the sign-off area.
  const free = bottom - top - (t.showSign ? 90 : 0) - (story ? 150 : 120);
  let y = top + Math.max(0, (free - block) / 2) + (withPhoto ? photoR * 2 + 64 : 0);

  if (withPhoto) {
    const cy = y - 64 - photoR;
    const cx = W / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, photoR, 0, Math.PI * 2);
    ctx.clip();
    const img = pictures.photo;
    const s = Math.max((photoR * 2) / img.naturalWidth, (photoR * 2) / img.naturalHeight);
    ctx.drawImage(img, cx - (img.naturalWidth * s) / 2, cy - (img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
    ctx.restore();
    ctx.lineWidth = 6;
    ctx.strokeStyle = ink;
    ctx.beginPath();
    ctx.arc(cx, cy, photoR + 14, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.font = `600 ${g.size}px ${SERIF}`;
  ctx.fillStyle = ink;
  y += g.size * 0.75;
  g.lines.forEach((l, i) => ctx.fillText(l, x, y + i * gLine));
  y += gLine * (g.lines.length - 1);

  if (m) {
    y += ruleGap;
    ctx.fillStyle = post.bg === "#ed2127" ? "#ffffff" : light ? "#ed2127" : "#ffffff";
    ctx.fillRect(align === "left" ? x : x - 60, y, 120, 4);
    y += 4 + ruleGap + m.size * 0.8;
    ctx.font = `400 ${m.size}px ${SANS}`;
    ctx.fillStyle = soft;
    m.lines.forEach((l, i) => ctx.fillText(l, x, y + i * mLine));
  }

  // The logo and the sign-off at the foot of the post.
  let footY = bottom;
  if (t.showSign && t.signoff) {
    ctx.font = `500 ${story ? 32 : 28}px ${SANS}`;
    ctx.fillStyle = soft;
    ctx.fillText(t.signoff, x, footY);
    footY -= 54;
  }
  drawLogoAt(footY - (story ? 100 : 84), story ? 100 : 84);
  ctx.textAlign = "left";
}
