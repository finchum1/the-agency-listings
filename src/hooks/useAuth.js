import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Ported from debt-tracker-app's useAuth.ts pattern, plus a profile fetch
// (role/name/etc.) since this app needs to know who's an admin vs agent.
export function useAuth() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
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
        setIsPlatformAdmin(false);
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
    // Profile and "is this the platform owner?" load together so the UI never
    // flashes the wrong role. is_platform_admin() only ever answers for the
    // signed-in user, so it reveals nothing about anyone else.
    Promise.all([
      supabase.from("profiles").select("*").eq("id", session.user.id).single(),
      supabase.rpc("is_platform_admin"),
    ]).then(([{ data, error }, platform]) => {
      if (!active) return;
      if (error) console.error("Failed to load profile:", error);
      setProfile(data || null);
      setIsPlatformAdmin(platform.data === true);
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
    // "Can manage the organization I'm working in": an admin of my own
    // organization, or the platform owner (who can work inside any of them).
    isAdmin: profile?.role === "admin" || isPlatformAdmin,
    isPlatformAdmin,
    loading,
  };
}
