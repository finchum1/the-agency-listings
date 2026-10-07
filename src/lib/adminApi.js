import { supabase } from "./supabaseClient";

// POST to the admin-only /api/admin/agents function as the signed-in user.
// Resolves to the JSON body; rejects with the server's error message.
export async function adminApi(body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/admin/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json;
}
