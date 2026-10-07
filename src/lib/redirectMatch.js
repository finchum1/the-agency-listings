// Shared by the redirect manager UI (validating what gets saved) and
// middleware.js (matching an incoming request), so both agree on exactly
// what an "address" is. Matching ignores case, trailing slashes and query
// strings. A rule ending in /* matches everything under that prefix, and a
// * in the target is replaced by whatever the wildcard matched
// (/neighborhoods/* -> /areas/*).

export function normalizePath(input, { keepCase = false } = {}) {
  let p = String(input || "").trim();
  p = p.replace(/^https?:\/\/[^/]+/i, "");
  p = p.split("#")[0].split("?")[0];
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "") || "/";
  return keepCase ? p : p.toLowerCase();
}

export function normalizeTarget(input) {
  const t = String(input || "").trim();
  if (/^https?:\/\//i.test(t)) return t;
  return t.startsWith("/") ? t : `/${t}`;
}

const RESERVED = ["/dashboard", "/login", "/accept-invite", "/api"];

// Returns an error message, or null when the pair is fine to save.
export function validateRule(fromInput, toInput) {
  if (!String(fromInput || "").trim()) return "Enter the old address.";
  if (!String(toInput || "").trim()) return "Enter the new address.";
  const from = normalizePath(fromInput);
  const to = normalizeTarget(toInput);
  if (from === "/") return "The home page can't be redirected.";
  if (RESERVED.some((r) => from === r || from.startsWith(`${r}/`))) return "That address is part of the dashboard and can't be redirected.";
  const stars = (from.match(/\*/g) || []).length;
  if (stars > 1 || (stars === 1 && !from.endsWith("/*"))) return "A * is only allowed at the very end, like /neighborhoods/*.";
  if (to.includes("*") && stars === 0) return "The new address can only contain * when the old one ends in /*.";
  if (!to.includes("*") && /^\//.test(to) && normalizePath(to) === from) return "The old and new address are the same.";
  return null;
}

// rules: [{ from_path, to_path }]. Returns the target string or null.
export function matchRedirect(pathname, rules) {
  const path = normalizePath(pathname);
  for (const r of rules) {
    if (!r.from_path.endsWith("/*") && r.from_path === path) return r.to_path;
  }
  let best = null;
  for (const r of rules) {
    if (!r.from_path.endsWith("/*")) continue;
    const prefix = r.from_path.slice(0, -1);
    if (path.startsWith(prefix) && path.length > prefix.length && (!best || prefix.length > best.prefix.length)) {
      best = { r, prefix };
    }
  }
  if (!best) return null;
  const rest = normalizePath(pathname, { keepCase: true }).slice(best.prefix.length);
  return best.r.to_path.includes("*") ? best.r.to_path.replace("*", rest) : best.r.to_path;
}

// "old -> new" per line, also accepts tab- or comma-separated pairs (a
// spreadsheet paste). Returns { rows: [{from, to}], errors: [string] }.
export function parseBulk(text) {
  const rows = [];
  const errors = [];
  String(text || "")
    .split(/\r?\n/)
    .forEach((raw, i) => {
      const line = raw.trim();
      if (!line) return;
      const m = line.match(/^(.*?)\s*(?:->|=>|\t|,)\s*(.+)$/);
      if (!m) {
        errors.push(`Line ${i + 1}: use "old address -> new address".`);
        return;
      }
      const err = validateRule(m[1], m[2]);
      if (err) {
        errors.push(`Line ${i + 1}: ${err}`);
        return;
      }
      rows.push({ from: normalizePath(m[1]), to: normalizeTarget(m[2]) });
    });
  return { rows, errors };
}
