import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Fetches one listing (by slug, for the public site — or by id, for the
// dashboard edit form) plus its photos and open houses. RLS handles
// whether the row is actually visible to the current caller.
export function useListing({ slug, id } = {}) {
  const [listing, setListing] = useState(null);
  const [agent, setAgent] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [openHouses, setOpenHouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    if (!slug && !id) return;
    setLoading(true);
    setNotFound(false);

    let query = supabase.from("listings").select("*, agent:profiles(*)");
    query = slug ? query.eq("slug", slug) : query.eq("id", id);
    const { data: listingRow, error: listingError } = await query.maybeSingle();

    if (listingError) console.error("Failed to load listing:", listingError);

    if (!listingRow) {
      setListing(null);
      setAgent(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    const [{ data: photoRows }, { data: openHouseRows }] = await Promise.all([
      supabase
        .from("listing_photos")
        .select("*")
        .eq("listing_id", listingRow.id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("open_houses")
        .select("*")
        .eq("listing_id", listingRow.id)
        .order("starts_at", { ascending: true }),
    ]);

    setListing(listingRow);
    setAgent(listingRow.agent || null);
    setPhotos(photoRows || []);
    setOpenHouses(openHouseRows || []);
    setLoading(false);
  }, [slug, id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!listing?.id) return;
    const channel = supabase
      .channel(`listing-${listing.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listings", filter: `id=eq.${listing.id}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "listing_photos", filter: `listing_id=eq.${listing.id}` },
        refresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "open_houses", filter: `listing_id=eq.${listing.id}` },
        refresh
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  return { listing, agent, photos, openHouses, loading, notFound, refresh };
}
