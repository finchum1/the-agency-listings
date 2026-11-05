// The unsubscribe link in every newsletter (src/pages/UnsubscribePage.jsx shows the page; mail apps' one-click button posts here directly).
//   GET  ?token=...   who it is for (the agent's name, the address with its middle hidden) so the page can say what is being unsubscribed
//   POST ?token=...   unsubscribes that address from that agent's newsletters, for good
// The token belongs to one email sent to one person. "test" is the token on a test send: it shows the page and changes nothing.
import { serviceClient } from "./_lib/authUser.js";

const mask = (email) => {
  const [name, domain] = String(email).split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(1, name.length - 2))}@${domain}`;
};

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex");
  const token = String(req.query?.token || req.body?.token || "");
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!/^[a-f0-9]{32}$/.test(token) && token !== "test") return res.status(404).json({ error: "This link isn't valid." });
  try {
    if (token === "test") return res.status(200).json({ test: true, agentName: "your agent", email: "" });
    const admin = serviceClient();
    const { data: send } = await admin.from("newsletter_sends").select("id, owner_id, email, unsubscribed_at").eq("token", token).maybeSingle();
    if (!send) return res.status(404).json({ error: "This link isn't valid." });
    const { data: agent } = await admin.from("profiles").select("full_name").eq("id", send.owner_id).maybeSingle();
    if (req.method === "GET") return res.status(200).json({ agentName: agent?.full_name || "your agent", email: mask(send.email), done: Boolean(send.unsubscribed_at) });

    await admin.from("newsletter_optouts").upsert({ owner_id: send.owner_id, email: send.email.toLowerCase(), source: "unsubscribe link" }, { onConflict: "owner_id,email", ignoreDuplicates: true });
    await admin.from("newsletter_sends").update({ unsubscribed_at: new Date().toISOString() }).eq("id", send.id).is("unsubscribed_at", null);
    return res.status(200).json({ ok: true, agentName: agent?.full_name || "your agent" });
  } catch (err) {
    console.error("newsletter unsubscribe error:", err);
    return res.status(500).json({ error: "Something went wrong. Please try again." });
  }
}
