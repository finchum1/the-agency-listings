// The client-facing deal timeline: which milestones a deal has, which are behind us, what's next, and the plain-English line a
// buyer or seller reads under each. Dates are "YYYY-MM-DD"; `today` comes from the server so every viewer sees the same day.
const parse = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const daysBetween = (fromKey, toKey) => Math.round((parse(toKey) - parse(fromKey)) / 86400000);
export const prettyDate = (key, opts = { weekday: "short", month: "short", day: "numeric" }) => parse(key).toLocaleDateString(undefined, opts);

export const inDays = (n) => (n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 1 ? `In ${n} days` : n === -1 ? "Yesterday" : `${-n} days ago`);

const COPY = {
  contract_date: {
    done: { buyer: "Offer accepted. The paperwork got started.", seller: "Offer accepted. The paperwork got started." },
    label: "Under contract",
    icon: "doc",
    buyer: "Your offer was accepted. The paperwork starts, and your earnest money goes to the title company.",
    seller: "You accepted the offer. The paperwork starts, and the buyer's earnest money goes to the title company.",
  },
  inspection_date: {
    done: { buyer: "Inspection completed.", seller: "Inspection completed." },
    label: "Inspection",
    icon: "search",
    buyer: "Your inspector walks the home. Afterward you decide which repairs, if any, to ask for.",
    seller: "The buyer's inspector visits the home. Any repair requests come back through us, and you decide how to respond.",
  },
  appraisal_date: {
    done: { buyer: "Appraisal completed.", seller: "Appraisal completed." },
    label: "Appraisal",
    icon: "scale",
    buyer: "The lender's appraiser confirms the home is worth what you are paying.",
    seller: "The lender's appraiser confirms the home's value for the buyer's loan.",
  },
  financing_deadline: {
    done: { buyer: "Loan approved.", seller: "The buyer's loan was approved." },
    label: "Loan approval",
    icon: "bank",
    buyer: "Your lender finishes the loan. Respond quickly to anything they ask for.",
    seller: "The buyer's lender finishes their loan. We stay in touch with them and keep you posted.",
  },
  closing_date: {
    done: { buyer: "You closed and got the keys.", seller: "You closed and your home is sold." },
    label: "Closing day",
    icon: "key",
    buyer: "You sign the final papers and get the keys. Bring your ID and any funds the title company asked for.",
    seller: "You sign the final papers, hand over the keys, and receive your proceeds.",
  },
};

/** The milestones this deal has dates for, in date order, each marked done / today / next / later. */
export function buildTimeline(deal, today) {
  const side = deal.side === "seller" ? "seller" : "buyer";
  const items = Object.keys(COPY)
    .filter((k) => deal[k])
    .map((k) => ({ key: k, label: COPY[k].label, icon: COPY[k].icon, text: COPY[k][side], doneText: COPY[k].done[side], date: deal[k], days: daysBetween(today, deal[k]) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  const nextIndex = items.findIndex((m) => m.days >= 0);
  const closing = items.find((m) => m.key === "closing_date");
  const closed = Boolean(closing && closing.days < 0) || deal.stage === "Closed";
  const marked = items.map((m, i) => ({ ...m, state: m.days < 0 ? "done" : i === nextIndex ? (m.days === 0 ? "today" : "next") : "later" }));
  // How far the line between two milestones is filled: all of it once the later one has passed, else by dates.
  const fill = marked.map((m, i) => {
    const nextItem = marked[i + 1];
    if (!nextItem) return 0;
    if (nextItem.days < 0) return 1;
    if (m.days > 0) return 0;
    const span = daysBetween(m.date, nextItem.date) || 1;
    return Math.max(0, Math.min(1, daysBetween(m.date, today) / span));
  });
  return { milestones: marked, fill, nextIndex, closed, closing, side };
}
