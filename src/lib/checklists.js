import { supabase } from "./supabaseClient";
import { DEFAULT_DOCUMENT_TEMPLATES, DEFAULT_TEMPLATES } from "./checklistDefaults.js";

export * from "./checklistDefaults.js";

// The agent's saved template for a side, or the built-in default.
export async function loadTemplate(side) {
  const { data } = await supabase.from("checklist_templates").select("sections").eq("side", side).maybeSingle();
  return data?.sections?.length ? data.sections : DEFAULT_TEMPLATES[side];
}

export async function loadDocumentTemplate(side) {
  const { data } = await supabase.from("document_templates").select("sections").eq("side", side).maybeSingle();
  return data?.sections?.length ? data.sections : DEFAULT_DOCUMENT_TEMPLATES[side];
}
