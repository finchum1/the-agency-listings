// A CMA as a PDF file (see api/_lib/cmaPdf.js; it is the client page, laid out as a document).
//   GET  /api/cma-pdf?token=cm...        a client's own download from a share link: no sign-in, the token is the credential (compared only by its hash)
//   POST /api/cma-pdf  { cma }           the signed-in agent's download of the CMA they have open, unsaved edits and all (their own profile and brokerage)
//   POST /api/cma-pdf  { cma, presentation: true, for_name }   the same as a listing presentation: a cover, a note to the sellers, about the agent and the
//                                        marketing plan (cma.presentation) in front, and the net sheet inside when the agent chose to include it
// Either way the PDF holds only what the client page shows: unticked comps are left out, and the net sheet only when the agent turned it on.
import crypto from "node:crypto";
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { buildCmaPdf } from "./_lib/cmaPdf.js";
import { picture } from "./_lib/guideFile.js";
import { brandFromOrg } from "../src/lib/brand.js";
import { subjectAddress } from "../src/lib/cma.js";
import { cleanPresentation } from "../src/lib/presentation.js";

const TOKEN = /^cm[0-9a-f]{64}$/;
const AGENT = "full_name, title, license, phone, email, photo_url";
const ORG = "id, slug, name, brand, address_line1, city, state, zip, disclaimer, franchise_disclaimer";

const text = (v, max) => String(v ?? "").slice(0, max);
/** The pieces of a CMA a PDF needs, from a document the browser sent: plain strings and numbers, at most 40 comps. */
export function cleanCma(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  const subject = {};
  for (const [k, v] of Object.entries(o.subject && typeof o.subject === "object" ? o.subject : {}).slice(0, 20)) subject[text(k, 30)] = text(v, 200);
  const comps = (Array.isArray(o.comps) ? o.comps : []).slice(0, 40).map((c) => ({
    ...Object.fromEntries(["id", "status", "address", "price", "list_price", "date", "dom", "beds", "baths", "sqft", "year_built", "lot", "distance", "mls", "notes"].map((k) => [k, text(c?.[k], k === "notes" ? 500 : 200)])),
    include: c?.include !== false,
    adjustments: (Array.isArray(c?.adjustments) ? c.adjustments : []).slice(0, 12).map((a) => ({ label: text(a?.label, 80), amount: text(a?.amount, 20) })),
  }));
  return {
    title: text(o.title, 160),
    subject,
    comps,
    price_low: o.price_low ?? null,
    price_high: o.price_high ?? null,
    suggested_price: o.suggested_price ?? null,
    notes: text(o.notes, 5000),
    net_sheet: o.net_sheet && typeof o.net_sheet === "object" ? o.net_sheet : null,
    presentation: o.presentation && typeof o.presentation === "object" ? cleanPresentation(o.presentation) : null,
    prepared: o.prepared || new Date().toISOString(),
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }

  let cma;
  let agent;
  let orgRow;
  let wantPresentation = false;
  let forName = "";
  if (req.method === "GET") {
    const token = String(req.query?.token || "");
    if (!TOKEN.test(token)) return res.status(404).json({ error: "This link isn't valid anymore." });
    const hash = crypto.createHash("sha256").update(token).digest("hex");
    const { data } = await admin.from("cmas").select("owner_id, org_id, title, subject, comps, price_low, price_high, suggested_price, notes, net_sheet, updated_at").eq("share_hash", hash).maybeSingle();
    if (!data) return res.status(404).json({ error: "This link isn't valid anymore." });
    cma = cleanCma({ ...data, prepared: data.updated_at });
    const [a, o] = await Promise.all([admin.from("profiles").select(AGENT).eq("id", data.owner_id).maybeSingle(), admin.from("organizations").select(ORG).eq("id", data.org_id).maybeSingle()]);
    agent = a.data;
    orgRow = o.data;
  } else {
    const auth = await authenticate(req, res);
    if (!auth) return;
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = null;
      }
    }
    if (!body?.cma) return res.status(400).json({ error: "Send the CMA to turn into a PDF." });
    cma = cleanCma(body.cma);
    wantPresentation = body.presentation === true;
    forName = text(body.for_name, 120);
    const { data: me } = await auth.supabase.from("profiles").select(`${AGENT}, org_id`).eq("id", auth.user.id).maybeSingle();
    agent = me;
    const { data: o } = me?.org_id ? await admin.from("organizations").select(ORG).eq("id", me.org_id).maybeSingle() : { data: null };
    orgRow = o;
  }

  // What the client page shows: unticked homes out, the net sheet only when switched on.
  cma.comps = cma.comps.filter((c) => c.include !== false);
  // A presentation carries the net sheet when the agent chose to include it (the sellers are the ones holding the document); the client page only when "show" is on.
  const presentation = wantPresentation ? cma.presentation || cleanPresentation({}) : null;
  if (presentation) cma.net_sheet = presentation.include_net && cma.net_sheet ? { ...cma.net_sheet, show: true } : null;
  else if (!cma.net_sheet?.show) cma.net_sheet = null;

  try {
    const org = brandFromOrg(orgRow);
    const address = [org.address.line1, [org.address.city, [org.address.state, org.address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")].filter(Boolean).join(", ");
    const [logo, agentPhoto] = await Promise.all([org.logos?.white || org.logo ? picture(org.logos?.white || org.logo, { height: 120 }) : null, agent?.photo_url ? picture(agent.photo_url, { width: 200, height: 200, fit: "cover" }) : null]);
    const pdf = await buildCmaPdf({
      cma,
      agent: agent ? { name: agent.full_name || "", title: agent.title || "", license: agent.license || "", phone: agent.phone || "", email: agent.email || "" } : null,
      brand: { org: org.name, address, disclaimer: org.disclaimer },
      images: { logo, agentPhoto },
      presentation,
      forName,
    });
    const name = `${presentation ? "Listing presentation" : "CMA"} - ${subjectAddress(cma.subject) || cma.title || "Market analysis"}`.replace(/[^\w .,'()-]+/g, "").trim();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${name}.pdf"`);
    return res.status(200).send(pdf);
  } catch (err) {
    console.error("CMA PDF failed:", err);
    return res.status(500).json({ error: "Couldn't make the PDF. Please try again." });
  }
}
