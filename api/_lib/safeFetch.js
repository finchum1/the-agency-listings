// Fetching a web address someone else supplied (an old site to import from, a calendar feed) without letting it reach
// anything private. Every request goes through assertPublicUrl(): http(s) only, and the host must resolve to public
// addresses (no localhost, private ranges, or cloud metadata endpoints), re-checked on every redirect hop.
// Used by api/_lib/importPost.js and api/_lib/calendarFeed.js.
import dns from "node:dns/promises";
import net from "node:net";

const FETCH_TIMEOUT_MS = 8000;

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === "::1" || v === "::" || v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("::ffff:");
}

export async function assertPublicUrl(input) {
  let url;
  try {
    url = new URL(input);
  } catch {
    throw new Error("That isn't a valid web address.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Only http(s) addresses can be imported.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) throw new Error("That address isn't public.");
  const addresses = net.isIP(host) ? [{ address: host }] : await dns.lookup(host, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) throw new Error("That address isn't public.");
  return url;
}

export async function safeFetch(input, { maxBytes, accept, userAgent }) {
  let current = input;
  for (let hop = 0; hop < 5; hop++) {
    const url = await assertPublicUrl(current);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": userAgent || "Mozilla/5.0 (compatible; AgencyImporter/1.0)", Accept: accept || "*/*" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location"), url).toString();
      continue;
    }
    if (!res.ok) throw new Error(`The page returned ${res.status}.`);
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > maxBytes) throw new Error("That file is too large.");
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error("That file is too large.");
    return { buffer, contentType: res.headers.get("content-type") || "", finalUrl: url.toString() };
  }
  throw new Error("Too many redirects.");
}

