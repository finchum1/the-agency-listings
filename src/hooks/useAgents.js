import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useOrg } from "../context/OrgContext";

// Every agent/admin profile, for an admin's "which agent is this for"
// picker (UpcomingListingsSection.jsx, BuyerNeedsSection.jsx) — profiles is
// fully public-read (see schema.sql), so this needs no special RLS.
export function useAgents() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const { orgId, loading: orgLoading } = useOrg();

  useEffect(() => {
    if (orgLoading) return;
    if (!orgId) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("org_id", orgId)
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
  }, [orgId, orgLoading]);

  return { agents, loading };
}
