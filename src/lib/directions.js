// Turning an address into a "get me there" link, and a list of addresses into a drop-off route. The street often holds the whole address
// ("403 Timber Creek Dr, Tuttle, Ok 73089, Usa,") because that is how contacts were imported, so a full address is built from whichever
// parts there are and nothing is repeated.

const clean = (s) => String(s || "").replace(/\s+/g, " ").replace(/[,\s]+$/, "").trim();

/** One line a map can search for: the street plus any city, state and zip not already in it. */
export function mapAddress(c) {
  const street = clean(c.address_line1);
  const parts = [street];
  const low = street.toLowerCase();
  for (const extra of [c.city, c.state, c.zip]) {
    const e = clean(extra);
    if (e && !low.includes(e.toLowerCase())) parts.push(e);
  }
  return parts.filter(Boolean).join(", ");
}

/** True when the address is too thin for a map to find reliably: no number, or nothing saying where (no zip, state or city). */
export function addressIsThin(address) {
  const a = clean(address);
  if (!a) return true;
  if (!/\d/.test(a)) return true;
  const hasZip = /(?:,|\s[A-Za-z]{2}\.?)\s*\d{5}(?:-\d{4})?$/.test(a); // a zip at the END, not a five-digit street number
  const hasState = /\b(ok|oklahoma|tx|texas|ks|kansas|ar|arkansas|mo|missouri|co|colorado|nm|new mexico)\b/i.test(a);
  const hasCity = /,\s*[a-z][a-z .'-]{2,}(,|$)/i.test(a); // "street, City" at least
  return !(hasZip || hasState || hasCity);
}

export const googleDirectionsUrl = (address) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}&travelmode=driving`;
export const appleDirectionsUrl = (address) => `https://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;

/** A Google Maps trip through several addresses, in the order given, starting from wherever the phone is. Google takes up to 9 in between stops. */
export function googleRouteUrl(addresses) {
  const list = addresses.map(clean).filter(Boolean);
  if (!list.length) return "";
  const dest = list[list.length - 1];
  const via = list.slice(0, -1);
  const params = new URLSearchParams({ api: "1", destination: dest, travelmode: "driving" });
  if (via.length) params.set("waypoints", via.join("|"));
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Splits stops into runs Google can route in one go (10 stops: 9 on the way, 1 at the end). */
export function routeChunks(stops, size = 10) {
  const out = [];
  for (let i = 0; i < stops.length; i += size) out.push(stops.slice(i, i + size));
  return out;
}

/** The zip in an address, for grouping stops that are near each other. */
// The LAST five-digit number: a street number can be five digits too ("19816 Taggert Dr, Edmond, OK, 73012").
export const zipOf = (address) => {
  const all = [...String(address).matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].filter((m) => m.index > 0); // never the street number at the very start
  return all.length ? all[all.length - 1][1] : "";
};

/** Nearby stops together: by zip, then by street. Stops with no zip go last. */
export function sortForRoute(stops) {
  return [...stops].sort((a, b) => {
    const za = zipOf(a.address);
    const zb = zipOf(b.address);
    if (!za !== !zb) return za ? -1 : 1;
    return za.localeCompare(zb) || String(a.address).localeCompare(String(b.address), undefined, { numeric: true });
  });
}
