import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project values."
  );
}

// Many components each ask for the same data when a page opens (the same people list, the same settings row), and the dashboard
// used to send every one of those as its own request: over a slow connection they queue and the whole page waits on them.
// While an identical read (GET) is still on its way, later callers share it instead of sending another. Nothing is ever reused
// once it has finished, so no answer is older than the request it came from, and ANY write clears the list so a read made after
// a save always asks again. Requests with an abort signal are left alone (one caller cancelling must not cancel the others).
const pending = new Map();
const KEY_HEADERS = ["authorization", "apikey", "accept", "accept-profile", "range", "prefer"];

function sharedFetch(input, init) {
  const request = typeof Request !== "undefined" && input instanceof Request ? input : null;
  const method = String(init?.method || request?.method || "GET").toUpperCase();
  if (method !== "GET") {
    pending.clear();
    return fetch(input, init);
  }
  if (init?.signal || request?.signal) return fetch(input, init);
  const headers = new Headers(init?.headers || request?.headers || undefined);
  const key = [request ? request.url : String(input), ...KEY_HEADERS.map((h) => headers.get(h) || "")].join("|");
  let promise = pending.get(key);
  if (!promise) {
    promise = fetch(input, init);
    pending.set(key, promise);
    const done = () => {
      if (pending.get(key) === promise) pending.delete(key);
    };
    promise.then(done, done);
  }
  // Each caller reads its own copy of the response body.
  return promise.then((response) => response.clone());
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: sharedFetch } });
