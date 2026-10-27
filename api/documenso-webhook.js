// Documenso calls this when something happens to a document (sent, opened, signed, completed, declined...). Set it up in Documenso:
// Team settings > Webhooks > Create webhook: URL = https://<this site>/api/documenso-webhook, the same secret as DOCUMENSO_WEBHOOK_SECRET, and every event.
// The call is checked by its X-Documenso-Secret header. The payload only says WHICH document changed; what's true about it is read back from
// Documenso itself, so a forged or stale call can't mark anything signed.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";
import { isConfigured } from "./_lib/documenso.js";
import { refreshSignature } from "./_lib/dealSignatures.js";

const same = (a, b) => {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  const secret = process.env.DOCUMENSO_WEBHOOK_SECRET;
  if (!secret || !isConfigured()) return res.status(503).json({ error: "Not set up." });
  if (!same(req.headers["x-documenso-secret"], secret)) return res.status(401).json({ error: "Not allowed." });

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  const envelopeId = String(body?.payload?.envelopeId || "");
  if (!envelopeId) return res.status(200).json({ ok: true, ignored: true });
  const admin = serviceClient();
  const { data: row } = await admin.from("deal_signatures").select("*").eq("envelope_id", envelopeId).maybeSingle();
  if (!row) return res.status(200).json({ ok: true, ignored: true }); // a document that didn't come from a deal
  try {
    await refreshSignature(admin, row);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("documenso webhook failed:", err);
    return res.status(500).json({ error: "Couldn't update." }); // Documenso will retry
  }
}
