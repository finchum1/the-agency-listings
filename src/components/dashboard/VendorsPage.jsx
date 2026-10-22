import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import { matchesSearch } from "../../lib/searchMatch";
import { DEFAULT_VENDOR_CATEGORIES, compareCategories, groupByCategory, listText, mailHref, smsHref, telHref, vendorText, websiteHref } from "../../lib/vendors";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const chipBase = "shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors";
const quietBtn = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const EMPTY = { category: "", name: "", contact_name: "", phone: "", email: "", website: "", notes: "" };

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = async (key, text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? "" : c)), 1800);
  };
  return [copied, copy];
}

function VendorForm({ initial, categories, saving, error, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY, ...initial });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-5 space-y-3"
    >
      <h2 className="font-display text-lg font-semibold">{initial?.id ? "Edit vendor" : "Add a vendor"}</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs font-medium">
          Category
          <input required list="vendor-categories" value={form.category} onChange={set("category")} placeholder="Pick one or type a new one" className={`${inputClass} mt-1`} />
          <datalist id="vendor-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
        <label className="block text-xs font-medium">
          Company or name
          <input required value={form.name} onChange={set("name")} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium">
          Contact person <span className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40">(optional)</span>
          <input value={form.contact_name} onChange={set("contact_name")} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium">
          Phone
          <input type="tel" value={form.phone} onChange={set("phone")} placeholder="(405) 555-0123" className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium">
          Email
          <input type="email" value={form.email} onChange={set("email")} className={`${inputClass} mt-1`} />
        </label>
        <label className="block text-xs font-medium">
          Website
          <input value={form.website} onChange={set("website")} placeholder="example.com" className={`${inputClass} mt-1`} />
        </label>
      </div>
      <label className="block text-xs font-medium">
        Notes <span className="text-[#1c1a17]/40 dark:text-[#faf9f7]/40">(shown to clients too)</span>
        <textarea rows={2} value={form.notes} onChange={set("notes")} className={`${inputClass} mt-1`} />
      </label>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {saving ? "Saving…" : "Save vendor"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
          Cancel
        </button>
      </div>
    </form>
  );
}

function VendorCard({ v, selected, onSelect, isAdmin, onEdit, onDelete, from }) {
  const [copied, copy] = useCopy();
  const text = vendorText(v, { from });
  const subject = `${v.category} recommendation: ${v.name}`;
  return (
    <li className={`rounded-xl border p-4 bg-white dark:bg-[#1a1a1a] ${selected ? "border-[#ed2127] dark:border-[#f2454b]" : "border-black/10 dark:border-white/10"}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={() => onSelect(v.id)} aria-label={`Select ${v.name}`} className="mt-1 h-4 w-4 accent-[#ed2127] shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug">{v.name}</p>
          {v.contact_name && <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{v.contact_name}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {v.phone && (
              <a href={telHref(v.phone)} className="text-[#ed2127] dark:text-[#f2454b] font-medium hover:underline">
                {v.phone}
              </a>
            )}
            {v.email && (
              <a href={`mailto:${v.email}`} className="hover:underline break-all">
                {v.email}
              </a>
            )}
            {v.website && (
              <a href={websiteHref(v.website)} target="_blank" rel="noreferrer" className="hover:underline break-all">
                {v.website.replace(/^https?:\/\//i, "")}
              </a>
            )}
            {!v.phone && !v.email && !v.website && <span className="text-[#1c1a17]/45 dark:text-[#faf9f7]/45">No contact details yet</span>}
          </div>
          {v.notes && <p className="mt-1.5 text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60">{v.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => copy(v.id, text)} className={quietBtn}>
              {copied === v.id ? "Copied ✓" : "Copy"}
            </button>
            <a href={smsHref(text)} className={quietBtn}>
              Text
            </a>
            <a href={mailHref(subject, text)} className={quietBtn}>
              Email
            </a>
            {isAdmin && (
              <>
                <button type="button" onClick={() => onEdit(v)} className={quietBtn}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete(v)} className={`${quietBtn} text-red-600 dark:text-red-400`}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

// Dashboard > Vendors: the office's preferred vendors, shared by everyone, edited by admins. Search by category or anything
// else; send one vendor, or tick several and send the list (as text, or as a private link the client can open).
export default function VendorsPage() {
  const { profile, isAdmin } = useAuth();
  const { orgId, brand, loading: orgLoading } = useOrg();
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // a vendor, EMPTY for a new one, or null
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [copied, copy] = useCopy();
  const [links, setLinks] = useState([]);
  const [linkBusy, setLinkBusy] = useState(false);
  const [freshLink, setFreshLink] = useState("");
  // The agent's own website address, if they have one: client links can use it instead of the app's address.
  const [siteDomain, setSiteDomain] = useState("");
  const [useSiteDomain, setUseSiteDomain] = useState(() => {
    try {
      return localStorage.getItem("vendor_link_host") !== "app";
    } catch {
      return true;
    }
  });

  const load = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase.from("vendors").select("*").eq("org_id", orgId).order("name");
    setVendors(data || []);
    setLoading(false);
  }, [orgId]);
  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) setLoading(false);
    load();
  }, [orgId, orgLoading, load]);

  useEffect(() => {
    if (!profile?.id) return;
    supabase
      .from("agent_sites")
      .select("custom_domain")
      .eq("agent_id", profile.id)
      .not("custom_domain", "is", null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSiteDomain(data?.custom_domain || ""));
  }, [profile?.id]);

  const loadLinks = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from("vendor_share_links")
      .select("id, title, token_hint, vendor_ids, created_at, expires_at, revoked_at, view_count, last_viewed_at")
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLinks(data || []);
  }, [orgId]);
  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const categories = useMemo(() => [...new Set([...DEFAULT_VENDOR_CATEGORIES, ...vendors.map((v) => v.category.trim())])].sort(compareCategories), [vendors]);
  const counts = useMemo(() => {
    const m = new Map();
    for (const v of vendors) m.set(v.category.trim(), (m.get(v.category.trim()) || 0) + 1);
    return m;
  }, [vendors]);
  const withVendors = categories.filter((c) => counts.get(c));

  const visible = vendors.filter((v) => (!category || v.category.trim() === category) && matchesSearch([v.category, v.name, v.contact_name, v.phone, v.email, v.website, v.notes], query));
  const groups = groupByCategory(visible);
  const chosen = vendors.filter((v) => selected.has(v.id));
  const from = profile?.full_name || "";

  const toggle = (id) =>
    setSelected((s) => {
      setFreshLink("");
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const selectGroup = (g) =>
    setSelected((s) => {
      setFreshLink("");
      const n = new Set(s);
      const all = g.vendors.every((v) => n.has(v.id));
      g.vendors.forEach((v) => (all ? n.delete(v.id) : n.add(v.id)));
      return n;
    });

  const save = async (form) => {
    setSaving(true);
    setError("");
    const row = Object.fromEntries(Object.entries(form).filter(([k]) => k !== "id").map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
    const q = form.id ? supabase.from("vendors").update(row).eq("id", form.id) : supabase.from("vendors").insert({ ...row, org_id: orgId, created_by: profile?.id });
    const { error: err } = await q;
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setEditing(null);
    load();
  };

  const remove = async (v) => {
    if (!confirm(`Delete “${v.name}” from ${v.category}? Everyone will lose it, and it disappears from client links.`)) return;
    const { error: err } = await supabase.from("vendors").delete().eq("id", v.id);
    if (err) {
      alert(err.message);
      return;
    }
    setSelected((s) => {
      const n = new Set(s);
      n.delete(v.id);
      return n;
    });
    load();
  };

  const makeLink = async () => {
    setLinkBusy(true);
    const { data, error: err } = await supabase.rpc("create_vendor_share_link", { p_vendor_ids: chosen.map((v) => v.id), p_title: from ? `Recommended by ${from}` : "" });
    setLinkBusy(false);
    if (err) {
      alert(err.message);
      return;
    }
    const origin = siteDomain && useSiteDomain ? `https://${siteDomain}` : window.location.origin;
    const url = `${origin}/vendors/${data}`;
    setFreshLink(url);
    copy("fresh", url);
    loadLinks();
  };
  const revoke = async (l) => {
    if (!confirm("Turn this link off? Anyone who has it will see an expired page.")) return;
    await supabase.rpc("revoke_vendor_share_link", { p_id: l.id });
    loadLinks();
  };

  const bodyText = () => listText(chosen, { from, orgName: brand?.name, link: freshLink });
  const chip = (active) => `${chipBase} ${active ? "bg-[#1c1a17] text-white border-[#1c1a17] dark:bg-[#f2454b] dark:border-[#f2454b]" : "border-black/10 dark:border-white/15 hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"}`;

  return (
    <div className={chosen.length ? "pb-28" : ""}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-display font-semibold">Vendors</h1>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">Our preferred vendors. Tick the ones you want and send them to a client.</p>
        </div>
        {isAdmin && !editing && (
          <button type="button" onClick={() => setEditing({ ...EMPTY, category })} className="shrink-0 rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5">
            + Add vendor
          </button>
        )}
      </div>

      {editing && (
        <div className="mb-6">
          <VendorForm key={editing.id || "new"} initial={editing} categories={categories} saving={saving} error={error} onSave={save} onCancel={() => { setEditing(null); setError(""); }} />
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by category, name, phone, or anything else"
          aria-label="Search vendors"
          className={inputClass}
        />
        {(query.trim() || category) && !loading && (
          <span className="shrink-0 text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
            {visible.length} of {vendors.length}
          </span>
        )}
      </div>

      <div className="mb-5 -mx-1 px-1 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by category">
        <button type="button" onClick={() => setCategory("")} className={chip(!category)}>
          All <span className="opacity-60">{vendors.length}</span>
        </button>
        {withVendors.map((c) => (
          <button key={c} type="button" onClick={() => setCategory(category === c ? "" : c)} className={chip(category === c)}>
            {c} <span className="opacity-60">{counts.get(c)}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
          {vendors.length === 0 ? "No vendors yet." : <>No vendors match. <button type="button" onClick={() => { setQuery(""); setCategory(""); }} className="font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline">Clear search</button></>}
        </p>
      ) : (
        <div className="space-y-7">
          {groups.map((g) => (
            <section key={g.category} aria-label={g.category}>
              <div className="flex items-baseline justify-between mb-2">
                <h2 className="font-display text-lg font-semibold">{g.category}</h2>
                <button type="button" onClick={() => selectGroup(g)} className="text-xs font-semibold text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:underline">
                  {g.vendors.every((v) => selected.has(v.id)) ? "Unselect all" : "Select all"}
                </button>
              </div>
              <ul className="grid md:grid-cols-2 gap-3">
                {g.vendors.map((v) => (
                  <VendorCard key={v.id} v={v} from={from} selected={selected.has(v.id)} onSelect={toggle} isAdmin={isAdmin} onEdit={(x) => { setEditing(x); window.scrollTo({ top: 0, behavior: "smooth" }); }} onDelete={remove} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <section className="mt-10 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-5">
          <h2 className="font-display text-lg font-semibold">Links you've sent</h2>
          <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55 mt-1">Each link shows only the vendors you picked, and stops working after 90 days or when you turn it off.</p>
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
            {links.map((l) => (
              <li key={l.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0">
                  {l.vendor_ids.length} vendor{l.vendor_ids.length === 1 ? "" : "s"} · made {new Date(l.created_at).toLocaleDateString()} · opened {l.view_count} time{l.view_count === 1 ? "" : "s"}
                </span>
                <button type="button" onClick={() => revoke(l)} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                  Turn off
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {chosen.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/10 dark:border-white/15 bg-white/95 dark:bg-[#141414]/95 backdrop-blur px-4 py-3 md:left-auto md:right-6 md:bottom-6 md:inset-x-auto md:rounded-2xl md:border md:shadow-xl" role="region" aria-label="Send selected vendors">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold mr-1">{chosen.length} selected</span>
            <button type="button" onClick={() => copy("list", bodyText())} className={quietBtn}>
              {copied === "list" ? "Copied ✓" : "Copy list"}
            </button>
            <a href={smsHref(bodyText())} className={quietBtn}>
              Text
            </a>
            <a href={mailHref(`Vendors I recommend${from ? ` — ${from}` : ""}`, bodyText())} className={quietBtn}>
              Email
            </a>
            <button type="button" disabled={linkBusy} onClick={makeLink} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-1.5 disabled:opacity-50">
              {linkBusy ? "Making…" : copied === "fresh" ? "Link copied ✓" : "Make client link"}
            </button>
            <button type="button" onClick={() => { setSelected(new Set()); setFreshLink(""); }} className="text-xs font-semibold text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:underline">
              Clear
            </button>
          </div>
          {siteDomain && (
            <label className="mt-2 flex items-center gap-2 text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
              <input
                type="checkbox"
                checked={useSiteDomain}
                onChange={(e) => {
                  setUseSiteDomain(e.target.checked);
                  setFreshLink("");
                  try {
                    localStorage.setItem("vendor_link_host", e.target.checked ? "site" : "app");
                  } catch {
                    /* storage blocked: the choice just won't persist */
                  }
                }}
                className="h-3.5 w-3.5 accent-[#ed2127]"
              />
              Send the link from {siteDomain}
            </label>
          )}
          {freshLink && (
            <p className="mt-2 text-xs break-all text-[#1c1a17]/60 dark:text-[#faf9f7]/60">
              Copied to your clipboard: <span className="font-mono select-all">{freshLink}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
