// The private seller-report link that goes in the weekly email (the public page at /report/:token, no sign-in).
//
// Link tokens are only stored as a hash (see supabase/people-module.sql, listing_report_links), so an email can't look an old one up.
// Instead the weekly email's token is derived from the listing: HMAC(server secret, listing id + a counter). The same listing gets the same
// link every week, so the agent can forward it to the seller once and it keeps working. Each send also pushes its expiry a year out, and if
// the agent turned that link off from the dashboard the counter moves on and a fresh one is made.
import crypto from "node:crypto";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");

/** Returns the report token for this listing ({ id, org_id, agent_id }), creating or renewing its link row, or null if it can't be made. */
export async function weeklyReportToken(admin, listing) {
  const secret = process.env.REPORT_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !listing?.id || !listing.org_id) return null;
  for (let n = 0; n < 10; n += 1) {
    const token = `lr${crypto.createHmac("sha256", secret).update(`weekly-report:${listing.id}:${n}`).digest("hex")}`;
    const hash = sha256(token);
    const { data: row } = await admin.from("listing_report_links").select("id, revoked_at").eq("token_hash", hash).maybeSingle();
    if (row?.revoked_at) continue;
    const expires_at = new Date(Date.now() + YEAR_MS).toISOString();
    if (row) {
      await admin.from("listing_report_links").update({ expires_at }).eq("id", row.id);
      return token;
    }
    const { error } = await admin
      .from("listing_report_links")
      .insert({ org_id: listing.org_id, listing_id: listing.id, created_by: listing.agent_id, token_hash: hash, token_hint: token.slice(-4), expires_at });
    return error ? null : token;
  }
  return null;
}
