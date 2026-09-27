// Vercel Routing Middleware — runs before Vercel decides how to route a
// request, which matters specifically because a `vercel.json` rewrite for
// "/" does NOT work: Vercel gives the filesystem (the static index.html
// this build always has at the root) precedence over a rewrite whose
// `source` is the literal root path, regardless of any `has` condition on
// it — see https://github.com/vercel/vercel/discussions/5723. That's why
// this exists instead of a fourth entry in vercel.json's `rewrites`
// alongside the other three (which all target dynamic-segment paths like
// /sites/:slug, none of which collide with a real static file, so they
// don't hit this issue).
//
// Scoped to "/" only (see matcher below) — bots hitting /sites/:slug,
// /listings/:slug, or /sites/:slug/blog/:postSlug are already covered by
// vercel.json's existing rewrites, unaffected by any of this.
import { rewrite, next } from "@vercel/functions";

const BOT_UA_PATTERN =
  /(facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Googlebot|bingbot|Applebot|Pinterest|redditbot|SkypeUriPreview|vkShare|W3C_Validator)/i;

// Custom domains that need a Google Search Console site-verification meta
// tag injected into their real index.html (not the bot-snapshot page,
// which real browsers never see) — the token per domain lives in api/
// meta-custom-domain.js's GOOGLE_SITE_VERIFICATION map, this just decides
// whether to route there. Google's verification checker fetches the raw
// HTML without running JavaScript, and does NOT reliably identify itself
// with a UA this file's BOT_UA_PATTERN would catch (it's a different,
// dedicated Google service from the Googlebot crawler) — so this has to
// intercept the real, non-bot request path too, not just add the tag to
// the bot snapshot. Scoped by exact host on purpose: index.html is one
// shared file across every agent/listing custom domain and the app host
// itself, so injecting a verification tag unconditionally there would
// falsely claim every other site too.
const VERIFIED_HOSTS = new Set(["terrencefinchum.com"]);

export const config = {
  matcher: "/",
};

export default function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_PATTERN.test(userAgent)) {
    return rewrite(new URL("/api/meta-custom-domain", request.url));
  }
  const host = (request.headers.get("host") || "").replace(/^www\./i, "").toLowerCase();
  if (VERIFIED_HOSTS.has(host)) {
    return rewrite(new URL("/api/meta-custom-domain?verify=1", request.url));
  }
  return next();
}
