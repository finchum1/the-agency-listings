import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { useOrg } from "../../../context/OrgContext";
import { useIdxEnabled } from "../../../hooks/useIdxEnabled";
import { clientLink, describeSearch } from "../ClientSearches";

const muted = "text-[#1c1a17]/60 dark:text-[#faf9f7]/60";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3 py-1 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const day = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const money = (n) => (n == null || n === "" ? "" : `$${Number(n).toLocaleString("en-US")}`);
const FILTER_KEYS = ["city", "minPrice", "maxPrice", "minBeds", "minBaths", "sortBy"];
/** Home Search in the dashboard with a search's filters already set. */
const runHref = (params = {}, extra = {}) => {
  const q = new URLSearchParams();
  for (const k of FILTER_KEYS) if (params[k]) q.set(k, params[k]);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return `/dashboard/search${q.toString() ? `?${q}` : ""}`;
};

// One person's home searching, in one place: what they did on your website (signed in, searches they saved, homes they hearted) next to the searches
// you saved for them. Shown on a lead or pipeline person's Overview when the office has Home Search, or when there is anything to show.
export default function PersonSearches({ person }) {
  const { org } = useOrg();
  const idx = useIdxEnabled(org?.slug);
  const [activity, setActivity] = useState(null); // what the person did on the website, or null
  const [mine, setMine] = useState([]); // searches the agent saved for them
  const [copied, setCopied] = useState("");
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [{ data: a }, { data: m }] = await Promise.all([
      supabase.rpc("person_visitor_activity", { p_person_id: person.id }),
      supabase.from("client_searches").select("id, name, params, alerts, created_at").eq("person_id", person.id).order("created_at", { ascending: false }),
    ]);
    setActivity(a || null);
    setMine(m || []);
    setLoaded(true);
  }, [person.id]);
  useEffect(() => {
    load();
  }, [load]);

  const setAlerts = async (row, on) => {
    setMine((all) => all.map((x) => (x.id === row.id ? { ...x, alerts: on } : x)));
    const { error } = await supabase.from("client_searches").update({ alerts: on }).eq("id", row.id);
    if (error) setMine((all) => all.map((x) => (x.id === row.id ? { ...x, alerts: !on } : x)));
  };
  const copy = async (row) => {
    await navigator.clipboard.writeText(clientLink(row.params));
    setCopied(row.id);
    setTimeout(() => setCopied((c) => (c === row.id ? "" : c)), 1800);
  };

  if (!loaded || (!idx.enabled && !activity && mine.length === 0)) return null;
  const first = (person.name || "").trim().split(/\s+/)[0] || "them";
  const theirs = activity?.searches || [];
  const homes = activity?.favorites || [];

  return (
    <section aria-label="Home searches" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-xl font-semibold">Home searches</h3>
        {idx.enabled && (
          <Link to={runHref({}, { client: person.id, clientName: person.name })} className={quiet}>
            New search for {first}
          </Link>
        )}
      </div>

      {activity && (
        <p className={`text-sm ${muted}`}>
          {first} signed in to Home Search on your website{activity.visitor.joined ? ` on ${day(activity.visitor.joined)}` : ""}
          {activity.visitor.last_login ? `, last seen ${day(activity.visitor.last_login)}` : ""}.
          {activity.visitor.emails_off ? " They turned off the emails." : ""}
        </p>
      )}

      {theirs.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">Saved by {first}</p>
          <ul className="mt-1 divide-y divide-black/10 dark:divide-white/10">
            {theirs.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className={`truncate text-xs ${muted}`}>
                    {describeSearch(s.params)} · saved {day(s.saved)} · {s.alerts && !activity.visitor.emails_off ? "daily email on" : "no emails"}
                  </p>
                </div>
                <Link to={runHref(s.params)} className={quiet}>Run it</Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {homes.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">Homes {first} saved ({homes.length})</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {homes.map((f) => (
              <li key={f.mls} className="flex gap-2.5 text-xs">
                <span className="h-14 w-20 shrink-0 overflow-hidden rounded-lg bg-black/[0.05] dark:bg-white/[0.06]">{f.snapshot?.photo && <img src={f.snapshot.photo} alt="" loading="lazy" className="h-full w-full object-cover" />}</span>
                <span className="min-w-0">
                  <span className="block font-semibold">{money(f.snapshot?.price) || "Saved home"}</span>
                  <span className={`block truncate ${muted}`}>{f.snapshot?.address || `MLS# ${f.mls}`}</span>
                  <span className={`block truncate ${muted}`}>{[f.snapshot?.city, `saved ${day(f.saved)}`].filter(Boolean).join(" · ")}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {mine.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide">Your searches for {first}</p>
          <ul className="mt-1 divide-y divide-black/10 dark:divide-white/10">
            {mine.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className={`truncate text-xs ${muted}`}>{describeSearch(s.params)}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs" title="Each morning, check for new homes and tell you. Nothing is sent to the client.">
                  <input type="checkbox" checked={Boolean(s.alerts)} onChange={(e) => setAlerts(s, e.target.checked)} />
                  New matches daily
                </label>
                <Link to={runHref(s.params)} className={quiet}>Run</Link>
                <button type="button" onClick={() => copy(s)} className={quiet}>{copied === s.id ? "Copied" : "Copy client link"}</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!activity && mine.length === 0 && <p className={`text-sm ${muted}`}>No searches yet. Save one for {first} and they can follow it from your website.</p>}
    </section>
  );
}
