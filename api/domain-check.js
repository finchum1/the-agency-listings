// POST /api/domain-check {ids?: [listingId]}: is each property site's custom domain actually serving this app? Signed in; the
// domains come from the listings the caller can read (never from the request), so this can't be pointed at an arbitrary address.
//
// Each domain is asked for /domain-check.txt (a static file in public/ that says "agency-listings-ok"). That separates the cases that
// all look the same in a browser tab:
//   ok            the domain loads this app
//   no_dns        no DNS record, so nothing answers
//   not_attached  the domain reaches Vercel but hasn't been added to the project
//   elsewhere     the domain loads, but from somewhere else (an old host, a parking page)
//   tls           the security certificate isn't ready yet (often just a few minutes after connecting)
//   timeout / unreachable   it didn't answer in time / couldn't be reached
import { authenticate } from "./_lib/authUser.js";
import { assertPublicUrl } from "./_lib/safeFetch.js";

const MARKER = "agency-listings-ok";
const TIMEOUT_MS = 6000;
const MAX_DOMAINS = 80;

const LABELS = {
  ok: "Live",
  no_dns: "No DNS record found for this domain.",
  not_attached: "The domain points at Vercel, but hasn't been added to the project.",
  elsewhere: "The domain loads, but not from this app. It may still point at an old host or a parking page.",
  tls: "The security certificate isn't ready yet. This can take a few minutes after connecting.",
  timeout: "The domain didn't answer in time.",
  unreachable: "The domain couldn't be reached.",
};

export async function check(domain) {
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

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const auth = await authenticate(req, res);
  if (!auth) return;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String).slice(0, 500) : null;
  let query = auth.supabase.from("listings").select("id, custom_domain").not("custom_domain", "is", null).neq("custom_domain", "").limit(MAX_DOMAINS);
  if (ids) query = query.in("id", ids);
  const { data: rows, error } = await query;
  if (error) return res.status(500).json({ error: "Couldn't read the listings." });

  const results = {};
  const checkedAt = new Date().toISOString();
  const queue = [...(rows || [])];
  const worker = async () => {
    for (let row = queue.shift(); row; row = queue.shift()) {
      const domain = String(row.custom_domain).trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
      const status = await check(domain);
      results[row.id] = { domain, status, label: LABELS[status], checked_at: checkedAt };
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  return res.status(200).json({ results });
}
