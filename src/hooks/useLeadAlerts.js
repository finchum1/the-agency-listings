import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// The agent's most recent website inquiries (the `leads` table: listing "Send Inquiry" forms, the Get In Touch form,
// home valuation requests) with where each one stands in People, if they have People on. RLS shows an agent only their own.
export function useLeadAlerts(userId, peopleEnabled) {
  const [state, setState] = useState({ alerts: [], loading: true });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const since = new Date(Date.now() - 30 * 864e5).toISOString();
      const { data: leads } = await supabase
        .from("leads")
        .select("id, name, email, phone, message, target_type, created_at")
        .eq("agent_id", userId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(8);
      let byLead = {};
      if (peopleEnabled && leads?.length) {
        const { data: people } = await supabase.from("people").select("id, lead_id, stage, stage_group, archived").in("lead_id", leads.map((l) => l.id));
        byLead = Object.fromEntries((people || []).map((p) => [p.lead_id, p]));
      }
      if (!active) return;
      setState({ alerts: (leads || []).map((l) => ({ ...l, person: byLead[l.id] || null })), loading: false });
    })();
    return () => {
      active = false;
    };
  }, [userId, peopleEnabled]);

  return state;
}
