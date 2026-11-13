import { useSyncExternalStore } from "react";

// The signed-in visitor of the public Home Search, shared by every search on the page (an area page can hold two). One store per site; the token lives in
// that browser's localStorage and nowhere else. All of it goes through api/visitor.js; see that file and supabase/site-visitors.sql.
//   site: { kind: "agent", id } or { kind: "brokerage" }
const LOCAL_FAVORITES = "idx-favorite-listings"; // the hearts saved on this device before accounts existed (useFavorites.js)

const stores = new Map();
const keyOf = (site) => (site.kind === "agent" ? `agent:${site.id}` : site.kind === "brokerage" ? "brokerage" : "none");
const tokenKey = (site) => `visitor-token:${keyOf(site)}`;
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k, v) => { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* storage blocked: the sign-in just won't persist */ } };

async function call(site, action, { method = "POST", body, token } = {}) {
  const res = await fetch(`/api/visitor?a=${action}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { status: res.status });
  return data;
}

function create(site) {
  let state = { ready: false, token: null, account: null, dialog: null, notice: "" };
  const listeners = new Set();
  let after = null; // what to do once the visitor is signed in (the heart or save they tapped first)
  const set = (patch) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };
  const api = {
    site,
    subscribe: (l) => { listeners.add(l); return () => listeners.delete(l); },
    get: () => state,

    async init() {
      if (state.ready) return;
      const token = read(tokenKey(site));
      if (!token) return set({ ready: true });
      try {
        set({ ready: true, token, account: await call(site, "me", { method: "GET", token }) });
      } catch (err) {
        if (err.status === 401) write(tokenKey(site), null);
        set({ ready: true, token: null, account: null });
      }
    },

    isFavorite: (mls) => !!state.account?.favorites.some((f) => f.mls === mls),
    openSignIn(reason = "", then = null) { after = then; set({ dialog: { reason } }); },
    closeDialog() { after = null; set({ dialog: null }); },
    openPanel() { set({ dialog: { panel: true } }); },
    notify(text) { set({ notice: text }); setTimeout(() => state.notice === text && set({ notice: "" }), 3500); },

    requestCode: (email, extra = {}) => call(site, "request_code", { body: { site, email, ...extra } }),
    async verify(email, code, name = "") {
      const { token, account } = await call(site, "verify", { body: { site, email, code, name } });
      write(tokenKey(site), token);
      // Hearts saved on this device before signing in come along.
      let local = [];
      try { local = JSON.parse(read(LOCAL_FAVORITES) || "[]"); } catch { local = []; }
      let acct = account;
      if (local.length) {
        await call(site, "favorites_merge", { body: { mls: local }, token }).catch(() => {});
        acct = await call(site, "me", { method: "GET", token }).catch(() => account);
      }
      const next = after;
      after = null;
      set({ token, account: acct, dialog: null });
      if (next) await next();
    },
    async signOut() {
      const token = state.token;
      write(tokenKey(site), null);
      set({ token: null, account: null, dialog: null });
      if (token) await call(site, "logout", { token }).catch(() => {});
    },
    async deleteAccount() {
      const token = state.token;
      write(tokenKey(site), null);
      set({ token: null, account: null, dialog: null });
      if (token) await call(site, "delete_account", { token }).catch(() => {});
    },

    // A home: signed in, it is saved at once (and put back if the server says no); signed out, the sign-in opens first and the save happens after.
    async toggleFavorite(listing) {
      if (!state.account) return api.openSignIn("Sign in to save homes and see them on every device.", () => api.toggleFavorite(listing));
      const mls = listing.mlsNumber;
      const on = !api.isFavorite(mls);
      const before = state.account;
      const snapshot = { address: listing.address_line1, city: listing.city, state: listing.state, price: listing.price, beds: listing.beds, baths: listing.baths, photo: listing.hero_photo_url };
      set({ account: { ...before, favorites: on ? [{ mls, snapshot }, ...before.favorites] : before.favorites.filter((f) => f.mls !== mls) } });
      try { await call(site, "favorite", { body: { mls, on, snapshot }, token: state.token }); } catch (err) { set({ account: before }); api.notify(err.message); }
    },
    async saveSearch({ name, params, alerts, path }) {
      const r = await call(site, "search_save", { body: { name, params, alerts, path }, token: state.token });
      const acct = await call(site, "me", { method: "GET", token: state.token });
      set({ account: acct });
      return r;
    },
    async updateSearch(id, patch) {
      const before = state.account;
      set({ account: { ...before, searches: before.searches.map((s) => (s.id === id ? { ...s, ...patch } : s)) } });
      try { await call(site, "search_update", { body: { id, ...patch }, token: state.token }); } catch (err) { set({ account: before }); api.notify(err.message); }
    },
    async deleteSearch(id) {
      const before = state.account;
      set({ account: { ...before, searches: before.searches.filter((s) => s.id !== id) } });
      try { await call(site, "search_delete", { body: { id }, token: state.token }); } catch (err) { set({ account: before }); api.notify(err.message); }
    },
  };
  return api;
}

export function visitorStore(site) {
  const k = keyOf(site);
  if (!stores.has(k)) stores.set(k, create(site));
  return stores.get(k);
}

/** The visitor store for a site, as React state: [state, actions]. */
export function useVisitor(site) {
  const store = visitorStore(site);
  const state = useSyncExternalStore(store.subscribe, store.get, store.get);
  return [state, store];
}
