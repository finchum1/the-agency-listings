// Vercel serverless function — what a link-unfurler sees for a shared vendor list, /vendors/<token>. See api/_lib/linkPreview.js.
import { serveLinkPreview } from "./_lib/linkPreview.js";

export default (req, res) =>
  serveLinkPreview(req, res, {
    prefix: "vs",
    table: "vendor_share_links",
    path: "/vendors",
    title: "Recommended Vendors",
    blurb: (from) => `${from} put together a short list of local vendors they trust and recommend.`,
    generic: "A short list of local vendors we trust and recommend.",
  });
