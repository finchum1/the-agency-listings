// Vercel serverless function — what a link-unfurler sees for a coordinator's deal update, /update/<token>. See api/_lib/linkPreview.js.
import { serveLinkPreview } from "./_lib/linkPreview.js";

export default (req, res) =>
  serveLinkPreview(req, res, {
    prefix: "du",
    table: "deal_update_links",
    path: "/update",
    title: "Deal Update",
    blurb: (from) => `${from} shared where your deal stands: key dates, tasks and documents.`,
    generic: "Where a deal stands: key dates, tasks and documents.",
  });
