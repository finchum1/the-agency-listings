import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Ported from debt-tracker-app's useAuth.ts pattern, plus a profile fetch
// (role/name/etc.) since this app needs to know who's an admin vs agent.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (!data.session) setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;
    let active = true;
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error("Failed to load profile:", error);
        setProfile(data || null);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  return {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === "admin",
    loading,
  };
}
