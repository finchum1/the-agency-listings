import { supabase } from "./supabaseClient";

/** Calls the newsletter server as the signed-in agent. Returns the server's answer; throws an Error with the server's own words when it says no. */
export async function newsletterAction(body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("You are signed out. Sign in again.");
  const res = await fetch("/api/newsletters", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
}
