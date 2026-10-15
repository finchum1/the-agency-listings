import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// What the dashboard home page needs beyond the People data: the agent's own blog posts and listings.
// All reads are scoped by the database's own rules (an agent only ever sees their own site and listings here).
export function useHomeSummary(userId, { wantsBlog, wantsListings }) {
  const [state, setState] = useState({ posts: [], hasSite: false, listings: [], loading: true });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    (async () => {
      const [{ data: site }, { data: listings }] = await Promise.all([
        wantsBlog ? supabase.from("agent_sites").select("id").eq("agent_id", userId).maybeSingle() : Promise.resolve({ data: null }),
        wantsListings ? supabase.from("listings").select("id, status").eq("agent_id", userId) : Promise.resolve({ data: [] }),
      ]);
      let posts = [];
      if (site?.id) {
        const { data } = await supabase
          .from("agent_site_posts")
          .select("id, title, status, post_date, scheduled_at, updated_at")
          .eq("agent_site_id", site.id)
          .order("post_date", { ascending: false })
          .limit(100);
        posts = data || [];
      }
      if (!active) return;
      setState({ posts, hasSite: !!site?.id, listings: listings || [], loading: false });
    })();
    return () => {
      active = false;
    };
  }, [userId, wantsBlog, wantsListings]);

  return state;
}
