// Vercel serverless function — what a link-unfurler sees for a client's closing timeline, /timeline/<token>. See api/_lib/linkPreview.js.
// The card names the agent who owns the deal (the page is branded with them), even when their coordinator made the link.
import { serveLinkPreview } from "./_lib/linkPreview.js";

export default (req, res) =>
  serveLinkPreview(req, res, {
    prefix: "tl",
    table: "transaction_timeline_links",
    path: "/timeline",
    title: "Your Closing Timeline",
    who: "owner",
    blurb: (from) => `${from} is keeping you up to date: the key dates from contract to closing, and who is helping along the way.`,
    generic: "The key dates from contract to closing, and who is helping along the way.",
  });
