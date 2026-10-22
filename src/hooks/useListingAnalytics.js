import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

/** One listing's analytics for the last `days` days (the listing_analytics() rollup). */
export function useListingAnalytics(listingId, days) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    if (!listingId) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc("listing_analytics", { p_listing_id: listingId, p_days: days }).then(({ data, error }) => {
      if (live) setState({ data: error ? null : data, loading: false, error: error?.message || "" });
    });
    return () => {
      live = false;
    };
  }, [listingId, days]);
  return state;
}
