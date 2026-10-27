// Signatures from a deal, through Documenso. Signed in; whoever can work the deal (its agent, or a coordinator on it) can send and remind;
// everyone who can see the deal can read the list (row-level security) and open the signed copy.
//   GET  ?action=status                          is Documenso connected?
//   GET  ?action=templates                       the team's Documenso templates and the signer slots each has
//   POST {action:"send", personId, templateId, title, signers:[{id,name,email}], checklistDocId?}   make the document from the template and send it
//   POST {action:"remind", id}                   resend the request to whoever hasn't signed
//   POST {action:"refresh", id}                  ask Documenso where it stands now (the webhook normally does this)
//   POST {action:"download", id}                 a short-lived link to the signed copy
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { DocumensoError, isConfigured, listTemplates, redistribute, slimRecipient, useTemplate } from "./_lib/documenso.js";
import { refreshSignature } from "./_lib/dealSignatures.js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;
  const action = req.method === "GET" ? String(req.query?.action || "") : String(req.body?.action || "");

  try {
    if (action === "status") return res.status(200).json({ configured: isConfigured() });
    if (!isConfigured()) return res.status(503).json({ error: "Documenso isn't connected yet. An admin needs to add the Documenso key." });

    if (req.method === "GET" && action === "templates") {
      return res.status(200).json({ templates: await listTemplates() });
    }
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
    const admin = serviceClient();

    if (action === "send") {
      const { personId, templateId, checklistDocId } = req.body;
      const title = String(req.body.title || "").trim().slice(0, 200);
      const access = (await auth.supabase.rpc("deal_person_access", { p_person: String(personId || "") })).data;
      if (!["owner", "tc"].includes(access)) return res.status(403).json({ error: "Only the deal's agent or its coordinator can send documents for signature." });
      const signers = Array.isArray(req.body.signers) ? req.body.signers : [];
      if (!Number.isInteger(templateId) || !title) return res.status(400).json({ error: "Choose a template and give the document a title." });
      if (!signers.length || signers.some((s) => !Number.isInteger(s.id) || !EMAIL.test(String(s.email || "").trim()) || !String(s.name || "").trim())) {
        return res.status(400).json({ error: "Every person needs a name and a valid email." });
      }
      const { data: deal } = await auth.supabase.from("people").select("id, owner_id, name, property_address").eq("id", personId).maybeSingle();
      if (!deal) return res.status(404).json({ error: "Deal not found." });
      const { data: owner } = await admin.from("profiles").select("org_id").eq("id", deal.owner_id).maybeSingle();
      let docId = null;
      if (checklistDocId) {
        const { data: d } = await auth.supabase.from("transaction_documents").select("id").eq("id", checklistDocId).eq("person_id", personId).maybeSingle();
        docId = d?.id || null;
      }
      const recipients = signers.map((s) => ({ id: s.id, name: String(s.name).trim().slice(0, 255), email: String(s.email).trim().toLowerCase() }));
      const { data: row, error: insertError } = await admin
        .from("deal_signatures")
        .insert({ person_id: personId, org_id: owner?.org_id || null, requested_by: auth.user.id, title, template_id: templateId, checklist_doc_id: docId, recipients: recipients.map((r) => ({ ...r, signing_status: "NOT_SIGNED" })) })
        .select("*")
        .single();
      if (insertError) return res.status(500).json({ error: "Couldn't start the request." });
      try {
        const env = await useTemplate({ templateId, recipients, title, externalId: row.id, subject: `Please sign: ${title}`, message: deal.property_address ? `This is for ${deal.property_address}.` : undefined });
        const { data: saved } = await admin
          .from("deal_signatures")
          .update({ envelope_id: env.envelopeId, status: "pending", recipients: (env.recipients || []).map(slimRecipient), updated_at: new Date().toISOString() })
          .eq("id", row.id)
          .select("*")
          .single();
        await admin.from("deal_messages").insert({ person_id: personId, author_id: auth.user.id, kind: "message", body: `Sent “${title}” for signature to ${recipients.map((r) => r.name).join(", ")}.` });
        return res.status(200).json({ ok: true, signature: saved });
      } catch (err) {
        await admin.from("deal_signatures").update({ status: "failed", error: String(err.message).slice(0, 300), updated_at: new Date().toISOString() }).eq("id", row.id);
        return res.status(err.status === 503 ? 503 : 502).json({ error: `Documenso didn't send it: ${err.message}` });
      }
    }

    // The rest work on an existing request.
    const { data: row } = await auth.supabase.from("deal_signatures").select("*").eq("id", String(req.body.id || "")).maybeSingle();
    if (!row) return res.status(404).json({ error: "Signature request not found." });

    if (action === "download") {
      if (!row.signed_path && row.status === "completed") {
        const fresh = await refreshSignature(admin, row);
        row.signed_path = fresh.signed_path;
      }
      if (!row.signed_path) return res.status(404).json({ error: "The signed copy isn't ready yet." });
      const { data, error } = await admin.storage.from("deal-documents").createSignedUrl(row.signed_path, 120, { download: `${row.title.replace(/[^\w .-]+/g, "")}-signed.pdf` });
      if (error) return res.status(500).json({ error: "Couldn't open the signed copy." });
      return res.status(200).json({ url: data.signedUrl });
    }

    const access = (await auth.supabase.rpc("deal_person_access", { p_person: row.person_id })).data;
    if (!["owner", "tc"].includes(access)) return res.status(403).json({ error: "Only the deal's agent or its coordinator can do that." });

    if (action === "remind") {
      if (row.status !== "pending" || !row.envelope_id) return res.status(400).json({ error: "Only a document that's out for signature can be reminded." });
      const waiting = (row.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.id);
      if (!waiting.length) return res.status(400).json({ error: "Everyone has already signed." });
      await redistribute(row.envelope_id, waiting);
      return res.status(200).json({ ok: true, reminded: waiting.length });
    }
    if (action === "refresh") {
      return res.status(200).json({ ok: true, signature: await refreshSignature(admin, row) });
    }
    return res.status(400).json({ error: "Unknown action." });
  } catch (err) {
    if (err instanceof DocumensoError) return res.status(err.status === 503 ? 503 : 502).json({ error: err.message });
    console.error("deal-signatures error:", err);
    return res.status(500).json({ error: "Something went wrong on our side." });
  }
}
