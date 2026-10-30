// Scope "monitoring": what is wrong right now, and a way to be told the moment something breaks.
//   GET  /alerts        every property-site domain in the office that isn't responding, as of the last check (every 15 minutes)
//   POST /alerts/check  check the office's domains now (use after fixing something), then return the same list
import { requireScope } from "./context.js";
import { HttpError } from "./util.js";
import { alertView, checkMany, recordHealth } from "../domainCheck.js";

const lastCheck = new Map(); // org id -> time of the last on-demand check
const COOLDOWN_MS = 30000;

async function openAlerts(ctx) {
  const { data: rows } = await ctx.admin.from("domain_health").select("*").eq("org_id", ctx.orgId).neq("status", "ok");
  const ids = (rows || []).map((r) => r.listing_id);
  const { data: listings } = ids.length ? await ctx.admin.from("listings").select("id, address_line1, city, slug, agent:profiles(full_name)").in("id", ids) : { data: [] };
  const byId = new Map((listings || []).map((l) => [l.id, l]));
  return (rows || [])
    .map((r) => alertView(r, byId.get(r.listing_id), r.last_ok_at ? "down" : "setup"))
    .sort((a, b) => (a.severity === b.severity ? String(a.down_since).localeCompare(String(b.down_since)) : a.severity === "down" ? -1 : 1));
}

export async function listAlerts(ctx) {
  requireScope(ctx, "monitoring");
  const { count } = await ctx.admin.from("domain_health").select("listing_id", { count: "exact", head: true }).eq("org_id", ctx.orgId);
  return { alerts: await openAlerts(ctx), domains_monitored: count ?? 0, note: "Updated every 15 minutes. severity 'down' = was working and stopped; 'setup' = has never worked yet." };
}

export async function checkNow(ctx) {
  requireScope(ctx, "monitoring");
  const last = lastCheck.get(ctx.orgId) || 0;
  if (Date.now() - last < COOLDOWN_MS) throw new HttpError(429, "A check was just run. Wait about 30 seconds before running another.");
  lastCheck.set(ctx.orgId, Date.now());
  const { data: rows } = await ctx.admin.from("listings").select("id, org_id, custom_domain").eq("org_id", ctx.orgId).not("custom_domain", "is", null).neq("custom_domain", "").limit(200);
  const checked = await checkMany((rows || []).map((r) => ({ id: r.id, org_id: r.org_id, domain: r.custom_domain })), 10);
  await recordHealth(ctx.admin, checked);
  return { checked: checked.length, alerts: await openAlerts(ctx) };
}
