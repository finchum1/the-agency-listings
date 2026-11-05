// Sending a newsletter (see supabase/newsletters.sql and src/lib/newsletterHtml.js, which builds the email itself).
//   resolveAudience  who a newsletter goes to: this agent's own contacts in the chosen relationships, never archived or do-not-contact, never an address
//                    that has unsubscribed from this agent, each address once.
//   startSending     turns the audience into one queued row per person and marks the newsletter "sending".
//   dispatch         sends the queued rows, 100 to a request, claiming rows first so two runs never send the same one.
//   runNewsletters   what the schedule does every few minutes: starts newsletters whose time has come and keeps sending the ones in progress.
import crypto from "node:crypto";
import { SITE_ORIGIN } from "../../src/lib/seo.js";
import { brandFromOrg } from "../../src/lib/brand.js";
import { listingCardData, postCardData, renderNewsletter } from "../../src/lib/newsletterHtml.js";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
export const MAX_RECIPIENTS = 2000;
const BATCH = 100;

const secret = () => process.env.NEWSLETTER_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sign = (token, url) => crypto.createHmac("sha256", secret()).update(`${token}|${url}`).digest("hex").slice(0, 24);
export const checkSignature = (token, url, sig) => {
  const want = sign(token, url);
  return typeof sig === "string" && sig.length === want.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want));
};

/**
 * Who a newsletter says it is from: the agent's name on an address made for newsletters (NEWSLETTER_FROM_EMAIL if it is set; otherwise "news@" on the same
 * domain the app already sends from, which is verified with the email service). It is not the website-inquiry address. Replies go to the agent (reply_to).
 */
export function newsletterFrom(agentName, orgName) {
  const configured = process.env.NEWSLETTER_FROM_EMAIL || "";
  const bare = (v) => ((String(v).match(/<([^>]+)>/) || [])[1] || String(v)).trim();
  let address = configured ? bare(configured) : "";
  if (!address) {
    const domain = bare(process.env.LEAD_FROM_EMAIL || "").split("@")[1];
    address = domain ? `news@${domain}` : "onboarding@resend.dev";
  }
  const name = String(agentName || orgName || "The Agency").replace(/["<>\r\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return `${name} <${address}>`;
}

/** The links one recipient's copy carries: the open pixel, how a block link is wrapped for click tracking, and the unsubscribe links. */
function linksFor(token, track) {
  return {
    pixelUrl: track ? `${SITE_ORIGIN}/api/newsletter-track?t=${token}&k=o` : "",
    // web links are wrapped so a click can be counted; mail and phone links go straight through
    wrap: (url) => (track && /^https?:\/\//i.test(url) ? `${SITE_ORIGIN}/api/newsletter-track?t=${token}&k=c&u=${encodeURIComponent(url)}&s=${sign(token, url)}` : url),
    unsubscribeUrl: `${SITE_ORIGIN}/unsubscribe/${token}`,
    oneClickUrl: `${SITE_ORIGIN}/api/newsletter-unsubscribe?token=${token}`,
  };
}

/** Everything the email needs that is not in the newsletter row: the agent, the brokerage, their website address, and the listings and posts the blocks use. */
export async function loadContext(admin, newsletter) {
  const [{ data: agent }, { data: site }] = await Promise.all([
    admin.from("profiles").select("full_name, title, phone, email, license, photo_url, org:organizations(*)").eq("id", newsletter.owner_id).maybeSingle(),
    admin.from("agent_sites").select("id, slug, custom_domain, instagram_url, facebook_url, linkedin_url, tiktok_url, youtube_url, x_url").eq("agent_id", newsletter.owner_id).maybeSingle(),
  ]);
  const siteBase = site ? (site.custom_domain ? `https://${site.custom_domain}` : `${SITE_ORIGIN}/sites/${site.slug}`) : "";
  const brand = brandFromOrg(agent?.org);
  const abs = (u) => (u && u.startsWith("/") ? `${SITE_ORIGIN}${u}` : u || "");
  const blocks = Array.isArray(newsletter.blocks) ? newsletter.blocks : [];
  const listingIds = [...new Set(blocks.filter((b) => b.type === "listing" || b.type === "openhouse").map((b) => b.listingId).filter(Boolean))];
  const postIds = [...new Set(blocks.filter((b) => b.type === "post").map((b) => b.postId).filter(Boolean))];

  const listings = {};
  if (listingIds.length) {
    const [{ data: rows }, { data: photos }, { data: houses }] = await Promise.all([
      admin.from("listings").select("*").in("id", listingIds).eq("agent_id", newsletter.owner_id),
      admin.from("listing_photos").select("listing_id, url, is_hero, sort_order").in("listing_id", listingIds).order("sort_order"),
      admin.from("open_houses").select("listing_id, starts_at, ends_at").in("listing_id", listingIds).order("starts_at"),
    ]);
    for (const l of rows || []) {
      const mine = (photos || []).filter((p) => p.listing_id === l.id);
      const photo = (mine.find((p) => p.is_hero) || mine[0])?.url || "";
      listings[l.id] = listingCardData(l, { photoUrl: photo, openHouses: (houses || []).filter((h) => h.listing_id === l.id), origin: SITE_ORIGIN, siteBase });
    }
  }
  const posts = {};
  if (postIds.length && site) {
    const { data: rows } = await admin.from("agent_site_posts").select("*").in("id", postIds).eq("agent_site_id", site.id);
    for (const p of rows || []) posts[p.id] = postCardData(p, { siteBase });
  }

  return {
    agentRow: agent,
    agent: {
      name: agent?.full_name || "",
      title: agent?.title || "",
      phone: agent?.phone || "",
      email: agent?.email || "",
      license: agent?.license || "",
      photo: agent?.photo_url || "",
      contactUrl: siteBase ? `${siteBase}/contact` : "",
      social: { instagram: site?.instagram_url, facebook: site?.facebook_url, linkedin: site?.linkedin_url, youtube: site?.youtube_url, tiktok: site?.tiktok_url, x: site?.x_url },
    },
    brand: { name: brand.name, logo: abs(brand.logos?.red || brand.logo), address: brand.address, disclaimer: brand.disclaimer, franchiseDisclaimer: brand.franchiseDisclaimer },
    listings,
    posts,
  };
}

/** The email for one recipient, ready to hand to the email service. */
export function buildEmail(ctx, newsletter, { token, first, to, test = false }) {
  const links = linksFor(token, newsletter.track && !test);
  const { subject, html, text } = renderNewsletter({
    newsletter,
    agent: ctx.agent,
    brand: ctx.brand,
    listings: ctx.listings,
    posts: ctx.posts,
    recipient: { first, unsubscribeUrl: test ? "#" : links.unsubscribeUrl, pixelUrl: links.pixelUrl },
    wrap: links.wrap,
  });
  return {
    from: newsletterFrom(ctx.agent.name, ctx.agentRow?.org?.name),
    to: [to],
    ...(ctx.agent.email ? { reply_to: ctx.agent.email } : {}),
    subject: test ? `[Test] ${subject}` : subject,
    html,
    text,
    ...(test ? {} : { headers: { "List-Unsubscribe": `<${links.oneClickUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }),
  };
}

/** Who a newsletter would go to right now: [{ contact_id, email, first_name }]. */
export async function resolveAudience(admin, ownerId, audience) {
  const relationships = Array.isArray(audience?.relationships) && audience.relationships.length ? audience.relationships : ["client", "past_client", "sphere"];
  let taggedIds = null;
  if (audience?.tag_id) {
    const { data } = await admin.from("contact_tag_links").select("contact_id").eq("tag_id", audience.tag_id).eq("owner_id", ownerId);
    taggedIds = new Set((data || []).map((r) => r.contact_id));
  }
  const { data: optouts } = await admin.from("newsletter_optouts").select("email").eq("owner_id", ownerId);
  const out = new Set((optouts || []).map((o) => o.email));

  const people = [];
  const seen = new Set();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("contacts")
      .select("id, first_name, email, relationship")
      .eq("owner_id", ownerId)
      .eq("archived", false)
      .eq("do_not_contact", false)
      .neq("email", "")
      .in("relationship", relationships)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    for (const c of data || []) {
      const email = String(c.email || "").trim().toLowerCase();
      if (!EMAIL_RE.test(email) || out.has(email) || seen.has(email)) continue;
      if (taggedIds && !taggedIds.has(c.id)) continue;
      seen.add(email);
      people.push({ contact_id: c.id, email, first_name: String(c.first_name || "").trim() });
    }
    if (!data || data.length < 1000) break;
  }
  return people;
}

/** Queues one row per recipient and marks the newsletter as sending. Returns how many people it will go to. */
export async function startSending(admin, newsletter) {
  const people = await resolveAudience(admin, newsletter.owner_id, newsletter.audience);
  if (people.length === 0) throw new Error("There is nobody to send this to. Check who it goes to.");
  if (people.length > MAX_RECIPIENTS) throw new Error(`That is ${people.length} people. A single newsletter can go to ${MAX_RECIPIENTS}; narrow who it goes to.`);
  // Claim the newsletter first so a double click or a second run cannot queue everyone twice.
  const { data: claimed } = await admin
    .from("newsletters")
    .update({ status: "sending", started_at: new Date().toISOString(), recipient_count: people.length })
    .eq("id", newsletter.id)
    .in("status", ["draft", "scheduled"])
    .select("id");
  if (!claimed?.length) throw new Error("That newsletter is already on its way.");
  const rows = people.map((p) => ({ ...p, newsletter_id: newsletter.id, owner_id: newsletter.owner_id, token: crypto.randomBytes(16).toString("hex") }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from("newsletter_sends").insert(rows.slice(i, i + 500));
    if (error) {
      await admin.from("newsletters").update({ status: "draft", recipient_count: 0 }).eq("id", newsletter.id);
      await admin.from("newsletter_sends").delete().eq("newsletter_id", newsletter.id);
      throw new Error("Couldn't queue the emails. Nothing was sent.");
    }
  }
  return people.length;
}

async function resendBatch(apiKey, emails) {
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "x-batch-validation": "permissive" },
    body: JSON.stringify(emails),
  });
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, json, status: res.status };
}

/** Sends up to `limit` queued emails of one newsletter. Returns how many went out and how many failed. */
export async function dispatch(admin, newsletter, ctx, { limit = 200, deadline = Infinity } = {}) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email isn't set up, so nothing was sent.");
  let sent = 0;
  let failed = 0;
  while (sent + failed < limit && Date.now() < deadline) {
    const { data: queued } = await admin.from("newsletter_sends").select("id").eq("newsletter_id", newsletter.id).eq("status", "queued").limit(Math.min(BATCH, limit - sent - failed));
    if (!queued?.length) break;
    // Claim these rows: only the ones this run flips from queued to sending are its own.
    const { data: mine } = await admin.from("newsletter_sends").update({ status: "sending" }).in("id", queued.map((q) => q.id)).eq("status", "queued").select("id, email, first_name, token");
    if (!mine?.length) continue;
    const { ok, json, status } = await resendBatch(apiKey, mine.map((m) => buildEmail(ctx, newsletter, { token: m.token, first: m.first_name, to: m.email })));
    const now = new Date().toISOString();
    if (!ok && !Array.isArray(json?.data)) {
      const why = String(json?.message || `The email service refused it (${status}).`).slice(0, 300);
      await admin.from("newsletter_sends").update({ status: "failed", error: why }).in("id", mine.map((m) => m.id));
      failed += mine.length;
      if (status === 401 || status === 403 || status === 429) break; // no point trying again right now
      continue;
    }
    const errors = new Map((json.errors || []).map((e) => [e.index, e.message]));
    for (let i = 0; i < mine.length; i++) {
      const id = json.data?.[i]?.id;
      if (errors.has(i) || !id) {
        failed++;
        await admin.from("newsletter_sends").update({ status: "failed", error: String(errors.get(i) || "Not accepted").slice(0, 300) }).eq("id", mine[i].id);
      } else {
        sent++;
        await admin.from("newsletter_sends").update({ status: "sent", provider_id: id, sent_at: now }).eq("id", mine[i].id);
      }
    }
  }
  const { count } = await admin.from("newsletter_sends").select("id", { count: "exact", head: true }).eq("newsletter_id", newsletter.id).in("status", ["queued", "sending"]);
  if (!count) await admin.from("newsletters").update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", newsletter.id).eq("status", "sending");
  return { sent, failed, left: count || 0 };
}

/** The schedule: start what is due, keep sending what is in progress. Stops before the function's time runs out. */
export async function runNewsletters(admin, { budgetMs = 40000 } = {}) {
  const deadline = Date.now() + budgetMs;
  const results = [];
  const { data: due } = await admin.from("newsletters").select("*").eq("status", "scheduled").lte("scheduled_at", new Date().toISOString());
  for (const n of due || []) {
    try {
      await startSending(admin, n);
    } catch (err) {
      results.push({ id: n.id, error: err.message });
      // A scheduled newsletter that cannot start goes back to a draft so the agent sees it did not go.
      await admin.from("newsletters").update({ status: "draft", scheduled_at: null }).eq("id", n.id).eq("status", "scheduled");
    }
  }
  const { data: going } = await admin.from("newsletters").select("*").eq("status", "sending");
  for (const n of going || []) {
    if (Date.now() >= deadline) break;
    try {
      results.push({ id: n.id, ...(await dispatch(admin, n, await loadContext(admin, n), { limit: 1000, deadline })) });
    } catch (err) {
      results.push({ id: n.id, error: err.message });
    }
  }
  return results;
}
