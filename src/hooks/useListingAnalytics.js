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

/** One agent site's analytics for the last `days` days (the site_analytics() rollup). */
export function useSiteAnalyticsRollup(siteId, days) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    if (!siteId) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc("site_analytics", { p_site_id: siteId, p_days: days }).then(({ data, error }) => {
      if (live) setState({ data: error ? null : data, loading: false, error: error?.message || "" });
    });
    return () => {
      live = false;
    };
  }, [siteId, days]);
  return state;
}

/** The brokerage site's analytics for the last `days` days (the brokerage_analytics() rollup). */
export function useBrokerageAnalyticsRollup(siteId, days) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    if (!siteId) return;
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc("brokerage_analytics", { p_site_id: siteId, p_days: days }).then(({ data, error }) => {
      if (live) setState({ data: error ? null : data, loading: false, error: error?.message || "" });
    });
    return () => {
      live = false;
    };
  }, [siteId, days]);
  return state;
}

/** The whole office's property-site numbers for a period, narrowed by agent, listing status and traffic source (office_analytics()). */
export function useOfficeAnalytics({ days, agent, status, source }) {
  const [state, setState] = useState({ data: null, loading: true, error: "" });
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc("office_analytics", { p_days: days, p_agent: agent || null, p_status: status || null, p_source: source || null }).then(({ data, error }) => {
      if (live) setState({ data: error ? null : data, loading: false, error: error?.message || "" });
    });
    return () => {
      live = false;
    };
  }, [days, agent, status, source]);
  return state;
}
