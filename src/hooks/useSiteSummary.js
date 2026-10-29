import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// A short summary of an agent's site for the page around the editor: its address and whether it is live, and what is still missing (the setup
// checklist). Reloads whenever the editor saves or adds something (it announces "agent-site-saved").
export default function useSiteSummary(agentId) {
  const [summary, setSummary] = useState(null);

  const load = useCallback(async () => {
    const { data: site } = await supabase
      .from("agent_sites")
      .select("id, slug, status, tagline, hero_photo_url, hero_video_url, bio_html, bio, custom_domain")
      .eq("agent_id", agentId)
      .maybeSingle();
    if (!site) return setSummary({ site: null, counts: { testimonials: 0, areas: 0 } });
    const [t, a] = await Promise.all([
      supabase.from("agent_site_testimonials").select("id", { count: "exact", head: true }).eq("agent_site_id", site.id),
      supabase.from("agent_site_areas").select("id", { count: "exact", head: true }).eq("agent_site_id", site.id),
    ]);
    setSummary({ site, counts: { testimonials: t.count || 0, areas: a.count || 0 } });
  }, [agentId]);

  useEffect(() => {
    load();
    window.addEventListener("agent-site-saved", load);
    return () => window.removeEventListener("agent-site-saved", load);
  }, [load]);

  return { summary, setStatus: (status) => setSummary((s) => (s?.site ? { ...s, site: { ...s.site, status } } : s)), reload: load };
}
