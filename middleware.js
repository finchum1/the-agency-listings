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
// It now sees every page navigation (see matcher below), so each branch
// returns next() immediately unless it has a specific job: the marketing
// host's pages, a custom domain's redirects, or a custom domain's root
// (bot snapshot / Search Console tag). Bots hitting /sites/:slug,
// /listings/:slug, or /sites/:slug/blog/:postSlug on the dashboard's own
// host are still covered by vercel.json's rewrites, unaffected by this.
import { rewrite, next } from "@vercel/functions";
import { matchRedirect } from "./src/lib/redirectMatch.js";

const BOT_UA_PATTERN =
  /(facebookexternalhit|Facebot|Twitterbot|Slackbot|LinkedInBot|WhatsApp|TelegramBot|Discordbot|Googlebot|bingbot|Applebot|Pinterest|redditbot|SkypeUriPreview|vkShare|W3C_Validator|GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|DuckAssistBot|Amazonbot|CCBot|Meta-ExternalAgent|cohere-ai|MistralAI-User)/i;

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

// The marketing-only host (theagency.latchpointstudios.com — see
// src/lib/appHosts.js) serves a handful of static product pages. For
// every visitor on that host (not just bots) these paths are answered by
// api/meta-custom-domain.js's ?marketing= branch, which returns the real
// index.html with that page's own <title>, description, social tags and a
// short text fallback filled in — so crawlers that don't run JavaScript
// (most AI crawlers) see real page content instead of a blank shell.
const MARKETING_HOST = "theagency.latchpointstudios.com";
const MARKETING_PATHS = new Set(["/", "/brokerage-website", "/agent-websites", "/property-websites", "/people", "/upcoming"]);

// Page navigations only — anything with a file extension (assets, icons,
// robots.txt, sitemap.xml, the manifest) and /api/* are skipped, so this
// never adds work to an image or script request.
export const config = {
  matcher: ["/((?!api/|assets/|.*\\..*).*)"],
};

// Per-site redirects (the dashboard's Redirects page -> site_redirects):
// on an agent's own custom domain, an old address is answered with a
// permanent 301 here, before anything renders. Rules are read with the
// public anon key and cached per host for a minute per server instance,
// so most requests cost nothing; if the lookup ever fails the request
// just continues (a redirect is never worth taking a site down for).
const RULES_TTL_MS = 60_000;
const rulesCache = new Map();

async function loadRules(host) {
  const cached = rulesCache.get(host);
  if (cached && Date.now() - cached.at < RULES_TTL_MS) return cached.rules;
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return [];
  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/site_redirects?select=from_path,to_path,agent_sites!inner(custom_domain)&agent_sites.custom_domain=eq.${encodeURIComponent(host)}`,
      { headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, signal: AbortSignal.timeout(1500) },
    );
    if (!res.ok) throw new Error(`redirect lookup ${res.status}`);
    const rules = (await res.json()).map((r) => ({ from_path: r.from_path, to_path: r.to_path }));
    rulesCache.set(host, { at: Date.now(), rules });
    return rules;
  } catch {
    return cached?.rules || [];
  }
}

function isDashboardHost(host) {
  return host === "localhost" || host.endsWith(".vercel.app");
}

export default async function middleware(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const hostname = (request.headers.get("host") || "").replace(/^www\./i, "").toLowerCase();

  if (hostname === MARKETING_HOST) {
    if (MARKETING_PATHS.has(pathname)) {
      return rewrite(new URL(`/api/meta-custom-domain?marketing=${encodeURIComponent(pathname)}`, request.url));
    }
    return next();
  }

  // The dashboard's own host has no redirects and no root special-casing.
  if (isDashboardHost(hostname)) return next();

  // Anything else is an agent's own custom domain.
  const target = matchRedirect(pathname, await loadRules(hostname));
  if (target) {
    const destination = new URL(target, request.url);
    if (!target.includes("?")) destination.search = url.search;
    return Response.redirect(destination, 301);
  }

  // Beyond redirects, this middleware only ever special-cased the root.
  if (pathname !== "/") return next();

  const userAgent = request.headers.get("user-agent") || "";
  if (BOT_UA_PATTERN.test(userAgent)) {
    return rewrite(new URL("/api/meta-custom-domain", request.url));
  }
  if (VERIFIED_HOSTS.has(hostname)) {
    return rewrite(new URL("/api/meta-custom-domain?verify=1", request.url));
  }
  return next();
}
