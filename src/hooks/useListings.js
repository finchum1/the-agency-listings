import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Dashboard list. RLS does NOT scope this to "my listings only" the way
// the comment here used to claim — listings_public_read_published (status
// <> 'draft', no owner check at all) is a second, ADDITIVE select policy
// that exists so the public /listings/:slug site can show anyone's
// published listing to anyone, including other logged-in agents just
// browsing. Since Postgres OR's multiple permissive policies together,
// that policy alone was enough for every agent's dashboard to list every
// *published* listing from every other agent too — not a security hole
// (published data is meant to be public) but very much not what an
// agent's own "Listings" tab should show. So the scoping has to happen
// here instead: pass agentId to see only that agent's listings, or leave
// it unset (admin) to see everything. `ready=false` skips fetching
// entirely — used by ListingsTable while auth is still resolving, so it
// never flashes an unfiltered list before narrowing down.
export function useListings({ agentId, ready = true } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!ready) return;
    setError(null);
    let query = supabase
      .from("listings")
      .select("*, agent:profiles(id, full_name, email)")
      .order("updated_at", { ascending: false });
    if (agentId) query = query.eq("agent_id", agentId);
    const { data, error } = await query;
    if (error) {
      console.error("Failed to load listings:", error);
      setError(error.message);
    } else {
      setListings(data || []);
    }
    setLoading(false);
  }, [agentId, ready]);

  useEffect(() => {
    if (!ready) return;
    refresh();

    const channel = supabase
      .channel("listings-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, ready]);

  return { listings, loading, error, refresh };
}
