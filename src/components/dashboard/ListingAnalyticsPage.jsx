import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useListing } from "../../hooks/useListing";
import { useListingAnalytics } from "../../hooks/useListingAnalytics";
import { RANGES, SHARE_CHANNELS, listingUrl } from "../../lib/listingAnalytics";
import ListingAnalyticsView from "./ListingAnalyticsView";
import TrackedLinks, { useCopy } from "./TrackedLinks";

const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5";
const quietBtn = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";

// Private, no-sign-in links the agent sends the seller.
function SellerReports({ listing }) {
  const [links, setLinks] = useState([]);
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [copied, copy] = useCopy();
  // The listing agent's own website address, if they have one: report links can be sent from it instead of the app's address.
  const [siteDomain, setSiteDomain] = useState("");
  const [useSiteDomain, setUseSiteDomain] = useState(() => {
    try {
      return localStorage.getItem("report_link_host") !== "app";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    supabase
      .from("agent_sites")
      .select("custom_domain")
      .eq("agent_id", listing.agent_id)
      .not("custom_domain", "is", null)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setSiteDomain(data?.custom_domain || ""));
  }, [listing.agent_id]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("listing_report_links")
      .select("id, token_hint, created_at, expires_at, view_count, last_viewed_at")
      .eq("listing_id", listing.id)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });
    setLinks(data || []);
  }, [listing.id]);
  useEffect(() => {
    load();
  }, [load]);

  const create = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("create_listing_report_link", { p_listing_id: listing.id });
    setBusy(false);
    if (error) {
      alert(error.message);
      return;
    }
    const origin = siteDomain && useSiteDomain ? `https://${siteDomain}` : window.location.origin;
    const url = `${origin}/report/${data}`;
    setFresh(url);
    copy("fresh", url);
    load();
  };
  const revoke = async (l) => {
    if (!confirm("Turn this link off? Anyone who has it will see an expired page.")) return;
    await supabase.rpc("revoke_listing_report_link", { p_id: l.id });
    if (fresh) setFresh("");
    load();
  };
  const mail = fresh
    ? `mailto:?subject=${encodeURIComponent(`Online activity for ${listing.address_line1}`)}&body=${encodeURIComponent(`Here's a live report of the online activity for ${listing.address_line1}: visitors, where they're coming from, and what they're looking at. It updates automatically.\n\n${fresh}`)}`
    : "";

  return (
    <div className={card}>
      <h3 className="font-display text-base font-semibold">Seller report</h3>
      <p className={`text-xs mt-1 ${muted}`}>A private page the seller can open any time, with no login. It shows these numbers for this listing and updates on its own, and it never shows inquiry names or contact details.</p>
      <div className="mt-3 flex flex-wrap gap-2 items-center">
        <button type="button" onClick={create} disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50">
          {busy ? "Making…" : "Create report link"}
        </button>
        {fresh && (
          <>
            <button type="button" onClick={() => copy("fresh", fresh)} className={quietBtn}>
              {copied === "fresh" ? "Copied ✓" : "Copy link"}
            </button>
            <a href={mail} className={quietBtn}>
              Email to seller
            </a>
            <a href={fresh} target="_blank" rel="noreferrer" className={quietBtn}>
              Preview
            </a>
          </>
        )}
      </div>
      {siteDomain && (
        <label className={`mt-2 flex items-center gap-2 text-xs ${muted}`}>
          <input
            type="checkbox"
            checked={useSiteDomain}
            onChange={(e) => {
              setUseSiteDomain(e.target.checked);
              setFresh("");
              try {
                localStorage.setItem("report_link_host", e.target.checked ? "site" : "app");
              } catch {
                /* storage blocked: the choice just won't persist */
              }
            }}
            className="h-3.5 w-3.5 accent-[#ed2127]"
          />
          Send the link from {siteDomain}
        </label>
      )}
      {fresh && <p className="mt-2 text-xs break-all font-mono select-all">{fresh}</p>}
      {links.length > 0 && (
        <ul className="mt-4 divide-y divide-black/5 dark:divide-white/10">
          {links.map((l) => (
            <li key={l.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0">
                Link …{l.token_hint} · made {new Date(l.created_at).toLocaleDateString()} · opened {l.view_count} time{l.view_count === 1 ? "" : "s"} · expires {new Date(l.expires_at).toLocaleDateString()}
              </span>
              <button type="button" onClick={() => revoke(l)} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                Turn off
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className={`mt-3 text-xs ${muted}`}>A link's full address is only shown when you create it. If you lose one, make a new link and turn the old one off.</p>
    </div>
  );
}

// A Monday-morning email to the listing's agent with last week's visits (api/weekly-reports.js). Off until turned on, per listing.
function WeeklyEmail({ listing, onChanged }) {
  const [on, setOn] = useState(Boolean(listing.weekly_report));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const live = ["coming_soon", "for_sale", "pending"].includes(listing.status);

  const toggle = async () => {
    const next = !on;
    setOn(next);
    setNote("");
    const { error } = await supabase.from("listings").update({ weekly_report: next }).eq("id", listing.id);
    if (error) {
      setOn(!next);
      setNote(error.message);
    } else onChanged?.();
  };
  const sendNow = async () => {
    setBusy(true);
    setNote("");
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/weekly-reports", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` }, body: JSON.stringify({ listingId: listing.id }) });
      const out = await res.json().catch(() => ({}));
      setNote(res.ok ? "Sent. Check your email." : out.error || "That didn't send.");
    } catch {
      setNote("That didn't send.");
    }
    setBusy(false);
  };

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-base font-semibold">Weekly email</h3>
          <p className={`text-xs mt-1 ${muted}`}>Every Monday morning, an email to you with last week's views, visitors, where they came from and what they did.</p>
        </div>
        <button type="button" role="switch" aria-checked={on} aria-label="Weekly email" onClick={toggle} className={`relative shrink-0 h-7 w-12 rounded-full transition-colors ${on ? "bg-[#ed2127] dark:bg-[#f2454b]" : "bg-black/20 dark:bg-white/25"}`}>
          <span className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
      </div>
      <p className={`mt-3 text-xs ${muted}`}>
        {on ? "On." : "Off."}{" "}
        {on && !live ? "Emails only go out while the listing is Coming Soon, For Sale or Pending. " : ""}
        {listing.weekly_report_sent_at ? `Last one sent ${new Date(listing.weekly_report_sent_at).toLocaleDateString()}.` : ""}
      </p>
      <div className="mt-3 flex items-center gap-3 flex-wrap">
        <button type="button" onClick={sendNow} disabled={busy} className={`${quietBtn} disabled:opacity-50`}>
          {busy ? "Sending…" : "Email me this week's report now"}
        </button>
        {note && <span className={`text-xs ${muted}`}>{note}</span>}
      </div>
    </div>
  );
}

// Dashboard > Listings > (a listing) > Analytics: everything the property site can tell us about its visitors.
export default function ListingAnalyticsPage() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { listing, loading, notFound } = useListing({ id });
  const [days, setDays] = useState(30);
  const { data, loading: dataLoading, error } = useListingAnalytics(listing?.id, days);

  if (loading && !listing) return <p className={`text-sm ${muted}`}>Loading…</p>;
  if (notFound || !listing || (!isAdmin && listing.agent_id !== user?.id)) {
    return (
      <div>
        <p className={`text-sm mb-4 ${muted}`}>Listing not found, or you don't have access to it.</p>
        <Link to="/dashboard/listings" className="text-sm text-[#ed2127] dark:text-[#f2454b] hover:underline">
          ← Back to listings
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <div className={`flex items-center gap-3 text-xs font-semibold ${muted}`}>
        <Link to="/dashboard/listings" className="hover:underline">
          ← All listings
        </Link>
        <span aria-hidden="true">/</span>
        <Link to={`/dashboard/listings/${listing.id}/edit`} className="hover:underline">
          {listing.address_line1}
        </Link>
      </div>
      <div className="mt-2 mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-display font-semibold">Analytics</h1>
          <p className={`text-sm mt-0.5 ${muted}`}>
            {listing.address_line1}, {listing.city}
          </p>
        </div>
        <div className="flex items-center rounded-full border border-black/10 dark:border-white/15 p-0.5 text-xs font-medium" role="group" aria-label="Time period">
          {RANGES.map((r) => (
            <button key={r.days} type="button" onClick={() => setDays(r.days)} className={`px-3 py-1.5 rounded-full transition-colors ${days === r.days ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white" : "text-[#1c1a17]/55 dark:text-[#faf9f7]/55 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : <ListingAnalyticsView data={data} loading={dataLoading} />}

      <div className="mt-5 grid md:grid-cols-2 gap-5 items-start">
        <TrackedLinks base={listingUrl(listing)} channels={SHARE_CHANNELS} />
        <div className="space-y-5">
          <SellerReports listing={listing} />
          <WeeklyEmail key={listing.id} listing={listing} />
        </div>
      </div>
      <p className={`mt-4 text-xs ${muted}`}>Visits while you're signed in to the dashboard aren't counted, so checking your own page never inflates these numbers. Known search and link-preview bots are left out too.</p>
    </div>
  );
}
