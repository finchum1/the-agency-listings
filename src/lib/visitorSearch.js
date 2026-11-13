// Shared by the server (api/_lib/visitors.js) and the browser: a saved search's filters as a readable name.
/** A search as a readable name, for the default when the visitor doesn't give one. */
export function describeSearch(params) {
  const p = params || {};
  const bits = [];
  bits.push(p.city || "Everywhere");
  if (p.minBeds) bits.push(`${p.minBeds}+ beds`);
  if (p.minBaths) bits.push(`${p.minBaths}+ baths`);
  const money = (n) => (n >= 1_000_000 ? `$${+(n / 1_000_000).toFixed(2)}M` : `$${Math.round(n / 1000)}k`);
  if (p.minPrice && p.maxPrice) bits.push(`${money(+p.minPrice)} to ${money(+p.maxPrice)}`);
  else if (p.maxPrice) bits.push(`under ${money(+p.maxPrice)}`);
  else if (p.minPrice) bits.push(`${money(+p.minPrice)}+`);
  if (p.map) bits.push("drawn area");
  return bits.join(" · ");
}

