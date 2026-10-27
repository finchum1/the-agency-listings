// Is a property site's custom domain actually serving this app, and who gets told when one stops? Shared by the Listings page's check
// (api/domain-check.js) and the daily monitor (api/domain-monitor.js).
//
// Each domain is asked for /domain-check.txt (a static file in public/ that says "agency-listings-ok"). That separates the cases that
// all look the same in a browser tab:
//   ok            the domain loads this app
//   no_dns        no DNS record, so nothing answers
//   not_attached  the domain reaches Vercel but hasn't been added to the project
//   elsewhere     the domain loads, but from somewhere else (an old host, a parking page)
//   tls           the security certificate isn't ready yet (often just a few minutes after connecting)
//   timeout / unreachable   it didn't answer in time / couldn't be reached
import { assertPublicUrl } from "./safeFetch.js";
import { sendNotification } from "./inquiry.js";
import { buildDomainAlertEmail } from "./domainEmail.js";
import { SITE_ORIGIN } from "../../src/lib/seo.js";

const MARKER = "agency-listings-ok";
const TIMEOUT_MS = 6000;

export const LABELS = {
  ok: "Live",
  no_dns: "No DNS record found for this domain.",
  not_attached: "The domain points at Vercel, but hasn't been added to the project.",
  elsewhere: "The domain loads, but not from this app. It may still point at an old host or a parking page.",
  tls: "The security certificate isn't ready yet. This can take a few minutes after connecting.",
  timeout: "The domain didn't answer in time.",
  unreachable: "The domain couldn't be reached.",
};

export async function checkDomain(domain) {
  try {
    let current = `https://${domain}/domain-check.txt`;
    for (let hop = 0; hop < 4; hop++) {
      const url = await assertPublicUrl(current);
      const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "AgencyDomainCheck/1.0", Accept: "text/plain" } });
      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location"), url).toString();
        continue;
      }
      if (res.ok) {
        const text = (await res.text()).slice(0, 200).trim();
        return text === MARKER ? "ok" : "elsewhere";
      }
      if (res.headers.get("x-vercel-error") || (res.status === 404 && /vercel/i.test(res.headers.get("server") || ""))) return "not_attached";
      return "elsewhere";
    }
    return "elsewhere";
  } catch (err) {
    const code = err?.code || err?.cause?.code || "";
    const text = `${code} ${err?.name || ""} ${err?.message || ""} ${err?.cause?.message || ""}`;
    if (code === "ENOTFOUND" || code === "ENODATA" || code === "EAI_AGAIN") return "no_dns";
    if (/CERT|TLS|SSL|ALTNAME/i.test(text)) return "tls";
    if (err?.name === "TimeoutError" || err?.name === "AbortError" || /timed? ?out|ETIMEDOUT/i.test(text)) return "timeout";
    return "unreachable";
  }
}


export const cleanDomain = (d) => String(d || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

/** Checks many domains, a few at a time. items: [{ id, domain, ... }] -> the same items with `status` added. */
export async function checkMany(items, concurrency = 8) {
  const queue = items.map((it) => ({ ...it }));
  const out = [];
  const worker = async () => {
    for (let it = queue.shift(); it; it = queue.shift()) {
      it.domain = cleanDomain(it.domain);
      it.status = await checkDomain(it.domain);
      out.push(it);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Remembers each domain's latest result (domain_health) and emails the admins who turned alerts on, once when a domain that was
 * working stops responding and once when it is back. A domain that has never worked isn't emailed about (it's probably still being
 * set up): it only shows as a problem on the Listings page. A failure is checked a second time a few seconds later before anyone is
 * told, so a blip doesn't send an email. items: [{ id, org_id, domain, status }].
 */
export async function recordHealth(admin, items, { confirmDelayMs = 8000 } = {}) {
  if (!items.length) return { down: 0, back: 0 };
  const { data: prevRows } = await admin.from("domain_health").select("*").in("listing_id", items.map((i) => i.id));
  const prevById = new Map((prevRows || []).map((r) => [r.listing_id, r]));
  const prevOf = (it) => {
    const p = prevById.get(it.id);
    return p && p.domain === it.domain ? p : null; // a changed domain starts over
  };

  const doubtful = items.filter((it) => it.status !== "ok" && prevOf(it)?.last_ok_at && !prevOf(it)?.alerted_at);
  if (doubtful.length) {
    await sleep(confirmDelayMs);
    for (const it of doubtful) it.status = await checkDomain(it.domain);
  }

  const now = new Date().toISOString();
  const rows = items.map((it) => {
    const p = prevOf(it);
    const ok = it.status === "ok";
    return {
      listing_id: it.id,
      org_id: it.org_id || null,
      domain: it.domain,
      status: it.status,
      last_checked_at: now,
      last_ok_at: ok ? now : p?.last_ok_at || null,
      down_since: ok ? null : p?.down_since || now,
      alerted_at: p?.alerted_at || null,
    };
  });
  await admin.from("domain_health").upsert(rows, { onConflict: "listing_id" });

  const down = [];
  const back = [];
  for (const it of items) {
    const p = prevOf(it);
    if (it.status !== "ok" && p?.last_ok_at && !p.alerted_at) {
      const { data } = await admin.from("domain_health").update({ alerted_at: now }).eq("listing_id", it.id).is("alerted_at", null).select("listing_id");
      if (data?.length) down.push(it);
    } else if (it.status === "ok" && p?.alerted_at) {
      const { data } = await admin.from("domain_health").update({ alerted_at: null }).eq("listing_id", it.id).not("alerted_at", "is", null).select("listing_id");
      if (data?.length) back.push({ ...it, down_since: p.down_since });
    }
  }
  if (down.length || back.length) await sendDomainAlerts(admin, down, back);
  return { down: down.length, back: back.length };
}

async function sendDomainAlerts(admin, down, back) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return;
  const all = [...down, ...back];
  const [{ data: listings }, { data: optedIn }] = await Promise.all([
    admin.from("listings").select("id, address_line1, city, agent:profiles(full_name)").in("id", all.map((i) => i.id)),
    admin.from("agent_notification_settings").select("agent_id").eq("domain_alerts", true),
  ]);
  const byId = new Map((listings || []).map((l) => [l.id, l]));
  const orgs = [...new Set(all.map((i) => i.org_id).filter(Boolean))];
  const { data: admins } = optedIn?.length && orgs.length ? await admin.from("profiles").select("id, email, org_id").in("id", optedIn.map((o) => o.agent_id)).eq("role", "admin").in("org_id", orgs) : { data: [] };
  const view = (it) => ({ domain: it.domain, status: it.status, label: LABELS[it.status], down_since: it.down_since, listing: byId.get(it.id) });
  for (const a of admins || []) {
    if (!a.email) continue;
    const mineDown = down.filter((i) => i.org_id === a.org_id).map(view);
    const mineBack = back.filter((i) => i.org_id === a.org_id).map(view);
    if (!mineDown.length && !mineBack.length) continue;
    const mail = buildDomainAlertEmail({ down: mineDown, back: mineBack, url: `${SITE_ORIGIN}/dashboard/listings` });
    await sendNotification(apiKey, { from: process.env.LEAD_FROM_EMAIL || "Domain Alerts <onboarding@resend.dev>", to: [a.email], subject: mail.subject, text: mail.text, html: mail.html });
  }
}
