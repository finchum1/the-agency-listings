import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { upcomingHolidays } from "../../lib/holidayPost";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6";
const pill = "rounded-full border border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b] text-xs font-semibold px-4 py-2 hover:bg-[#ed2127] dark:hover:bg-[#f2454b] hover:text-white dark:hover:text-white transition-colors";
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// The Marketing module's home: the tools to make something to post. Social posts start from one of the agent's listings; holiday posts do not need one.
export default function MarketingHome() {
  const { user, isAdmin } = useAuth();
  const [listings, setListings] = useState([]);
  const [pick, setPick] = useState("");
  const next = upcomingHolidays(localToday()).slice(0, 2);

  useEffect(() => {
    if (!user) return;
    let query = supabase.from("listings").select("id, address_line1, city, status").neq("status", "off_market").order("created_at", { ascending: false }).limit(100);
    if (!isAdmin) query = query.eq("agent_id", user.id);
    query.then(({ data }) => {
      setListings(data || []);
      if (data?.[0]) setPick(data[0].id);
    });
  }, [user, isAdmin]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Marketing</h1>
        <p className={`mt-1 text-sm ${muted}`}>Make something to post or send. Start from a listing, or from a holiday.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="font-display text-lg font-semibold">Social posts for a listing</h2>
            <p className={`mt-1 text-sm ${muted}`}>New Listing, For Sale, Under Contract, Open House and Closed, as an Instagram square or a Story, in five layouts.</p>
          </div>
          {listings.length === 0 ? (
            <p className={`text-sm ${muted}`}>You have no listings yet.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Listing" className="min-w-0 flex-1 rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm">
                {listings.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.address_line1}
                    {l.city ? `, ${l.city}` : ""}
                  </option>
                ))}
              </select>
              <Link to={`/dashboard/listings/${pick}/social`} className={pill}>
                Make a post
              </Link>
            </div>
          )}
        </section>

        <section className={`${card} space-y-4`}>
          <div>
            <h2 className="font-display text-lg font-semibold">Holiday posts</h2>
            <p className={`mt-1 text-sm ${muted}`}>A greeting on your brand colors, with your logo and (if you like) your photo.</p>
          </div>
          <p className={`text-sm ${muted}`}>
            Coming up: {next.map((h) => `${h.name} (${new Date(`${h.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })})`).join(", ")}
          </p>
          <Link to="/dashboard/marketing/holiday" className={`${pill} inline-block`}>
            Make a holiday post
          </Link>
        </section>

      </div>
    </div>
  );
}
