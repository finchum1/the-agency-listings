import { supabase } from "./supabaseClient";
import { DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_TEMPLATES } from "./checklistDefaults.js";

export * from "./checklistDefaults.js";

// The agent's saved template for a side, or the built-in default.
// With `forDeal` (a deal id) it is the template of the agent who owns that deal, which a coordinator can't read directly.
export async function loadTemplate(side, forDeal) {
  const { data } = forDeal
    ? await supabase.rpc("deal_owner_template", { p_person: forDeal, p_side: side, p_kind: "checklist" }).then((r) => ({ data: r.data ? { sections: r.data } : null }))
    : await supabase.from("checklist_templates").select("sections").eq("side", side).maybeSingle();
  return data?.sections?.length ? data.sections : DEFAULT_TEMPLATES[side];
}

export async function loadDocumentTemplate(side, forDeal) {
  const { data } = forDeal
    ? await supabase.rpc("deal_owner_template", { p_person: forDeal, p_side: side, p_kind: "documents" }).then((r) => ({ data: r.data ? { sections: r.data } : null }))
    : await supabase.from("document_templates").select("sections").eq("side", side).maybeSingle();
  return data?.sections?.length ? data.sections : DEFAULT_DOCUMENT_TEMPLATES[side];
}
