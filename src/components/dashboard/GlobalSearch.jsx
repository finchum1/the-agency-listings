import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { dealAccess, boardPath } from "../../lib/deals";
import { dashboardGo } from "../../lib/dashboardGo";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";

// What the search can take you straight to, by what this person may open. A page matches on its name.
function pageList(profile, isAdmin, limited) {
  const deals = dealAccess(profile);
  const people = Boolean(profile?.people_enabled) && !limited;
  const site = (profile?.site_access || "full") !== "none" && !limited;
  const pages = [{ label: "Home", to: "/dashboard" }];
  if (site) pages.push({ label: "Site details", to: "/dashboard/site/details" }, { label: "Blog posts", to: "/dashboard/site/blog" }, { label: "Site analytics", to: "/dashboard/site/analytics" });
  if (people) pages.push({ label: "People overview", to: "/dashboard/people/overview" }, { label: "Contacts", to: "/dashboard/people/contacts" }, { label: "Leads", to: "/dashboard/people/leads" }, { label: "Pipeline", to: "/dashboard/people/pipeline" });
  if (deals.any && !limited) pages.push({ label: "Deals", to: "/dashboard/deals" });
  pages.push({ label: "Listings", to: "/dashboard/listings" }, { label: "Upcoming", to: "/dashboard/upcoming" }, { label: "Vendors", to: "/dashboard/vendors" }, { label: "My profile", to: "/dashboard/profile" });
  if (isAdmin) pages.push({ label: "Agents", to: "/dashboard/agents" }, { label: "Agent sites", to: "/dashboard/sites" }, { label: "Office analytics", to: "/dashboard/office-analytics" }, { label: "Brand", to: "/dashboard/brand" });
  return pages;
}

// PostgREST's `or` filter splits on commas and parentheses and treats % as a wildcard, so those are taken out of what was typed.
const clean = (q) => q.replace(/[,()%\\*]/g, " ").replace(/\s+/g, " ").trim();
const like = (cols, q) => cols.map((c) => `${c}.ilike.%${q}%`).join(",");
const fullName = (c) => [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company || c.email || "Unnamed contact";
const BOARD_LABEL = { lead: "Lead", pipeline: "Pipeline", transaction: "Deal" };

// One search over the whole dashboard: people (leads, pipeline, deals), contacts, listings, vendors, blog posts, and the pages themselves. What comes
// back is whatever this person can already read (the database decides), so nobody finds anything they couldn't open.
export default function GlobalSearch({ open, onClose, limited = false }) {
  const { profile, user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [found, setFound] = useState({ people: [], contacts: [], listings: [], vendors: [], posts: [] });
  const [busy, setBusy] = useState(false);
  const [cursor, setCursor] = useState(0);
  const input = useRef(null);
  const listRef = useRef(null);
  const wantsPeople = Boolean(profile?.people_enabled) && !limited;
  const wantsDeals = dealAccess(profile).any && !limited;
  const wantsSite = (profile?.site_access || "full") !== "none" && !limited;

  useEffect(() => {
    if (open) {
      setQ("");
      setFound({ people: [], contacts: [], listings: [], vendors: [], posts: [] });
      setCursor(0);
      setTimeout(() => input.current?.focus(), 30);
    }
  }, [open]);

  const term = clean(q);
  useEffect(() => {
    if (!open || term.length < 2) {
      setFound({ people: [], contacts: [], listings: [], vendors: [], posts: [] });
      setBusy(false);
      return undefined;
    }
    let live = true;
    setBusy(true);
    const timer = setTimeout(async () => {
      const [people, contacts, listings, vendors, posts] = await Promise.all([
        wantsPeople || wantsDeals
          ? supabase.from("people").select("id, owner_id, name, email, phone, property_address, stage_group, stage").eq("archived", false).or(like(["name", "email", "phone", "property_address"], term)).limit(8)
          : { data: [] },
        wantsPeople ? supabase.from("contacts").select("id, first_name, last_name, company, email, phone").eq("owner_id", user?.id).eq("archived", false).ilike("search_text", `%${term}%`).limit(6) : { data: [] },
        supabase.from("listings").select("id, address_line1, city, status, mls_number").or(like(["address_line1", "city", "mls_number"], term)).limit(6),
        supabase.from("vendors").select("id, name, category, contact_name").or(like(["name", "contact_name", "category", "email", "phone"], term)).limit(6),
        wantsSite ? supabase.from("agent_site_posts").select("id, title, status").ilike("title", `%${term}%`).limit(5) : { data: [] },
      ]);
      if (!live) return;
      setFound({ people: (people.data || []).filter((p) => (p.stage_group === "transaction" ? wantsDeals : wantsPeople)), contacts: contacts.data || [], listings: listings.data || [], vendors: vendors.data || [], posts: posts.data || [] });
      setBusy(false);
      setCursor(0);
    }, 220);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [term, open, wantsPeople, wantsDeals, wantsSite, user?.id]);

  // The rows, in the order they show, each with where it goes.
  const groups = useMemo(() => {
    const out = [];
    const mine = (p) => p.owner_id === user?.id;
    if (found.people.length)
      out.push({
        title: "People and deals",
        rows: found.people.map((p) => ({
          key: `p${p.id}`,
          primary: p.stage_group === "transaction" ? p.property_address || p.name : p.name,
          secondary: [BOARD_LABEL[p.stage_group], p.stage_group === "transaction" && p.property_address ? p.name : "", p.stage_group === "transaction" && !mine(p) ? "you coordinate" : "", p.email || p.phone].filter(Boolean).join(" · "),
          to: p.stage_group === "transaction" ? `/dashboard/deals?deal=${p.id}` : `${boardPath(p.stage_group)}?person=${p.id}`,
        })),
      });
    if (found.contacts.length) out.push({ title: "Contacts", rows: found.contacts.map((c) => ({ key: `c${c.id}`, primary: fullName(c), secondary: [c.company && fullName(c) !== c.company ? c.company : "", c.email || c.phone].filter(Boolean).join(" · "), to: `/dashboard/people/contacts?contact=${c.id}` })) });
    if (found.listings.length) out.push({ title: "Listings", rows: found.listings.map((l) => ({ key: `l${l.id}`, primary: l.address_line1 || "Listing", secondary: [l.city, l.status, l.mls_number].filter(Boolean).join(" · "), to: `/dashboard/listings/${l.id}/edit` })) });
    if (found.vendors.length) out.push({ title: "Vendors", rows: found.vendors.map((v) => ({ key: `v${v.id}`, primary: v.name, secondary: [v.category, v.contact_name].filter(Boolean).join(" · "), to: `/dashboard/vendors?q=${encodeURIComponent(v.name)}` })) });
    if (found.posts.length) out.push({ title: "Blog posts", rows: found.posts.map((b) => ({ key: `b${b.id}`, primary: b.title, secondary: b.status, to: `/dashboard/site/blog?edit=${b.id}` })) });
    const pages = pageList(profile, isAdmin, limited).filter((pg) => !term || pg.label.toLowerCase().includes(term.toLowerCase()));
    if (pages.length) out.push({ title: term ? "Pages" : "Go to", rows: pages.slice(0, term ? 5 : 20).map((pg) => ({ key: `g${pg.to}`, primary: pg.label, secondary: "", to: pg.to })) });
    return out;
  }, [found, term, profile, isAdmin, limited, user?.id]);
  const rows = groups.flatMap((g) => g.rows);

  const go = (row) => {
    onClose();
    dashboardGo(navigate, row.to);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(rows.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && rows[cursor]) {
      e.preventDefault();
      go(rows[cursor]);
    } else if (e.key === "Escape") onClose();
  };
  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor, rows.length]);

  if (!open) return null;
  let index = -1;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh] print:hidden" role="dialog" aria-modal="true" aria-label="Search the dashboard">
      <button type="button" aria-label="Close search" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] shadow-2xl">
        <div className="flex items-center gap-3 border-b border-black/10 dark:border-white/10 px-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className={`shrink-0 ${muted}`} aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4.5 4.5" />
          </svg>
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Search people, deals, contacts, listings, vendors, posts…"
            aria-label="Search"
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-[#1c1a17]/40 dark:placeholder:text-[#faf9f7]/40"
          />
          {busy && <span className={`text-xs ${muted}`}>Searching…</span>}
          <kbd className="rounded-md border border-black/10 dark:border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[56vh] overflow-y-auto overscroll-contain p-2">
          {rows.length === 0 && !busy && term.length >= 2 && <p className={`px-3 py-6 text-center text-sm ${muted}`}>Nothing found for “{q.trim()}”.</p>}
          {term.length === 1 && <p className={`px-3 py-2 text-xs ${muted}`}>Keep typing…</p>}
          {groups.map((g) => (
            <div key={g.title} className="mb-1">
              <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{g.title}</p>
              {g.rows.map((row) => {
                index += 1;
                const active = index === cursor;
                const i = index;
                return (
                  <button
                    key={row.key}
                    type="button"
                    data-active={active}
                    onMouseMove={() => setCursor(i)}
                    onClick={() => go(row)}
                    className={`flex w-full items-baseline justify-between gap-4 rounded-lg px-3 py-2 text-left transition-colors ${active ? "bg-black/5 dark:bg-white/10" : ""}`}
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{row.primary}</span>
                    {row.secondary && <span className={`min-w-0 max-w-[55%] truncate text-xs ${muted}`}>{row.secondary}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
