import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { STARTER_TEMPLATES } from "../lib/dealEmails";

// The signed-in person's deal email templates: the built-in starters (always there) with their own copies swapped in, then their own templates.
// A copy of a starter keeps the starter's key, so it takes the starter's place; deleting the copy brings the original back.
// Each item: { id (null for an untouched starter), key, name, subject, body, to_roles, cc_roles, side, starter, customized, skipCash }.
export function useEmailTemplates() {
  const [saved, setSaved] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("deal_email_templates").select("*").order("position").order("created_at");
    // The starters still work if the saved ones can't be read.
    setSaved(err ? [] : data || []);
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const templates = useMemo(() => {
    const copies = new Map(saved.filter((s) => s.base_key).map((s) => [s.base_key, s]));
    const list = STARTER_TEMPLATES.map((st) => {
      const copy = copies.get(st.key);
      return copy ? { ...copy, key: st.key, group: st.group, starter: true, customized: true, skipCash: st.skipCash } : { ...st, id: null, starter: true, customized: false };
    });
    for (const s of saved) if (!s.base_key) list.push({ ...s, key: s.id, starter: false, customized: false });
    return list;
  }, [saved]);

  // `draft` is a template as edited. A starter without a copy yet gets one made; a saved one is updated.
  const save = async (draft) => {
    setError("");
    const row = {
      name: draft.name.trim(),
      subject: draft.subject,
      body: draft.body,
      to_roles: draft.to_roles,
      cc_roles: draft.cc_roles,
      side: draft.side,
      updated_at: new Date().toISOString(),
    };
    if (!row.name) {
      setError("Give the template a name.");
      return false;
    }
    const { error: err } = draft.id
      ? await supabase.from("deal_email_templates").update(row).eq("id", draft.id)
      : await supabase.from("deal_email_templates").insert({ ...row, base_key: draft.starter ? draft.key : null, position: saved.length });
    if (err) {
      setError(err.message);
      return false;
    }
    await load();
    return true;
  };
  const remove = async (id) => {
    setError("");
    const { error: err } = await supabase.from("deal_email_templates").delete().eq("id", id);
    if (err) setError(err.message);
    await load();
    return !err;
  };

  return { templates, loading, error, save, remove, reload: load };
}
