// "Start a listing from a link" for the dashboard's New Listing page. Signed-in agents and admins only (the dashboard sends
// the person's own session). It is the same importer the bot API uses (api/_lib/bots/importListing.js): it reads the address
// out of a Zillow / Redfin / Realtor.com link (the page itself is never fetched, Zillow blocks that), looks the home up in the
// office's MLS feed, and, when asked, creates the listing as a DRAFT.
// Kept as its own function, not folded into api/bots.js, because it authenticates with a login session, not a bot token.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { HttpError } from "./_lib/bots/util.js";
import { importListing } from "./_lib/bots/importListing.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const { supabase, user } = auth;

  try {
    const { data: profile } = await supabase.from("profiles").select("id, role, org_id, full_name, email").eq("id", user.id).maybeSingle();
    if (!profile?.org_id) throw new HttpError(403, "Your account isn't part of an organization yet.");
    const isAdmin = profile.role === "admin";
    const body = req.body && typeof req.body === "object" ? { ...req.body } : {};
    // An agent can only make listings for themselves; an admin can pick any agent in their organization.
    if (!isAdmin || !body.agent_id) body.agent_id = user.id;

    const ctx = { client: supabase, admin: serviceClient(), ownerId: user.id, orgId: profile.org_id, profile, scopes: ["listings"], tokenId: null, host: req.headers.host };
    const result = await importListing(ctx, body, req);
    return res.status(result.created ? 201 : 200).json(result);
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error("listing-from-link error:", err);
    return res.status(status).json({ error: status === 500 ? "Something went wrong on our side." : err.message, ...(err instanceof HttpError && err.extra ? err.extra : {}) });
  }
}
