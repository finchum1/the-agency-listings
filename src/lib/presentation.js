// A listing presentation: the words around a CMA for a listing appointment (a note to the sellers, about the agent, the marketing plan). Pure, shared by the
// CMA editor and the PDF maker (api/_lib/cmaPdf.js). Stored on the CMA as `presentation`:
//   { theme, intro, about, include_net, plan: [{ id, title, detail, on }] }
// `theme` is the look of the PDFs made from this CMA (a key of GUIDE_THEMES in lib/guides.js, or "site" to match the agent's website).

export const MAX_PLAN_ITEMS = 14;

// The marketing plan every presentation starts from; the agent ticks, rewords and adds to it.
export const STARTER_PLAN = [
  { title: "Professional photography", detail: "Bright, edited photos that show the home at its best." },
  { title: "Listed on the MLS", detail: "Your home goes out to the major home-search sites the same day." },
  { title: "A website just for your home", detail: "Its own page with the photos, details and a map, plus a printable flyer." },
  { title: "Social media", detail: "Posted on my channels and the brokerage's, then promoted to nearby buyers." },
  { title: "Open house", detail: "A public open house the first weekend, with a follow-up to everyone who comes." },
  { title: "Email to buyers and agents", detail: "Sent to buyers looking in your price range and the agents who work your area." },
  { title: "Yard sign and lockbox", detail: "So buyers and their agents can see it any time that suits you." },
  { title: "A weekly report", detail: "Online views, showings and feedback, every week, so you always know where you stand." },
].map((p, i) => ({ id: `starter-${i}`, ...p, on: true }));

const text = (v, max) => String(v ?? "").slice(0, max);

/** A presentation with every field present, whatever was stored. */
export function withDefaults(p, { about = "" } = {}) {
  const o = p && typeof p === "object" ? p : {};
  return {
    theme: text(o.theme || "site", 20),
    intro: text(o.intro, 1500),
    about: o.about == null ? text(about, 1500) : text(o.about, 1500),
    include_net: o.include_net !== false,
    plan: Array.isArray(o.plan) && o.plan.length ? o.plan : STARTER_PLAN.map((x) => ({ ...x })),
  };
}

/** What is stored or sent to the PDF: known fields only, capped, blank items dropped. */
export function cleanPresentation(p) {
  const s = withDefaults(p);
  return {
    theme: s.theme,
    intro: s.intro,
    about: s.about,
    include_net: Boolean(s.include_net),
    plan: s.plan
      .slice(0, MAX_PLAN_ITEMS)
      .map((i, n) => ({ id: text(i?.id || `item-${n}`, 40), title: text(i?.title, 80).trim(), detail: text(i?.detail, 240), on: i?.on !== false }))
      .filter((i) => i.title),
  };
}

/** The plan items that go in the document. */
export const planToShow = (p) => cleanPresentation(p).plan.filter((i) => i.on);

const KEY = "presentationAbout";
/** The agent's "about me" from last time, so a new presentation starts with it (saved in this browser only). */
export const savedAbout = () => {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
export const saveAbout = (value) => {
  try {
    localStorage.setItem(KEY, String(value || ""));
  } catch {
    /* private mode: it just doesn't carry over */
  }
};
