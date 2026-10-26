import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export const DEAL_ATTENTION_EVENT = "deals-attention-changed";
export const refreshDealAttention = () => window.dispatchEvent(new Event(DEAL_ATTENTION_EVENT));

// What needs the signed-in person in Deals: deals sent back (agent / coordinator), deals waiting for review (compliance) and
// unread messages. Drives the badge on the Deals menu item. Refreshes every minute, when the tab regains focus, and when any
// screen calls refreshDealAttention() (after reading a thread or submitting a deal).
export function useDealAttention(enabled) {
  const [counts, setCounts] = useState({ needs_changes: 0, to_review: 0, unread: 0 });

  const load = useCallback(async () => {
    if (!enabled) return;
    const { data } = await supabase.rpc("deal_attention");
    if (data) setCounts(data);
  }, [enabled]);

  useEffect(() => {
    load();
    if (!enabled) return undefined;
    const timer = setInterval(load, 60000);
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener(DEAL_ATTENTION_EVENT, load);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener(DEAL_ATTENTION_EVENT, load);
    };
  }, [enabled, load]);

  return { ...counts, total: (counts.needs_changes || 0) + (counts.to_review || 0) + (counts.unread || 0) };
}
