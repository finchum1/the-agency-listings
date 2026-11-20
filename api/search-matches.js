// GET /api/search-matches: run by the Vercel cron every morning (vercel.json). For every client search an agent turned "Find new matches daily"
// on for, runs it against the MLS feed and saves homes the search hasn't seen as a batch (client_search_matches) for the agent to review. Then one
// email per agent lists the new matches. Nothing is ever sent to a client from here. The first run of a search only remembers what is on the
// market now (no batch), and the Repliers test account's sample homes are skipped. ?dryRun=1 reports without saving or emailing.
// If CRON_SECRET is set, the call must carry it.
import { serviceClient } from "./_lib/authUser.js";
import { fromAs, sendNotification, viaOrg } from "./_lib/inquiry.js";
import { idxConfigForOrgId } from "./_lib/idxConfig.js";
import { normalizeRepliersListing, searchRepliersListings } from "./_lib/repliers.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const isSample = (l) => /SAMPLE DATA/i.test(l?.description || "") || /\/sample\//.test(l?.hero_photo_url || "");
const MAX_SEEN = 300;
const MAX_SAVED = 12;

/** Homes in `listings` the search hasn't seen, newest first as the feed returned them. */
export const unseen = (listings, seen) => {
  const known = new Set(seen || []);
  return listings.filter((l) => l.mlsNumber && !known.has(l.mlsNumber));
};
const compact = (l) => ({ mlsNumber: l.mlsNumber, address_line1: l.address_line1, city: l.city, state: l.state, zip: l.zip, price: l.price, beds: l.beds, baths: l.baths, sqft: l.sqft, hero_photo_url: l.hero_photo_url, officeName: l.officeName });
const money = (n) => (n == null ? "" : `$${Number(n).toLocaleString("en-US")}`);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const dryRun = req.query?.dryRun === "1";
  const stats = { searches: 0, baselined: 0, batches: 0, homes: 0, skipped: 0, sampleOnly: 0, emailed: 0 };

  const { data: rows, error } = await admin.from("client_searches").select("id, owner_id, org_id, person_id, name, params, seen_mls, last_checked_at").eq("alerts", true).order("created_at").limit(500);
  if (error) {
    console.error("Client search query failed:", error);
    return res.status(500).json({ error: "Couldn't read the searches." });
  }

  const configs = new Map();
  const configFor = async (orgId) => {
    if (!configs.has(orgId)) configs.set(orgId, await idxConfigForOrgId(admin, orgId).catch(() => null));
    return configs.get(orgId);
  };
  const byAgent = new Map(); // agent id -> [{ search, batch }]
  for (const row of rows || []) {
    stats.searches += 1;
    const config = await configFor(row.org_id);
    const p = row.params || {};
    if (!config || (p.office === "true" && !config.officeName)) {
      stats.skipped += 1;
      continue;
    }
    let listings;
    try {
      const data = await searchRepliersListings(config, {
        city: p.city, minPrice: p.minPrice, maxPrice: p.maxPrice, minBedrooms: p.minBeds, minBaths: p.minBaths,
        status: "A", pageNum: 1, resultsPerPage: 24, sortBy: "createdOnDesc",
        brokerage: p.office === "true" ? config.officeName : undefined, map: p.map || undefined,
      });
      listings = (data.listings || []).map(normalizeRepliersListing).filter(Boolean);
    } catch (err) {
      console.error("Client search failed:", row.id, err.message);
      stats.skipped += 1;
      continue;
    }
    const real = listings.filter((l) => !isSample(l));
    if (listings.length && !real.length) {
      stats.sampleOnly += 1;
      continue;
    }
    const now = new Date().toISOString();
    const first = !row.last_checked_at && !(row.seen_mls || []).length;
    const fresh = first ? [] : unseen(real, row.seen_mls);
    if (first) stats.baselined += 1;
    if (!dryRun) {
      const seen = [...fresh.map((l) => l.mlsNumber), ...(first ? real.map((l) => l.mlsNumber) : []), ...(row.seen_mls || [])];
      await admin.from("client_searches").update({ seen_mls: [...new Set(seen)].slice(0, MAX_SEEN), last_checked_at: now }).eq("id", row.id);
    }
    if (!fresh.length) continue;
    stats.batches += 1;
    stats.homes += fresh.length;
    const batch = { search_id: row.id, owner_id: row.owner_id, listings: fresh.slice(0, MAX_SAVED).map(compact), total: fresh.length };
    if (!dryRun) {
      const { error: insertError } = await admin.from("client_search_matches").insert(batch);
      if (insertError) {
        console.error("Match batch insert failed:", row.id, insertError);
        continue;
      }
    }
    byAgent.set(row.owner_id, [...(byAgent.get(row.owner_id) || []), { search: row, batch }]);
  }

  // One email per agent listing what was found. The agent decides what goes to the client.
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey && !dryRun) {
    for (const [agentId, found] of byAgent) {
      try {
        const [{ data: agent }, personRows] = await Promise.all([
          admin.from("profiles").select("full_name, email, org:organizations(name)").eq("id", agentId).maybeSingle(),
          (async () => {
            const ids = [...new Set(found.map((f) => f.search.person_id).filter(Boolean))];
            return ids.length ? (await admin.from("people").select("id, name").in("id", ids)).data || [] : [];
          })(),
        ]);
        if (!agent?.email) continue;
        const names = new Map(personRows.map((p) => [p.id, p.name]));
        const total = found.reduce((n, f) => n + f.batch.total, 0);
        const url = `${SITE_ORIGIN}/dashboard/search?matches=1`;
        const title = (f) => [names.get(f.search.person_id), f.search.name].filter(Boolean).join(": ");
        const subject = `${total} new home${total === 1 ? "" : "s"} for your client searches`;
        const text = [
          `Hi ${agent.full_name?.split(" ")[0] || "there"},`,
          "",
          "New homes matched your saved client searches. Nothing has been sent to your clients.",
          ...found.flatMap((f) => ["", `${title(f)} (${f.batch.total})`, ...f.batch.listings.slice(0, 5).map((h) => `  - ${[money(h.price), h.address_line1, h.city].filter(Boolean).join(", ")}`)]),
          "",
          `Review and send: ${url}`,
        ].join("\n");
        const block = (f) =>
          `<tr><td style="padding:0 6px 10px"><div style="background:#fff;border:1px solid #e4dfd3;border-radius:14px;padding:14px 18px"><div style="font:600 16px Georgia,serif;color:#1c1a17">${esc(title(f))} <span style="font:13px Arial,sans-serif;color:#7a756b">${f.batch.total} new</span></div>${f.batch.listings.slice(0, 5).map((h) => `<div style="font:14px/1.6 Arial,sans-serif;color:#1c1a17;padding:2px 0">${esc([money(h.price), h.address_line1, h.city].filter(Boolean).join(", "))}</div>`).join("")}</div></td></tr>`;
        const html = `<!doctype html><html><body style="margin:0;background:#f7f4ee"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" style="max-width:600px;width:100%"><tr><td style="padding:0 6px 14px"><div style="font:600 11px Arial,sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#d3181d">Client searches</div><div style="margin-top:6px;font:600 24px Georgia,serif;color:#1c1a17">${esc(subject)}</div><div style="margin-top:6px;font:14px Arial,sans-serif;color:#7a756b">Nothing has been sent to your clients.</div></td></tr>${found.map(block).join("")}<tr><td style="padding:14px 6px"><a href="${esc(url)}" style="display:inline-block;background:#1c1a17;color:#fff;text-decoration:none;font:600 14px Arial,sans-serif;padding:13px 22px;border-radius:999px">Review and send</a></td></tr></table></td></tr></table></body></html>`;
        const ok = await sendNotification(apiKey, { from: fromAs(viaOrg("", agent.org?.name), "Home Search", "alerts"), to: [agent.email], subject, text, html });
        if (ok) stats.emailed += 1;
      } catch (err) {
        console.error("Client search email failed for", agentId, err);
      }
    }
  }
  return res.status(200).json({ ok: true, dryRun, ...stats });
}
