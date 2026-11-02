import { supabase } from "./supabaseClient";

/** Asks the server to run the signed-in agent's due plan steps now (their dashboard just opened, or they just started a plan). Never throws. */
export async function runMyPlans() {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) return 0;
    const res = await fetch("/api/plans", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const json = await res.json().catch(() => ({}));
    return json.ran || 0;
  } catch {
    return 0;
  }
}
