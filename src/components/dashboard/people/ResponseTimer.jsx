import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

// Speed to lead: how long a new website lead waited for the agent's first reach-out ("Waiting 12 min", red after five), or how fast it was answered
// ("Responded in 4 min"). Only for leads that came in through the website (people.lead_id); the first reach-out is a call, text or email tapped from
// the card, "Followed up", or a drafted message marked sent (supabase/lead-response-plans.sql).
const STALE_MS = 3 * 24 * 60 * 60 * 1000; // a lead nobody answered for three days is no longer "waiting", it is just overdue

export function formatWait(ms) {
  const mins = Math.max(0, Math.round(ms / 60000));
  if (mins < 1) return "under a minute";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Notes that the agent has now reached out to a website lead. Safe to call every time: it only ever sets the first one. */
export async function markResponded(person) {
  if (!person?.id || !person.lead_id || person.first_response_at) return;
  person.first_response_at = new Date().toISOString(); // so a second tap on the same card doesn't ask again
  await supabase.from("people").update({ first_response_at: person.first_response_at }).eq("id", person.id).is("first_response_at", null);
}

export default function ResponseTimer({ person, className = "" }) {
  const waiting = Boolean(person?.lead_id && person.stage_group === "lead" && !person.first_response_at && !person.archived);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!waiting) return undefined;
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, [waiting]);
  if (!person?.lead_id || person.stage_group !== "lead" || !person.created_at) return null;
  const arrived = new Date(person.created_at).getTime();
  if (person.first_response_at) {
    const took = new Date(person.first_response_at).getTime() - arrived;
    if (took < 1000) return null; // an older lead counted as handled when this was added
    return <p className={`text-xs font-medium text-emerald-700 dark:text-emerald-400 ${className}`}>Responded in {formatWait(took)}</p>;
  }
  const age = now - arrived;
  if (age > STALE_MS || person.archived) return null;
  const late = age >= 5 * 60000;
  return (
    <p className={`text-xs font-semibold ${late ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400"} ${className}`}>
      Waiting {formatWait(age)}
    </p>
  );
}
