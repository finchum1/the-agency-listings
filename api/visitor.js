// Vercel serverless function: visitor accounts for the public Home Search (IDX). One file for every action (?a=...), so it stays one function.
//
// A visitor signs in with an emailed 6-digit code (no password) on an agent's site or the brokerage site, and can then save homes, save searches and get a
// daily email of new matches. Visitors are rows in site_visitors (supabase/site-visitors.sql), NOT Supabase auth users: public sign-up on that project stays
// off. This server issues its own session tokens (kept hashed), so nothing here is readable or writable from the browser except through these actions.
//
//   POST ?a=request_code   {site, email, name?}        emails a code (10 minutes). Always answers the same, whether or not the address has an account.
//   POST ?a=verify         {site, email, code, name?}  signs in: {token, account}. A visitor's FIRST sign-in files them as a lead with the site's owner.
//   GET  ?a=me                                          the signed-in visitor's account (saved homes and searches)
//   POST ?a=favorite       {mls, on, snapshot?}         save or unsave a home           POST ?a=favorites_merge {mls: [..]}  adds homes saved before signing in
//   POST ?a=search_save    {name?, params, path?, alerts?}   POST ?a=search_update {id, name?, alerts?}   POST ?a=search_delete {id}
//   POST ?a=profile        {name?, phone?}              POST ?a=logout                    POST ?a=delete_account
//   GET  ?a=unsubscribe&t=...                           the link in alert emails; turns a visitor's alerts off
//   GET  ?a=cron_alerts                                 daily: emails each visitor the homes that are new for their saved searches (carries CRON_SECRET when set)
//
// `site` is {kind: "agent", id} or {kind: "brokerage"}; see api/_lib/visitors.js for how it is resolved (never trusted for ownership).
import { createClient } from "@supabase/supabase-js";
import { fromAs, sendNotification, findExistingPerson, describePerson, leadAlertContext, renderLeadEmailHtml } from "./_lib/inquiry.js";
import { respondToNewLead } from "./_lib/leadResponse.js";
import { idxConfigForOrgId } from "./_lib/idxConfig.js";
import { searchRepliersListings, normalizeRepliersListing } from "./_lib/repliers.js";
import { SITE_ORIGIN } from "../src/lib/seo.js";
import {
  EMAIL,
  alertEmail,
  cleanEmail,
  cleanSearchParams,
  cleanSnapshot,
  cleanText,
  clientIp,
  codeEmail,
  describeSearch,
  hmac,
  newCode,
  newToken,
  pageUrlFor,
  readUnsubscribeToken,
  resolveSite,
  safeEqual,
  unsubscribeToken,
} from "./_lib/visitors.js";

const MINUTE = 60 * 1000;
const CODE_MINUTES = 10;
const SESSION_DAYS = 60;
const MAX_FAVORITES = 500;
const MAX_SEARCHES = 20;
const MLS = /^[A-Za-z0-9_-]{3,40}$/;
const iso = (ms) => new Date(ms).toISOString();
// Listing data courtesy line for alert emails. Replace with the MLS's own required wording once the board and its display rules are confirmed.
const DISCLAIMER = "Listing information is provided by the MLS and is deemed reliable but not guaranteed.";

const bad = (res, code, message) => res.status(code).json({ error: message });

function adminClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

const siteColumnOf = (v) => (v.agent_site_id ? { kind: "agent", id: v.agent_site_id } : { kind: "brokerage" });

/** The signed-in visitor for this request, or null. */
async function signedIn(admin, req) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || token.length > 100) return null;
  const { data } = await admin
    .from("visitor_sessions")
    .select("expires_at, last_seen_at, visitor:site_visitors(id, email, name, phone, agent_site_id, org_id, unsubscribed_at)")
    .eq("token_hash", hmac(token))
    .maybeSingle();
  if (!data?.visitor || new Date(data.expires_at).getTime() < Date.now()) return null;
  if (Date.now() - new Date(data.last_seen_at).getTime() > 60 * MINUTE) {
    await admin.from("visitor_sessions").update({ last_seen_at: iso(Date.now()) }).eq("token_hash", hmac(token));
  }
  return { visitor: data.visitor, tokenHash: hmac(token) };
}

/** Everything the browser needs to show a visitor's account. */
async function accountFor(admin, v) {
  const [{ data: favs }, { data: searches }] = await Promise.all([
    admin.from("visitor_favorites").select("mls_number, snapshot, created_at").eq("visitor_id", v.id).order("created_at", { ascending: false }).limit(MAX_FAVORITES),
    admin.from("visitor_saved_searches").select("id, name, params, page_url, alerts, created_at").eq("visitor_id", v.id).order("created_at", { ascending: false }).limit(MAX_SEARCHES),
  ]);
  return {
    visitor: { email: v.email, name: v.name || "", phone: v.phone || "", emailsOff: !!v.unsubscribed_at },
    favorites: (favs || []).map((f) => ({ mls: f.mls_number, snapshot: f.snapshot || {} })),
    searches: (searches || []).map((s) => ({ id: s.id, name: s.name, params: s.params || {}, pageUrl: s.page_url || "", alerts: !!s.alerts })),
  };
}

// The first time someone signs in on a site they become that site's lead: in the agent's Leads (the speed-to-lead plans run as for any new lead) with an
// email to the agent, or an email to the brokerage's contact address. Never allowed to break the sign-in itself.
async function fileNewVisitor(admin, site, visitor) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    const name = visitor.name || visitor.email.split("@")[0];
    const fromEmail = process.env.LEAD_FROM_EMAIL || "Site Inquiries <onboarding@resend.dev>";
    const message = "Signed up for Home Search on your website. They can now save homes and searches here.";
    if (site.kind === "agent") {
      const existing = await findExistingPerson(admin, site.agentId, visitor.email);
      const { error } = await admin.from("leads").insert({ target_type: "agent_site", target_id: site.agentSiteId, agent_id: site.agentId, name, email: visitor.email, phone: "", message, page: "home_search", address: "" });
      if (error) console.error("Visitor lead insert failed:", error);
      if (!apiKey) return;
      const alert = await leadAlertContext(admin, site.agentId, site.notifyEmail);
      const reply = await respondToNewLead(admin, { agentId: site.agentId, agentName: site.agent.full_name, lead: { name, email: visitor.email, phone: "" } });
      if (reply.dashboardUrl) alert.dashboardUrl = reply.dashboardUrl;
      const notice = existing ? `Already in your People: ${describePerson(existing)}` : "";
      await sendNotification(apiKey, {
        from: fromEmail,
        to: alert.to,
        replyTo: visitor.email,
        subject: `${existing ? "Repeat" : "New"} Home Search sign-up from ${name}`,
        text: [...(notice ? [notice, ""] : []), `Name: ${name}`, `Email: ${visitor.email}`, "", message, "", ...(reply.actions.length ? ["Reply now:", ...reply.actions.map((a) => `${a.label}: ${a.href}`), ""] : []), `Open in your dashboard: ${alert.dashboardUrl}`].join("\n"),
        html: renderLeadEmailHtml({ heading: `${existing ? "Repeat" : "New"} Home Search sign-up from ${name}`, agentName: site.agent.full_name, notice, fields: [["Name", name], ["Email", visitor.email]], message, dashboardUrl: alert.dashboardUrl, actions: reply.actions }),
      });
    } else if (apiKey && site.notifyEmail) {
      await sendNotification(apiKey, {
        from: fromEmail,
        to: site.notifyEmail,
        replyTo: visitor.email,
        subject: `New Home Search sign-up from ${name}`,
        text: `Name: ${name}\nEmail: ${visitor.email}\n\n${message}`,
      });
    }
  } catch (err) {
    console.error("Filing a new visitor failed:", err);
  }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const admin = adminClient();
  if (!admin) return bad(res, 500, "Not configured.");
  const a = String(req.query?.a || "");
  const body = req.body && typeof req.body === "object" ? req.body : {};

  try {
    // ------------------------------------------------------------------ the link in alert emails
    if (req.method === "GET" && a === "unsubscribe") {
      const id = readUnsubscribeToken(req.query?.t);
      if (id) await admin.from("site_visitors").update({ unsubscribed_at: iso(Date.now()) }).eq("id", id);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(id ? 200 : 400).send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:Helvetica,Arial,sans-serif;max-width:460px;margin:15vh auto;padding:0 20px;color:#14130f"><h1 style="font-size:22px">${id ? "You're unsubscribed" : "That link didn't work"}</h1><p style="color:#6b665a;line-height:1.5">${id ? "You won't get any more saved-search emails. Your saved homes and searches are still on the site if you sign in again." : "It may be incomplete. Use the link in the most recent email."}</p></body>`);
    }

    // ------------------------------------------------------------------ the daily alerts (a scheduled call)
    if ((req.method === "GET" || req.method === "POST") && a === "cron_alerts") {
      const secretKey = process.env.CRON_SECRET;
      if (secretKey && req.headers.authorization !== `Bearer ${secretKey}`) return bad(res, 401, "Not allowed.");
      return res.status(200).json(await runAlerts(admin));
    }

    // ------------------------------------------------------------------ signing in
    if (req.method === "POST" && a === "request_code") {
      if (body.website) return res.status(200).json({ ok: true }); // honeypot: a bot filled the hidden field
      const site = await resolveSite(admin, req, body.site);
      if (!site) return bad(res, 404, "Home Search isn't available here.");
      const email = cleanEmail(body.email);
      if (!EMAIL.test(email)) return bad(res, 400, "That email address doesn't look right.");
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) return bad(res, 500, "Email delivery isn't configured yet.");
      const ipHash = hmac(`ip:${clientIp(req)}`);
      const [{ data: mine }, { count: fromIp }] = await Promise.all([
        admin.from("visitor_login_codes").select("created_at").ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).gte("created_at", iso(Date.now() - 60 * MINUTE)).order("created_at", { ascending: false }).limit(6),
        admin.from("visitor_login_codes").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", iso(Date.now() - 60 * MINUTE)),
      ]);
      if ((mine || []).length > 0 && Date.now() - new Date(mine[0].created_at).getTime() < 45 * 1000) return bad(res, 429, "Wait a moment before asking for another code.");
      if ((mine || []).length >= 5 || (fromIp || 0) >= 20) return bad(res, 429, "Too many codes requested. Please try again in a while.");
      const code = newCode();
      const { error } = await admin.from("visitor_login_codes").insert({ ...site.siteColumn, email, code_hash: hmac(`code:${email}:${code}`), ip_hash: ipHash, expires_at: iso(Date.now() + CODE_MINUTES * MINUTE) });
      if (error) {
        console.error("Visitor code insert failed:", error);
        return bad(res, 500, "Couldn't send a code. Please try again.");
      }
      const mail = codeEmail({ siteName: site.label, code });
      const sent = await sendNotification(apiKey, { from: fromAs(`${site.label} Home Search`, "Home Search", "alerts"), to: email, subject: mail.subject, text: mail.text, html: mail.html });
      if (!sent) return bad(res, 502, "Couldn't send the email. Please try again.");
      return res.status(200).json({ ok: true });
    }

    if (req.method === "POST" && a === "verify") {
      const site = await resolveSite(admin, req, body.site);
      if (!site) return bad(res, 404, "Home Search isn't available here.");
      const email = cleanEmail(body.email);
      const given = String(body.code || "").replace(/\D/g, "");
      if (!EMAIL.test(email) || given.length !== 6) return bad(res, 400, "Enter the 6-digit code from your email.");
      const column = site.kind === "agent" ? ["agent_site_id", site.agentSiteId] : ["org_id", site.orgId];
      const { data: latest } = await admin
        .from("visitor_login_codes")
        .select("id, code_hash, attempts, expires_at")
        .ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`))
        .eq(column[0], column[1])
        .gte("expires_at", iso(Date.now()))
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!latest) return bad(res, 400, "That code has expired. Ask for a new one.");
      if (latest.attempts >= 5) return bad(res, 429, "Too many tries. Ask for a new code.");
      await admin.from("visitor_login_codes").update({ attempts: latest.attempts + 1 }).eq("id", latest.id);
      if (!safeEqual(latest.code_hash, hmac(`code:${email}:${given}`))) return bad(res, 400, "That code isn't right.");
      await admin.from("visitor_login_codes").delete().ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).eq(column[0], column[1]);

      const name = cleanText(body.name, 80);
      let { data: visitor } = await admin.from("site_visitors").select("id, email, name, phone, agent_site_id, org_id, unsubscribed_at").eq(column[0], column[1]).ilike("email", email.replace(/[\\%_]/g, (c) => `\\${c}`)).maybeSingle();
      let isNew = false;
      if (!visitor) {
        const { data: created, error } = await admin.from("site_visitors").insert({ ...site.siteColumn, email, name, last_login_at: iso(Date.now()) }).select("id, email, name, phone, agent_site_id, org_id, unsubscribed_at").single();
        if (error) {
          console.error("Visitor insert failed:", error);
          return bad(res, 500, "Couldn't sign you in. Please try again.");
        }
        visitor = created;
        isNew = true;
      } else {
        const patch = { last_login_at: iso(Date.now()) };
        if (name && !visitor.name) patch.name = name;
        await admin.from("site_visitors").update(patch).eq("id", visitor.id);
        visitor = { ...visitor, ...patch };
      }
      if (isNew) await fileNewVisitor(admin, site, visitor);

      const token = newToken();
      await admin.from("visitor_sessions").insert({ token_hash: hmac(token), visitor_id: visitor.id, expires_at: iso(Date.now() + SESSION_DAYS * 24 * 60 * MINUTE) });
      return res.status(200).json({ token, account: await accountFor(admin, visitor) });
    }

    // ------------------------------------------------------------------ everything below needs a signed-in visitor
    const who = await signedIn(admin, req);
    if (!who) return bad(res, 401, "Please sign in.");
    const v = who.visitor;

    if (req.method === "GET" && a === "me") return res.status(200).json(await accountFor(admin, v));

    if (req.method !== "POST") return bad(res, 405, "Method not allowed.");

    if (a === "logout") {
      await admin.from("visitor_sessions").delete().eq("token_hash", who.tokenHash);
      return res.status(200).json({ ok: true });
    }
    if (a === "delete_account") {
      await admin.from("site_visitors").delete().eq("id", v.id);
      return res.status(200).json({ ok: true });
    }
    if (a === "profile") {
      const patch = {};
      if (typeof body.name === "string") patch.name = cleanText(body.name, 80);
      if (typeof body.phone === "string") patch.phone = cleanText(body.phone, 30);
      if (Object.keys(patch).length) await admin.from("site_visitors").update(patch).eq("id", v.id);
      return res.status(200).json({ ok: true });
    }

    if (a === "favorite") {
      const mls = String(body.mls || "");
      if (!MLS.test(mls)) return bad(res, 400, "That home can't be saved.");
      if (body.on === false) {
        await admin.from("visitor_favorites").delete().eq("visitor_id", v.id).eq("mls_number", mls);
        return res.status(200).json({ ok: true });
      }
      const { count } = await admin.from("visitor_favorites").select("mls_number", { count: "exact", head: true }).eq("visitor_id", v.id);
      if ((count || 0) >= MAX_FAVORITES) return bad(res, 400, "That's the most homes you can save. Remove some first.");
      await admin.from("visitor_favorites").upsert({ visitor_id: v.id, mls_number: mls, snapshot: cleanSnapshot(body.snapshot) });
      return res.status(200).json({ ok: true });
    }
    if (a === "favorites_merge") {
      const list = [...new Set((Array.isArray(body.mls) ? body.mls : []).map(String).filter((m) => MLS.test(m)))].slice(0, 100);
      if (list.length) await admin.from("visitor_favorites").upsert(list.map((m) => ({ visitor_id: v.id, mls_number: m })), { onConflict: "visitor_id,mls_number", ignoreDuplicates: true });
      return res.status(200).json({ ok: true });
    }

    if (a === "search_save") {
      const { count } = await admin.from("visitor_saved_searches").select("id", { count: "exact", head: true }).eq("visitor_id", v.id);
      if ((count || 0) >= MAX_SEARCHES) return bad(res, 400, "That's the most searches you can save. Delete one first.");
      const params = cleanSearchParams(body.params);
      const site = await resolveSite(admin, req, siteColumnOf(v));
      const row = {
        visitor_id: v.id,
        name: cleanText(body.name, 80) || describeSearch(params),
        params,
        page_url: pageUrlFor(site?.origin || SITE_ORIGIN, body.path),
        alerts: body.alerts !== false,
      };
      const { data, error } = await admin.from("visitor_saved_searches").insert(row).select("id").single();
      if (error) {
        console.error("Saved search insert failed:", error);
        return bad(res, 500, "Couldn't save the search. Please try again.");
      }
      return res.status(200).json({ ok: true, id: data.id, name: row.name, params });
    }
    if (a === "search_update") {
      const patch = {};
      if (typeof body.name === "string" && cleanText(body.name, 80)) patch.name = cleanText(body.name, 80);
      if (typeof body.alerts === "boolean") patch.alerts = body.alerts;
      if (Object.keys(patch).length) await admin.from("visitor_saved_searches").update(patch).eq("id", String(body.id || "")).eq("visitor_id", v.id);
      return res.status(200).json({ ok: true });
    }
    if (a === "search_delete") {
      await admin.from("visitor_saved_searches").delete().eq("id", String(body.id || "")).eq("visitor_id", v.id);
      return res.status(200).json({ ok: true });
    }

    return bad(res, 404, "Not found.");
  } catch (err) {
    console.error("Visitor API error:", err);
    return bad(res, 500, "Something went wrong. Please try again.");
  }
}

// ---------------------------------------------------------------------------------------------------------------- the daily alerts
// For every saved search with alerts on, ask the MLS feed for the newest homes and email the visitor the ones the last alert didn't already cover.
// A search's FIRST run only records what is there now (so nobody gets a flood of every home on the market); later runs email what is new.
async function runAlerts(admin) {
  const stats = { searches: 0, emailed: 0, baselined: 0, skipped: 0 };
  const apiKey = process.env.RESEND_API_KEY;
  const { data: rows, error } = await admin
    .from("visitor_saved_searches")
    .select("id, name, params, page_url, seen_mls, last_alert_at, visitor:site_visitors!inner(id, email, name, agent_site_id, org_id, unsubscribed_at)")
    .eq("alerts", true)
    .is("visitor.unsubscribed_at", null)
    .order("created_at")
    .limit(500);
  if (error) {
    console.error("Alert query failed:", error);
    return { ...stats, error: true };
  }

  const siteIds = [...new Set((rows || []).map((r) => r.visitor.agent_site_id).filter(Boolean))];
  const { data: sites } = siteIds.length ? await admin.from("agent_sites").select("id, org_id, idx_enabled, agent:profiles(full_name)").in("id", siteIds) : { data: [] };
  const siteById = new Map((sites || []).map((s) => [s.id, s]));
  const configs = new Map();
  const configFor = async (orgId) => {
    if (!configs.has(orgId)) configs.set(orgId, await idxConfigForOrgId(admin, orgId).catch(() => null));
    return configs.get(orgId);
  };
  const orgNames = new Map();
  const labelFor = async (v) => {
    if (v.agent_site_id) return siteById.get(v.agent_site_id)?.agent?.full_name || "Your agent";
    if (!orgNames.has(v.org_id)) orgNames.set(v.org_id, (await admin.from("organizations").select("name").eq("id", v.org_id).maybeSingle()).data?.name || "The brokerage");
    return orgNames.get(v.org_id);
  };

  const byVisitor = new Map();
  for (const row of rows || []) {
    stats.searches += 1;
    const v = row.visitor;
    const site = v.agent_site_id ? siteById.get(v.agent_site_id) : null;
    if (v.agent_site_id && (!site || !site.idx_enabled)) { stats.skipped += 1; continue; }
    const config = await configFor(v.agent_site_id ? site.org_id : v.org_id);
    if (!config) { stats.skipped += 1; continue; }
    const p = row.params || {};
    if (p.office === "true" && !config.officeName) { stats.skipped += 1; continue; }
    let listings;
    try {
      const data = await searchRepliersListings(config, {
        city: p.city, minPrice: p.minPrice, maxPrice: p.maxPrice, minBedrooms: p.minBeds, minBaths: p.minBaths,
        status: "A", pageNum: 1, resultsPerPage: 24, sortBy: "createdOnDesc",
        brokerage: p.office === "true" ? config.officeName : undefined, map: p.map || undefined,
      });
      listings = (data.listings || []).map(normalizeRepliersListing).filter(Boolean);
    } catch (err) {
      console.error("Alert search failed:", row.id, err.message);
      stats.skipped += 1;
      continue;
    }
    const seen = new Set(row.seen_mls || []);
    const fresh = listings.filter((l) => !seen.has(l.mlsNumber));
    const now = iso(Date.now());
    if (!row.last_alert_at && seen.size === 0) {
      await admin.from("visitor_saved_searches").update({ seen_mls: listings.map((l) => l.mlsNumber).slice(0, 300), last_alert_at: now }).eq("id", row.id);
      stats.baselined += 1;
      continue;
    }
    if (!fresh.length) continue;
    const list = byVisitor.get(v.id) || { visitor: v, sections: [], updates: [] };
    list.sections.push({ name: row.name, url: row.page_url || SITE_ORIGIN, homes: fresh.slice(0, 5), extra: Math.max(0, fresh.length - 5) });
    list.updates.push({ id: row.id, seen: [...fresh.map((l) => l.mlsNumber), ...(row.seen_mls || [])].slice(0, 300) });
    byVisitor.set(v.id, list);
  }

  for (const { visitor, sections, updates } of byVisitor.values()) {
    if (!apiKey) break;
    const label = await labelFor(visitor);
    const mail = alertEmail({ siteName: label, sections, unsubscribeUrl: `${SITE_ORIGIN}/api/visitor?a=unsubscribe&t=${unsubscribeToken(visitor.id)}`, disclaimer: DISCLAIMER });
    const sent = await sendNotification(apiKey, { from: fromAs(`${label} Home Search`, "Home Search", "alerts"), to: visitor.email, subject: mail.subject, text: mail.text, html: mail.html });
    if (!sent) continue;
    stats.emailed += 1;
    const now = iso(Date.now());
    for (const u of updates) await admin.from("visitor_saved_searches").update({ seen_mls: u.seen, last_alert_at: now }).eq("id", u.id);
  }
  return stats;
}
