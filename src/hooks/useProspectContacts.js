import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";

// What a Leads or Pipeline board needs to know about the contact behind each card: relationship, tags, last time they were in touch.
// One read of the cards with their contacts attached (so the board never loads the whole contact database), plus the agent's tags.
// byPerson: card id -> { contactId, relationship, lastContactedAt, doNotContact, tagIds }
export function useProspectContacts(group) {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [tags, setTags] = useState([]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const all = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase
        .from("people")
        .select("id, contact:contacts(id, relationship, last_contacted_at, do_not_contact, contact_tag_links(tag_id))")
        .eq("owner_id", user.id)
        .eq("stage_group", group)
        .order("id")
        .range(from, from + 999);
      if (error) return; // the board still works; it just has no contact details
      all.push(...data);
      if (data.length < 1000) break;
    }
    setRows(all);
    const { data: t } = await supabase.from("contact_tags").select("*").order("name");
    setTags(t || []);
  }, [user?.id, group]);

  useEffect(() => {
    load();
  }, [load]);

  const byPerson = useMemo(() => {
    const m = new Map();
    for (const r of rows) {
      const c = r.contact;
      if (!c) continue;
      m.set(r.id, { contactId: c.id, relationship: c.relationship, lastContactedAt: c.last_contacted_at, doNotContact: c.do_not_contact, tagIds: (c.contact_tag_links || []).map((l) => l.tag_id) });
    }
    return m;
  }, [rows]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  return { byPerson, tags, tagById, reload: load };
}
