import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Every agent/admin profile, for an admin's "which agent is this for"
// picker (UpcomingListingsPage.jsx, BuyerNeedsPage.jsx) — profiles is
// fully public-read (see schema.sql), so this needs no special RLS.
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .order("full_name")
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Failed to load agents:", error);
        setAgents(data || []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { agents, loading };
}
