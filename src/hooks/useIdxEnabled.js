import { useEffect, useState } from "react";

// Does this organization have a live MLS (IDX) feed? Asked once per organization per page load of the dashboard
// (api/repliers.js ?probe=1 answers from the organization's own settings), so the menu can show Home Search only where it works.
const known = new Map(); // org slug -> true | false
const asking = new Map(); // org slug -> the request in flight

function ask(slug) {
  if (!asking.has(slug)) {
    asking.set(
      slug,
      fetch(`/api/repliers?probe=1&org=${encodeURIComponent(slug)}`)
        .then((res) => (res.ok ? res.json() : { enabled: false }))
        .then((body) => known.set(slug, Boolean(body.enabled)))
        .catch(() => known.set(slug, false))
        .finally(() => asking.delete(slug)),
    );
  }
  return asking.get(slug);
}

/** { enabled, loading } for the organization with this slug (nothing is asked until there is a slug). */
export function useIdxEnabled(slug) {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!slug || known.has(slug)) return;
    let active = true;
    ask(slug).then(() => active && tick((n) => n + 1));
    return () => {
      active = false;
    };
  }, [slug]);
  return { enabled: slug ? known.get(slug) === true : false, loading: Boolean(slug) && !known.has(slug) };
}
