import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one published brokerage_posts row by slug, plus the (published)
// brokerage_site so the post page can render the same Navbar/Footer
// chrome around it. Parallel to useAgentPost.js.
export function useBrokeragePost({ postSlug }) {
  const [site, setSite] = useState(null);
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!postSlug) return;
    let active = true;
    setLoading(true);
    setNotFound(false);

    (async () => {
      const { data: siteRow } = await supabase.from("brokerage_site").select("*").maybeSingle();
      if (!siteRow) {
        if (active) {
          setNotFound(true);
          setLoading(false);
        }
        return;
      }

      const { data: postRow } = await supabase
        .from("brokerage_posts")
        .select("*")
        .eq("slug", postSlug)
        .eq("status", "published")
        .maybeSingle();

      if (!active) return;
      if (!postRow) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setSite(siteRow);
      setPost(postRow);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [postSlug]);

  return { site, post, loading, notFound };
}
