// Which IDX (Repliers) account does this request use? Each organization brings its own: the secret lives in
// org_settings.idx_config ({ api_key, board_id, office_name }), which only the service role can read (see
// multi-tenant-1g-idx-settings.sql). Server-only: never imported by client code.
//
// The organization comes from the request host (a registered custom or dashboard domain is that organization). On the
// platform's own hosts the caller may name one with ?org=<slug> (the dashboard does, for the organization it is
// working in), else it is the default organization. Only the default organization (The Agency) may fall back to the
// REPLIERS_* environment variables, so one organization can never end up searching with another's account.
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_ORG_SLUG } from "../../src/lib/brand.js";
import { bareHost, isAppHost } from "../../src/lib/appHosts.js";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

function envConfig() {
  return {
    apiKey: process.env.REPLIERS_API_KEY || "",
    boardId: process.env.REPLIERS_BOARD_ID || "",
    officeName: process.env.REPLIERS_BROKERAGE_NAME || "The Agency",
  };
}

/** @returns {Promise<{apiKey: string, boardId: string, officeName: string} | null>} null when this organization has no IDX. */
export async function resolveIdxConfig(req) {
  const url = process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  // No way to look organizations up (local development without the service key): behave as the single-organization app did.
  if (!url || !serviceKey) return envConfig().apiKey ? envConfig() : null;

  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const host = bareHost(String(req.headers["x-forwarded-host"] || req.headers.host || ""));

  let orgId = null;
  let slug = DEFAULT_ORG_SLUG;
  if (host && !isAppHost(host)) {
    const { data } = await supabase.from("org_domains").select("org_id").eq("domain", host).maybeSingle();
    if (!data) return null; // a host nobody registered
    orgId = data.org_id;
  } else if (typeof req.query?.org === "string" && SLUG.test(req.query.org)) {
    slug = req.query.org;
  }

  const orgQuery = supabase.from("organizations").select("id, slug, status");
  const { data: org } = await (orgId ? orgQuery.eq("id", orgId) : orgQuery.eq("slug", slug)).maybeSingle();
  if (!org || org.status !== "active") return null;

  const { data: settings } = await supabase.from("org_settings").select("features, idx_config").eq("org_id", org.id).maybeSingle();
  if (!settings?.features?.idx_allowed) return null;

  const own = settings.idx_config || {};
  const fallback = org.slug === DEFAULT_ORG_SLUG ? envConfig() : { apiKey: "", boardId: "", officeName: "" };
  const config = {
    apiKey: own.api_key || fallback.apiKey,
    boardId: own.board_id || fallback.boardId,
    officeName: own.office_name || fallback.officeName,
  };
  return config.apiKey ? config : null;
}
