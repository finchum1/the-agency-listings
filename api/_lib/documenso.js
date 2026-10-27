// Talking to Documenso (the e-signature service). Hosted Documenso by default; DOCUMENSO_BASE_URL points it at another copy.
//   DOCUMENSO_API_KEY         the team API token (Documenso > Team settings > API tokens)
//   DOCUMENSO_WEBHOOK_SECRET  the secret set on the webhook (Documenso > Team settings > Webhooks); checked on every incoming webhook
// What a deal's signature request is, and what happens as people sign, lives in api/deal-signatures.js and api/documenso-webhook.js.
const BASE = () => (process.env.DOCUMENSO_BASE_URL || "https://app.documenso.com/api/v2").replace(/\/+$/, "");

export const isConfigured = () => Boolean(process.env.DOCUMENSO_API_KEY);

export class DocumensoError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function call(path, { method = "GET", json, query, raw } = {}) {
  if (!isConfigured()) throw new DocumensoError("Documenso isn't connected yet.", 503);
  const url = new URL(`${BASE()}${path}`);
  for (const [k, v] of Object.entries(query || {})) if (v != null) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    method,
    headers: { Authorization: process.env.DOCUMENSO_API_KEY, ...(json ? { "Content-Type": "application/json" } : {}) },
    body: json ? JSON.stringify(json) : undefined,
    signal: AbortSignal.timeout(25000),
  });
  if (raw) {
    if (!res.ok) throw new DocumensoError(`Documenso couldn't give the file (${res.status}).`, res.status);
    return Buffer.from(await res.arrayBuffer());
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new DocumensoError(body?.message || body?.error || `Documenso answered ${res.status}.`, res.status);
  return body;
}

// The templates in the team (each with the signer slots a deal has to fill).
export async function listTemplates() {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const body = await call("/template", { query: { page, perPage: 100 } });
    for (const t of body.data || []) {
      out.push({
        id: t.id,
        title: t.title,
        slots: (t.recipients || [])
          .map((r) => ({ id: r.id, role: r.role, name: r.name || "", email: r.email || "", signingOrder: r.signingOrder ?? null })),
      });
    }
    if (page >= (body.totalPages || 1)) break;
  }
  return out;
}

// Makes a document from a template with these people and sends it right away.
export function useTemplate({ templateId, recipients, title, subject, message, externalId }) {
  return call("/template/use", {
    method: "POST",
    json: { templateId, recipients, distributeDocument: true, externalId, override: { title, ...(subject ? { subject } : {}), ...(message ? { message } : {}) } },
  });
}

export const getEnvelope = (envelopeId) => call(`/envelope/${encodeURIComponent(envelopeId)}`);
export const redistribute = (envelopeId, recipientIds) => call("/envelope/redistribute", { method: "POST", json: { envelopeId, recipients: recipientIds } });
export const downloadSigned = (itemId) => call(`/envelope/item/${encodeURIComponent(itemId)}/download`, { query: { version: "signed" }, raw: true });

// A recipient as the deal screens show them.
export const slimRecipient = (r) => ({ id: r.id, name: r.name || "", email: r.email || "", role: r.role, signing_status: r.signingStatus || "NOT_SIGNED", signed_at: r.signedAt || null });
export const statusOf = (s) => ({ DRAFT: "sending", PENDING: "pending", COMPLETED: "completed", REJECTED: "rejected", CANCELLED: "cancelled" })[s] || "pending";
