import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Office-wide list — see useUpcomingListings.js's same comment. buyer_needs
// has exactly one select policy (any authenticated user), so no agentId
// scoping is needed here either.
export function useBuyerNeeds() {
  const [buyerNeeds, setBuyerNeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("buyer_needs")
      .select("*, agent:profiles(id, full_name, email)")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Failed to load buyer needs:", error);
      setError(error.message);
    } else {
      setBuyerNeeds(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel("buyer-needs-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "buyer_needs" }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { buyerNeeds, loading, error, refresh };
}
