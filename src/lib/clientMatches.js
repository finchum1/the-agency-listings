// Wording for new matches on a client's saved search: what the agent sends the client.

const money = (n) => (n == null || n === "" ? "" : `$${Number(n).toLocaleString("en-US")}`);
export const homeLine = (h) => [money(h.price), [h.beds != null && `${h.beds} bd`, h.baths != null && `${h.baths} ba`, h.sqft && `${Number(h.sqft).toLocaleString("en-US")} sqft`].filter(Boolean).join(" · "), [h.address_line1, h.city].filter(Boolean).join(", ")].filter(Boolean).join(" — ");

/** The email the agent sends: a friendly note, one line per home with its link, and an offer to set up showings. */
export function matchMessage({ clientName = "", searchName = "", homes = [], total, agentName = "", origin = "" }) {
  const first = String(clientName).trim().split(/\s+/)[0] || "there";
  const more = (total ?? homes.length) - homes.length;
  const lines = homes.map((h) => `• ${homeLine(h)}${origin && h.mlsNumber ? `\n  ${origin}/brokerage/listings/${encodeURIComponent(h.mlsNumber)}` : ""}`);
  const subject = `${homes.length === 1 ? "A new home" : `${total ?? homes.length} new homes`} that match what you're looking for`;
  const body = [
    `Hi ${first},`,
    "",
    `${homes.length === 1 ? "A home just came on the market that fits" : "A few homes just came on the market that fit"} your search${searchName ? ` (${searchName})` : ""}:`,
    "",
    ...lines,
    ...(more > 0 ? ["", `…and ${more} more. Tell me and I'll send them over.`] : []),
    "",
    "Want to see any of them? Let me know and I'll set up showings.",
    ...(agentName ? ["", agentName] : []),
  ].join("\n");
  return { subject, body };
}

export const mailtoWithBody = (to, { subject, body }) => `mailto:${encodeURIComponent(to || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
