import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./useAuth";

// The signed-in agent's whole contact database in memory (it is private to them, so row-level security already limits it), with its
// tags, which Leads/Pipeline/Transactions cards each person is on, their open follow-ups, and saved smart lists. Searching,
// filtering and sorting then happen instantly in the browser. Changes show at once and are saved behind the scenes.
// Supabase caps one response at 1000 rows no matter the limit, so a big database has to be read a page at a time.
async function fetchAll(query) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query().range(from, from + 999);
    if (error) return { data: out, error };
    out.push(...data);
    if (data.length < 1000) return { data: out, error: null };
  }
}

export function useContacts() {
  const { user } = useAuth();
  const [contacts, setContacts] = useState([]);
  const [tags, setTags] = useState([]);
  const [links, setLinks] = useState([]); // { contact_id, tag_id }
  const [cards, setCards] = useState([]); // { id, contact_id, stage_group, stage }
  const [tasks, setTasks] = useState([]); // open follow-ups tied to a contact
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [c, t, l, p, k, s] = await Promise.all([
      fetchAll(() => supabase.from("contacts").select("*").order("created_at", { ascending: false }).order("id")),
      supabase.from("contact_tags").select("*").order("name"),
      fetchAll(() => supabase.from("contact_tag_links").select("contact_id, tag_id").order("contact_id").order("tag_id")),
      fetchAll(() => supabase.from("people").select("id, contact_id, stage_group, stage, archived").eq("owner_id", user?.id).not("contact_id", "is", null).eq("archived", false).order("id")),
      fetchAll(() => supabase.from("agent_tasks").select("id, contact_id, title, due_date, recurrence").not("contact_id", "is", null).eq("done", false).order("id")),
      supabase.from("contact_smart_lists").select("*").order("created_at"),
    ]);
    const err = c.error || t.error || l.error || p.error || k.error || s.error;
    if (err) setError(err.message);
    else setError("");
    setContacts(c.data || []);
    setTags(t.data || []);
    setLinks(l.data || []);
    setCards(p.data || []);
    setTasks(k.data || []);
    setLists(s.data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) load();
  }, [user?.id, load]);

  const ctx = useMemo(() => {
    const tagsByContact = new Map();
    for (const l of links) tagsByContact.set(l.contact_id, [...(tagsByContact.get(l.contact_id) || []), l.tag_id]);
    const boardsByContact = new Map();
    for (const p of cards) boardsByContact.set(p.contact_id, new Set([...(boardsByContact.get(p.contact_id) || []), p.stage_group]));
    const nextTaskByContact = new Map();
    for (const k of tasks) {
      const d = k.due_date || "9999-12-31";
      if (!nextTaskByContact.has(k.contact_id) || d < nextTaskByContact.get(k.contact_id)) nextTaskByContact.set(k.contact_id, k.due_date || "");
    }
    return { tagsByContact, boardsByContact, nextTaskByContact, tagById: new Map(tags.map((t) => [t.id, t])) };
  }, [links, cards, tasks, tags]);

  const fail = (e) => {
    setError(e.message);
    load();
    return false;
  };

  const addContact = async (fields) => {
    const { data, error: e } = await supabase.from("contacts").insert(fields).select("*").single();
    if (e) return { error: e.message };
    setContacts((l) => [data, ...l]);
    return { contact: data };
  };

  const updateContact = async (id, changes) => {
    setContacts((l) => l.map((c) => (c.id === id ? { ...c, ...changes } : c)));
    const { error: e } = await supabase.from("contacts").update(changes).eq("id", id);
    return e ? fail(e) : true;
  };

  const updateMany = async (ids, changes) => {
    setContacts((l) => l.map((c) => (ids.includes(c.id) ? { ...c, ...changes } : c)));
    for (let i = 0; i < ids.length; i += 100) {
      const { error: e } = await supabase.from("contacts").update(changes).in("id", ids.slice(i, i + 100));
      if (e) return fail(e);
    }
    return true;
  };

  const deleteContact = async (id) => {
    setContacts((l) => l.filter((c) => c.id !== id));
    const { error: e } = await supabase.from("contacts").delete().eq("id", id);
    return e ? fail(e) : true;
  };

  // A tag by name: the existing one, or a new one. Returns the tag.
  const ensureTag = async (name, color = "gray") => {
    const clean = name.trim().slice(0, 40);
    if (!clean) return null;
    const have = tags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    if (have) return have;
    const { data, error: e } = await supabase.from("contact_tags").insert({ name: clean, color }).select("*").single();
    if (e) {
      // Someone (another tab) made it a moment ago.
      await load();
      return null;
    }
    setTags((l) => [...l, data].sort((a, b) => a.name.localeCompare(b.name)));
    return data;
  };

  const tagMany = async (contactIds, tagId) => {
    const rows = contactIds.filter((cid) => !links.some((l) => l.contact_id === cid && l.tag_id === tagId)).map((contact_id) => ({ contact_id, tag_id: tagId }));
    if (!rows.length) return true;
    setLinks((l) => [...l, ...rows]);
    for (let i = 0; i < rows.length; i += 500) {
      const { error: e } = await supabase.from("contact_tag_links").upsert(rows.slice(i, i + 500), { onConflict: "contact_id,tag_id", ignoreDuplicates: true });
      if (e) return fail(e);
    }
    return true;
  };

  const untagMany = async (contactIds, tagId) => {
    setLinks((l) => l.filter((x) => !(x.tag_id === tagId && contactIds.includes(x.contact_id))));
    for (let i = 0; i < contactIds.length; i += 100) {
      const { error: e } = await supabase.from("contact_tag_links").delete().eq("tag_id", tagId).in("contact_id", contactIds.slice(i, i + 100));
      if (e) return fail(e);
    }
    return true;
  };

  const updateTag = async (id, changes) => {
    setTags((l) => l.map((t) => (t.id === id ? { ...t, ...changes } : t)));
    const { error: e } = await supabase.from("contact_tags").update(changes).eq("id", id);
    return e ? fail(e) : true;
  };

  const deleteTag = async (id) => {
    setTags((l) => l.filter((t) => t.id !== id));
    setLinks((l) => l.filter((x) => x.tag_id !== id));
    const { error: e } = await supabase.from("contact_tags").delete().eq("id", id);
    return e ? fail(e) : true;
  };

  const saveList = async (name, filters) => {
    const { data, error: e } = await supabase.from("contact_smart_lists").insert({ name: name.trim().slice(0, 60), filters }).select("*").single();
    if (e) return fail(e);
    setLists((l) => [...l, data]);
    return true;
  };

  const deleteList = async (id) => {
    setLists((l) => l.filter((x) => x.id !== id));
    const { error: e } = await supabase.from("contact_smart_lists").delete().eq("id", id);
    return e ? fail(e) : true;
  };

  const merge = async (keepId, removeId) => {
    const { error: e } = await supabase.rpc("merge_contacts", { p_keep: keepId, p_remove: removeId });
    if (e) return { error: e.message };
    await load();
    return {};
  };

  return { contacts, tags, cards, tasks, ctx, lists, loading, error, reload: load, addContact, updateContact, updateMany, deleteContact, ensureTag, tagMany, untagMany, updateTag, deleteTag, saveList, deleteList, merge };
}
