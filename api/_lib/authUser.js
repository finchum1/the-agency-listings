import { createClient } from "@supabase/supabase-js";

/**
 * Checks the signed-in user's token. Returns { supabase, user } where `supabase` acts AS that user (row-level security
 * applies), or sends the error response and returns null.
 */
export async function authenticate(req, res) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    res.status(500).json({ error: "Server not configured." });
    return null;
  }
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Not signed in." });
    return null;
  }
  const supabase = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) {
    res.status(401).json({ error: "Invalid session." });
    return null;
  }
  return { supabase, user };
}

/** A client with the service key, for the few things only the server may touch (Google tokens). */
export function serviceClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Server not configured.");
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}
