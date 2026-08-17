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

export const config = {
  matcher: "/",
};

export default function middleware(request) {
  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_PATTERN.test(userAgent)) {
    return rewrite(new URL("/api/meta-custom-domain", request.url));
  }
  return next();
}
