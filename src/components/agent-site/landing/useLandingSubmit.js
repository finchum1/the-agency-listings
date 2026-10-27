import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { useSpamGuard } from "../../../lib/spamGuard";

// Sends a Sellers / Buyers / Home Value form to the agent: their email, their Leads (tagged with the page it came from) and, for a home value
// request, a "pull comps" task (see api/agent-site-contact.js and supabase/agent-site-landing-pages.sql).
export function useLandingSubmit(page) {
  const { siteId } = useAgentSiteContext();
  const guard = useSpamGuard();
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  const submit = async ({ name, email, phone = "", address = "", message = "", details = {} }) => {
    setStatus("sending");
    setError("");
    try {
      const res = await fetch("/api/agent-site-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentSiteId: siteId, page, name, email, phone, address, message, details, ...guard.fields() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Something went wrong.");
      setStatus("sent");
      return true;
    } catch (err) {
      setError(err.message || "Something went wrong.");
      setStatus("error");
      return false;
    }
  };
  return { status, error, submit, guard, reset: () => setStatus("idle") };
}
