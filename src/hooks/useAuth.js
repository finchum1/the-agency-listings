import { useEffect, useMemo, useSyncExternalStore } from "react";
import { supabase } from "../lib/supabaseClient";

// Who is signed in, their profile (role/name/etc.) and whether they are the platform owner.
//
// This used to keep its own copy in every component that called it, and ~30 components do, so opening the dashboard asked the
// database for the same profile and the same platform-owner check ~28 times each. It is now ONE shared copy: the session and
// profile load once for the whole page, and every useAuth() reads it. Components that mount later get it instantly; if it is
// more than STALE_MS old they also trigger a quiet refresh (so a change made elsewhere shows up, as it did when every
// component fetched for itself). Code that edits the signed-in person's own profile calls refreshAuth() afterwards.
const STALE_MS = 30_000;

let state = { session: null, profile: null, isPlatformAdmin: false, loading: true, loadedAt: 0 };
const listeners = new Set();
const subscribe = (fn) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getState = () => state;
function set(patch) {
  state = { ...state, ...patch };
  listeners.forEach((fn) => fn());
}

let started = false;
let inflight = null; // { userId, promise }: the load in progress, shared by everyone who asks meanwhile
let latest = 0; // only the newest load may write its answer, so an older response can't overwrite a newer one

// Profile and "is this the platform owner?" load together so the UI never flashes the wrong role. is_platform_admin() only
// ever answers for the signed-in user, so it reveals nothing about anyone else.
// quiet: a refresh of something already on screen (no loading state, and a failed refresh keeps what we have).
function loadProfile(userId, { quiet = false, force = false } = {}) {
  if (!force && inflight?.userId === userId) return inflight.promise;
  if (!quiet) set({ loading: true });
  const mine = ++latest;
  const promise = Promise.all([supabase.from("profiles").select("*").eq("id", userId).single(), supabase.rpc("is_platform_admin")])
    .then(([{ data, error }, platform]) => {
      if (mine !== latest || state.session?.user?.id !== userId) return;
      if (error) console.error("Failed to load profile:", error);
      set({
        profile: data || (quiet ? state.profile : null),
        isPlatformAdmin: error && quiet ? state.isPlatformAdmin : platform.data === true,
        loading: false,
        loadedAt: Date.now(),
      });
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { userId, promise };
  return promise;
}

function applySession(session) {
  if (!session) {
    latest++;
    set({ session: null, profile: null, isPlatformAdmin: false, loading: false, loadedAt: 0 });
    return;
  }
  const changedUser = state.session?.user?.id !== session.user?.id;
  set({ session });
  if (changedUser) loadProfile(session.user.id);
}

function start() {
  if (started) return;
  started = true;
  supabase.auth.getSession().then(({ data }) => applySession(data.session));
  supabase.auth.onAuthStateChange((_event, newSession) => applySession(newSession));
}

/** Reload the signed-in person's profile now (after something edited it). */
export function refreshAuth() {
  const id = state.session?.user?.id;
  return id ? loadProfile(id, { quiet: true, force: true }) : Promise.resolve();
}

export function useAuth() {
  const s = useSyncExternalStore(subscribe, getState);

  useEffect(() => {
    start();
    const id = getState().session?.user?.id;
    if (id && getState().loadedAt && Date.now() - getState().loadedAt > STALE_MS) loadProfile(id, { quiet: true });
  }, []);

  return useMemo(
    () => ({
      session: s.session,
      user: s.session?.user ?? null,
      profile: s.profile,
      // "Can manage the organization I'm working in": an admin of my own
      // organization, or the platform owner (who can work inside any of them).
      isAdmin: s.profile?.role === "admin" || s.isPlatformAdmin,
      isPlatformAdmin: s.isPlatformAdmin,
      loading: s.loading,
    }),
    [s],
  );
}
