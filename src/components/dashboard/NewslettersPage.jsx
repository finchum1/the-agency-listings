import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const pill = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60";
const STATUS = {
  draft: ["Draft", "bg-black/[0.06] dark:bg-white/10"],
  scheduled: ["Scheduled", "bg-sky-100 dark:bg-sky-400/15 text-sky-800 dark:text-sky-300"],
  sending: ["Sending", "bg-amber-100 dark:bg-amber-400/15 text-amber-800 dark:text-amber-300"],
  sent: ["Sent", "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300"],
};
const when = (n) => {
  const d = n.status === "scheduled" ? n.scheduled_at : n.sent_at || n.started_at || n.updated_at;
  return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "";
};

// The agent's newsletters: drafts to finish, what is scheduled, and what has gone out with how it did.
export default function NewslettersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState(null);
  const [stats, setStats] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error: err } = await supabase.from("newsletters").select("*").eq("owner_id", user.id).order("created_at", { ascending: false });
      if (err) return setError(err.message);
      setRows(data || []);
      const sentIds = (data || []).filter((n) => n.status !== "draft" && n.status !== "scheduled").map((n) => n.id);
      if (sentIds.length) {
        const { data: sends } = await supabase.from("newsletter_sends").select("newsletter_id, status, opened_at, clicked_at, unsubscribed_at").in("newsletter_id", sentIds).limit(20000);
        const s = {};
        for (const r of sends || []) {
          const x = (s[r.newsletter_id] ||= { sent: 0, failed: 0, opened: 0, clicked: 0, unsub: 0 });
          if (r.status === "sent") x.sent++;
          if (r.status === "failed") x.failed++;
          if (r.opened_at) x.opened++;
          if (r.clicked_at) x.clicked++;
          if (r.unsubscribed_at) x.unsub++;
        }
        setStats(s);
      }
    })();
  }, [user]);

  const create = async () => {
    setBusy(true);
    const { data, error: err } = await supabase.from("newsletters").insert({}).select("id").single();
    setBusy(false);
    if (err) return setError(err.message);
    navigate(`/dashboard/marketing/newsletters/${data.id}`);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/dashboard/marketing" className={`text-xs font-semibold hover:underline ${muted}`}>
            ← Marketing
          </Link>
          <h1 className="mt-2 text-2xl font-display font-semibold">Newsletters</h1>
          <p className={`mt-1 text-sm ${muted}`}>Email your contacts a note, your listings and your blog posts.</p>
        </div>
        <button type="button" onClick={create} disabled={busy} className={pill}>
          New newsletter
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {rows === null ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className={`rounded-2xl border border-dashed border-black/15 dark:border-white/20 p-8 text-center text-sm ${muted}`}>No newsletters yet. Start one with the button above.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((n) => {
            const [label, tone] = STATUS[n.status] || STATUS.draft;
            const s = stats[n.id];
            const pct = (x) => (s && s.sent ? `${Math.round((x / s.sent) * 100)}%` : "–");
            return (
              <li key={n.id}>
                <Link to={`/dashboard/marketing/newsletters/${n.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] px-5 py-4 hover:border-black/20 dark:hover:border-white/25">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{n.subject || "Untitled newsletter"}</p>
                    <p className={`text-xs ${muted}`}>
                      {label} {when(n) && `· ${when(n)}`}
                      {n.recipient_count ? ` · ${n.recipient_count} people` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    {s && (
                      <p className={`text-xs ${muted}`}>
                        {pct(s.opened)} opened · {pct(s.clicked)} clicked{s.unsub ? ` · ${s.unsub} unsubscribed` : ""}
                        {s.failed ? ` · ${s.failed} didn't send` : ""}
                      </p>
                    )}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{label}</span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
