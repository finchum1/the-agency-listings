import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const input =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

/** Which client something is for (a CMA, a saved search): type to search the agent's people, pick one. */
export default function ClientPicker({ personId, name, onPick }) {
  const [text, setText] = useState("");
  const [hits, setHits] = useState([]);
  useEffect(() => {
    const t = text.trim();
    if (t.length < 2) {
      setHits([]);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("people").select("id, name").ilike("name", `%${t.replace(/[%,]/g, " ")}%`).eq("archived", false).limit(6);
      if (live) setHits(data || []);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [text]);
  if (personId) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium">{name || "Client"}</span>
        <button type="button" onClick={() => onPick(null, "")} className={quiet}>Remove</button>
      </div>
    );
  }
  return (
    <div className="relative">
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search your people (optional)" className={input} aria-label="Client" />
      {hits.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-lg overflow-hidden">
          {hits.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => { onPick(p.id, p.name); setText(""); setHits([]); }} className="w-full px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
