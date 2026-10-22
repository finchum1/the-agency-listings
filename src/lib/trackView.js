import { supabase } from "./supabaseClient";

// Fire-and-forget page-view beacon — never awaited by callers, never
// throws, never delays or blocks rendering. See api/track-view.js.
// `keepalive: true` lets the request finish even if the visitor
// immediately navigates away.
export function trackView(targetType, targetId) {
  if (!targetId) return;
  fetch("/api/track-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
    keepalive: true,
  }).catch(() => {});
}

// ---- A richer visit record for property sites and agent sites ---------------------------------------------------------
// One anonymous id per browser (so "unique visitors" and "returning" mean something) and one per tab session. Neither is
// tied to a person, and no IP address is ever stored.
const randomId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
function storedId(store, key) {
  try {
    let id = store.getItem(key);
    if (!id) {
      id = randomId();
      store.setItem(key, id);
    }
    return id;
  } catch {
    return randomId(); // storage blocked: this visit just counts as its own visitor
  }
}

const SECTION_IDS = {
  listing: ["facts", "overview", "gallery", "features", "location", "contact"],
  agent_site: ["bio", "listings", "areas", "blog", "contact"],
  agent_post: [],
};
const SOCIAL_RE = /(^|\.)(instagram|facebook|linkedin|tiktok|youtube|twitter|x)\.com$|^youtu\.be$/i;
let current = null; // { id, targetType, start, depth, sent: Set }

const post = (payload, { beacon = false } = {}) => {
  const body = JSON.stringify(payload);
  if (beacon && navigator.sendBeacon) {
    navigator.sendBeacon("/api/track-view", new Blob([body], { type: "text/plain" }));
    return;
  }
  fetch("/api/track-view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
};

/** Something a visitor did. Each kind of thing is sent once per page view (per photo / per section / per network). */
export function trackListingEvent(type, detail) {
  if (!current) return;
  const key = `${type}:${detail ?? ""}`;
  if (current.sent.has(key)) return;
  current.sent.add(key);
  post({ kind: "event", viewId: current.id, type, detail: detail == null ? undefined : String(detail) });
}

// Phone, email, social, listing and blog links, and starting a form, recognised from the page itself, so the site's own
// components don't each need to report them.
function onClick(e) {
  const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
  if (!a || !current) return;
  const href = a.getAttribute("href") || "";
  if (href.startsWith("tel:")) return trackListingEvent("phone_click");
  if (href.startsWith("mailto:")) return trackListingEvent("email_click");
  if (current.targetType === "listing") return;
  try {
    const url = new URL(href, window.location.href);
    if (SOCIAL_RE.test(url.hostname)) return trackListingEvent("social_click", url.hostname.replace(/^www\./, "").replace(/\.com$/, ""));
    if (url.origin === window.location.origin) {
      if (/\/listings\/[^/]+/.test(url.pathname) && !/\/sites\/[^/]+\/listings\/?$/.test(url.pathname)) return trackListingEvent("listing_click");
      if (/\/blog\/[^/]+/.test(url.pathname)) return trackListingEvent("blog_click");
    }
  } catch {
    /* not a link we can read */
  }
}
function onFocusIn(e) {
  if (current && e.target instanceof Element && e.target.closest("form")) trackListingEvent("form_start");
}

/**
 * Records a visit to a public page, then keeps watching it: how long they stay, how far down they scroll, and which sections
 * they reach. Visits from someone signed in to the dashboard (an agent previewing their own page) aren't counted, so they
 * don't inflate the numbers. `page` names an agent-site page (home, about, ...). Returns a function that stops watching.
 */
export function startVisit(targetType, targetId, { page } = {}) {
  if (!targetId) return () => {};
  let stopped = false;
  let cleanup = () => {};

  supabase.auth
    .getSession()
    .then(({ data }) => data?.session)
    .catch(() => null)
    .then((session) => {
      if (stopped || session) return;
      const id = randomId();
      const visit = { id, targetType, start: Date.now(), depth: 0, sent: new Set(), active: 0, last: Date.now() };
      current = visit;
      const params = new URLSearchParams(window.location.search);
      const src = params.get("src") || params.get("utm_source") || "";
      let seen = false;
      try {
        seen = sessionStorage.getItem("ag_seen") === "1";
        sessionStorage.setItem("ag_seen", "1");
      } catch {
        /* storage blocked: every page counts as the start of a visit */
      }
      post({
        kind: "view",
        targetType,
        targetId,
        viewId: id,
        page,
        visitorId: storedId(localStorage, "ag_vid"),
        sessionId: storedId(sessionStorage, "ag_sid"),
        src,
        referrer: document.referrer || "",
        cont: seen && !src,
      });

      // Time on page counts only while the tab is showing, so a page left open in a background tab doesn't read as an hour.
      const tick = () => {
        const now = Date.now();
        if (document.visibilityState === "visible") visit.active += now - visit.last;
        visit.last = now;
      };
      const onScroll = () => {
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        if (max > 0) visit.depth = Math.max(visit.depth, Math.min(100, Math.round(((window.scrollY || doc.scrollTop) / max) * 100)));
      };
      const flush = () => {
        tick();
        post({ kind: "end", viewId: visit.id, duration: Math.round(visit.active / 1000), depth: visit.depth }, { beacon: true });
      };
      const onVisibility = () => {
        tick();
        if (document.visibilityState === "hidden") flush();
      };
      window.addEventListener("scroll", onScroll, { passive: true });
      document.addEventListener("visibilitychange", onVisibility);
      window.addEventListener("pagehide", flush);
      document.addEventListener("click", onClick, true);
      document.addEventListener("focusin", onFocusIn);
      const heartbeat = setInterval(() => {
        tick();
        if (visit.active > 0) post({ kind: "end", viewId: visit.id, duration: Math.round(visit.active / 1000), depth: visit.depth }, { beacon: true });
      }, 30000);

      // Which sections of the page they actually reached.
      let observer;
      const watch = setTimeout(() => {
        if (!("IntersectionObserver" in window)) return;
        observer = new IntersectionObserver(
          (entries) =>
            entries.forEach((e) => {
              if (e.isIntersecting) {
                trackListingEvent("section", e.target.id);
                observer.unobserve(e.target);
              }
            }),
          { threshold: 0.3 },
        );
        (SECTION_IDS[targetType] || []).forEach((s) => {
          const el = document.getElementById(s);
          if (el) observer.observe(el);
        });
      }, 1200);

      cleanup = () => {
        clearTimeout(watch);
        clearInterval(heartbeat);
        observer?.disconnect();
        window.removeEventListener("scroll", onScroll);
        document.removeEventListener("visibilitychange", onVisibility);
        window.removeEventListener("pagehide", flush);
        document.removeEventListener("click", onClick, true);
        document.removeEventListener("focusin", onFocusIn);
        flush();
        if (current === visit) current = null;
      };
    });

  return () => {
    stopped = true;
    cleanup();
  };
}

export const startListingVisit = (listingId) => startVisit("listing", listingId);
