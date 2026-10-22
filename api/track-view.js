// Vercel serverless function — the visit beacon for the public sites. Called from src/lib/trackView.js, fire-and-forget:
// it never blocks rendering and never surfaces an error to the visitor.
//   POST { targetType, targetId, ... }        records one page view (listing, agent site, blog post, brokerage site)
//   POST { kind: "end", viewId, duration, depth }   adds time on page and how far down they scrolled to that view
//   POST { kind: "event", viewId, type, detail }    records something a buyer did on a listing site (opened the gallery...)
//
// Writes with the service-role key so page_views / listing_events can have NO client-facing write policy at all — every row
// on those tables came from this trusted function, never directly from a browser.
//
// Listing views also carry what the visit looked like: an anonymous per-browser id (no IP address is stored), where it came
// from (a tagged ?src= link or the referring site), the device type, and the city/state Vercel works out from the request.
// Obvious crawlers and link-preview bots are ignored so they don't inflate the numbers.
import { createClient } from "@supabase/supabase-js";

const VALID_TYPES = new Set(["listing", "agent_site", "agent_post", "brokerage_site", "brokerage_post"]);
const EVENT_TYPES = new Set(["gallery_open", "photo_view", "phone_click", "email_click", "form_start", "section"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID_RE = /^[A-Za-z0-9-]{8,64}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|headless|lighthouse|pingdom|uptime|curl|wget|python|java\/|go-http|monitor/i;

const REFERRERS = [
  [/(^|\.)facebook\.com$|^fb\.com$|(^|\.)fb\.me$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\.com$/, "bing"],
  [/(^|\.)duckduckgo\.com$/, "duckduckgo"],
  [/(^|\.)yahoo\.com$/, "yahoo"],
  [/(^|\.)zillow\.com$/, "zillow"],
  [/(^|\.)realtor\.com$/, "realtor.com"],
  [/(^|\.)redfin\.com$/, "redfin"],
  [/(^|\.)trulia\.com$/, "trulia"],
  [/(^|\.)(twitter|x)\.com$|^t\.co$/, "x"],
  [/(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/(^|\.)pinterest\./, "pinterest"],
  [/(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)nextdoor\.com$/, "nextdoor"],
  [/^mail\.google\.com$|(^|\.)outlook\.(live|office)\.com$|(^|\.)mail\.yahoo\.com$/, "email"],
];

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

/** A tagged link (?src=facebook) wins; otherwise guess from the referring site; otherwise "direct". */
function classify(src, referrer, ownHost) {
  const tag = String(src || "").toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 30);
  if (tag) return { source: tag, referrerHost: null };
  const host = hostOf(referrer).replace(/^www\./, "");
  if (!host) return { source: "direct", referrerHost: null };
  if (host === ownHost || host.endsWith(`.${ownHost}`)) return { source: "direct", referrerHost: null };
  for (const [re, name] of REFERRERS) if (re.test(host)) return { source: name, referrerHost: host };
  return { source: "referral", referrerHost: host.slice(0, 80) };
}

function deviceOf(ua) {
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android/i.test(ua)) return "mobile";
  return "desktop";
}

const header = (req, name) => {
  const v = req.headers[name];
  if (!v) return null;
  try {
    return decodeURIComponent(String(v)).slice(0, 80);
  } catch {
    return String(v).slice(0, 80);
  }
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  // sendBeacon can deliver the body as text/plain, so accept a JSON string too.
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const { kind = "view", targetType, targetId, viewId } = body || {};
  const ua = String(req.headers["user-agent"] || "");
  if (BOT_RE.test(ua)) return res.status(200).json({ ok: true });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Analytics should never be able to break a page — fail quietly.
    return res.status(200).json({ ok: false });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  if (kind === "end") {
    if (!UUID_RE.test(viewId || "")) return res.status(400).json({ error: "Invalid viewId." });
    const duration = Math.max(0, Math.min(3600, Math.round(Number(body.duration) || 0)));
    const depth = Math.max(0, Math.min(100, Math.round(Number(body.depth) || 0)));
    // Only a view from the last day, and only ever upward: a later beacon with less time can't shrink what's recorded.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: row } = await supabase.from("page_views").select("duration_sec, max_depth").eq("id", viewId).gte("created_at", since).maybeSingle();
    if (row) {
      await supabase
        .from("page_views")
        .update({ duration_sec: Math.max(row.duration_sec || 0, duration), max_depth: Math.max(row.max_depth || 0, depth) })
        .eq("id", viewId);
    }
    return res.status(200).json({ ok: true });
  }

  if (kind === "event") {
    const type = body.type;
    if (!UUID_RE.test(viewId || "") || !EVENT_TYPES.has(type)) return res.status(400).json({ error: "Invalid event." });
    // The listing comes from the recorded view, not from the caller, so events can't be pointed at an arbitrary listing.
    const { data: view } = await supabase.from("page_views").select("target_id, visitor_id").eq("id", viewId).eq("target_type", "listing").maybeSingle();
    if (!view) return res.status(200).json({ ok: false });
    const { count } = await supabase.from("listing_events").select("*", { count: "exact", head: true }).eq("view_id", viewId);
    if ((count || 0) >= 80) return res.status(200).json({ ok: false });
    const { error } = await supabase
      .from("listing_events")
      .insert({ listing_id: view.target_id, view_id: viewId, visitor_id: view.visitor_id, type, detail: body.detail == null ? null : String(body.detail).slice(0, 60) });
    if (error) console.error("track-view event insert failed:", error);
    return res.status(200).json({ ok: !error });
  }

  if (!VALID_TYPES.has(targetType) || !UUID_RE.test(targetId || "")) {
    return res.status(400).json({ error: "Invalid targetType/targetId." });
  }

  const row = { target_type: targetType, target_id: targetId };
  if (targetType === "listing") {
    const ownHost = String(req.headers.host || "").toLowerCase().replace(/^www\./, "").split(":")[0];
    const { source, referrerHost } = classify(body.src, body.referrer, ownHost);
    Object.assign(row, {
      id: UUID_RE.test(viewId || "") ? viewId : undefined,
      visitor_id: ID_RE.test(body.visitorId || "") ? body.visitorId : null,
      session_id: ID_RE.test(body.sessionId || "") ? body.sessionId : null,
      source,
      referrer_host: referrerHost,
      device: deviceOf(ua),
      country: header(req, "x-vercel-ip-country"),
      region: header(req, "x-vercel-ip-country-region"),
      city: header(req, "x-vercel-ip-city"),
    });
  }
  const { error } = await supabase.from("page_views").insert(row);
  if (error) console.error("track-view insert failed:", error);

  return res.status(200).json({ ok: !error });
}
