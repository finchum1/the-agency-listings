import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Dashboard list. RLS already scopes the rows returned to "my listings, or
// all listings if I'm admin" — no client-side role branching needed on the
// query itself (see supabase/schema.sql, listings_owner_admin_read_all).
export function useListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("listings")
      .select("*, agent:profiles(id, full_name, email)")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("Failed to load listings:", error);
      setError(error.message);
    } else {
      setListings(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();

    const channel = supabase
      .channel("listings-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, refresh)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { listings, loading, error, refresh };
}
