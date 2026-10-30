// Address suggestions for the schedule's Location field, from Photon (komoot's search over OpenStreetMap data): no key, made for
// search-as-you-type. Biased to Oklahoma City and limited to the United States. Used by api/places.js, which only signed-in agents can reach.
const STATES = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT", Delaware: "DE", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID",
  Illinois: "IL", Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS",
  Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
  Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA", "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT", Vermont: "VT",
  Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY", "District of Columbia": "DC",
};

// One Photon result as a line of text: "412 Maple Ridge Dr, Oklahoma City, OK 73102" (a business or landmark comes first by name).
export function labelFor(p) {
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const parts = [];
  if (p.name && p.name !== p.street) parts.push(p.name);
  if (street) parts.push(street);
  const city = p.city || p.town || p.village || p.locality || p.district;
  if (city && city !== p.name) parts.push(city);
  const tail = [STATES[p.state] || p.state, p.postcode].filter(Boolean).join(" ");
  if (tail) parts.push(tail);
  return parts.filter((x, i) => parts.indexOf(x) === i).join(", ");
}

export async function suggestPlaces(query) {
  const q = String(query || "").trim().slice(0, 120);
  if (q.length < 3) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "7");
  url.searchParams.set("lang", "en");
  url.searchParams.set("lat", "35.47");
  url.searchParams.set("lon", "-97.52");
  url.searchParams.set("bbox", "-125,24,-66,50");
  const res = await fetch(url, { headers: { "User-Agent": "latchpoint-real-estate/1.0 (address suggestions)" }, signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error("The address search is not answering right now.");
  const json = await res.json();
  const seen = new Set();
  const out = [];
  for (const f of json.features || []) {
    if (f.properties?.countrycode && f.properties.countrycode !== "US") continue;
    const label = labelFor(f.properties || {});
    if (label && !seen.has(label)) {
      seen.add(label);
      out.push({ label });
    }
  }
  return out;
}
