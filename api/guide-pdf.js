// GET /api/guide-pdf?site=<agent site slug>&guide=sellers|buyers|home-value|relocation
// The agent's branded guide as a real PDF file: a cover in the site's theme colors with the brokerage logo and the agent's (or the team's) photos, the
// guide's pages (src/lib/guides.js, the same words as the website pages), and the contact details and brokerage disclaimer at the end. No sign-in: it is
// a public marketing document for a published site. The website pages ask for a name and email before they show the link (the request becomes a lead);
// this endpoint itself stays open so the agent can send the file or link anywhere. Cached for a few minutes. See api/_lib/guideFile.js.
import { serviceClient } from "./_lib/authUser.js";
import { makeGuide } from "./_lib/guideFile.js";

const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const guideKey = String(req.query?.guide || "");
  const slug = String(req.query?.site || "");
  if (!SLUG.test(slug)) return res.status(404).json({ error: "That guide isn't available." });
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  try {
    const made = await makeGuide(admin, { slug }, guideKey);
    if (!made) return res.status(404).json({ error: "That guide isn't available." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${made.filename}"`);
    res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=3600");
    return res.status(200).send(made.pdf);
  } catch (err) {
    console.error("Guide PDF failed:", err);
    return res.status(500).json({ error: "Couldn't make the guide. Please try again." });
  }
}
