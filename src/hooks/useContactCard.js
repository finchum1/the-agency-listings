import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// The contact behind a Leads / Pipeline card, for its panel: relationship, tags and when they were last in touch. Changes show at once and
// are saved behind the scenes; `onChange` lets the board behind the panel refresh its own copy.
export function useContactCard(contactId, onChange) {
  const [contact, setContact] = useState(null);
  const [tags, setTags] = useState([]);
  const [tagIds, setTagIds] = useState([]);

  const load = useCallback(async () => {
    if (!contactId) {
      setContact(null);
      setTagIds([]);
      return;
    }
    const [c, t, l] = await Promise.all([
      supabase.from("contacts").select("id, first_name, last_name, relationship, last_contacted_at, do_not_contact, touch_every_days").eq("id", contactId).maybeSingle(),
      supabase.from("contact_tags").select("*").order("name"),
      supabase.from("contact_tag_links").select("tag_id").eq("contact_id", contactId),
    ]);
    setContact(c.data || null);
    setTags(t.data || []);
    setTagIds((l.data || []).map((x) => x.tag_id));
  }, [contactId]);

  useEffect(() => {
    load();
  }, [load]);

  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const setRelationship = async (value) => {
    setContact((c) => c && { ...c, relationship: value });
    const { error } = await supabase.from("contacts").update({ relationship: value }).eq("id", contactId);
    if (error) load();
    else onChange?.();
  };
  const addTag = async (tag) => {
    if (!tag || tagIds.includes(tag.id)) return;
    setTagIds((l) => [...l, tag.id]);
    const { error } = await supabase.from("contact_tag_links").upsert({ contact_id: contactId, tag_id: tag.id }, { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
    if (error) load();
    else onChange?.();
  };
  const createTag = async (name) => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return null;
    const have = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (have) return have;
    const { data, error } = await supabase.from("contact_tags").insert({ name: clean }).select("*").single();
    if (error) {
      await load();
      return null;
    }
    setTags((l) => [...l, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };
  const removeTag = async (tagId) => {
    setTagIds((l) => l.filter((x) => x !== tagId));
    const { error } = await supabase.from("contact_tag_links").delete().eq("contact_id", contactId).eq("tag_id", tagId);
    if (error) load();
    else onChange?.();
  };

  return { contact, tags, tagIds, tagById, setRelationship, addTag, createTag, removeTag, reload: load };
}
