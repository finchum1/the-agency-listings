import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Office-wide list — unlike useListings.js, there's no additive public
// read policy to work around here: upcoming_listings has exactly one
// select policy (any authenticated user), so a plain unfiltered query
// already returns exactly "everything I'm allowed to see" for every
// agent and admin alike. No agentId param needed.
export function useUpcomingListings() {
  const [upcomingListings, setUpcomingListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("upcoming_listings")
      .select("*, agent:profiles(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load upcoming listings:", error);
      setError(error.message);
    } else {
      setUpcomingListings(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("upcoming-listings-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "upcoming_listings" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { upcomingListings, loading, error, refresh };
}
