import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import ImageUploadField from "./ImageUploadField";

const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const sectionTitle = "text-xs font-semibold uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40";

// One agent in the Agents list: a compact row that expands into all of
// their details and access settings. Everything here saves as you go
// (typed fields when you leave them, dropdowns and switches instantly) —
// the same direct profiles update an admin was already allowed to make
// (profiles_update_own_or_admin), no service role needed.
export default function AgentRow({
  agent,
  isSelf,
  expanded,
  onToggle,
  onSaved,
  onError,
  onEnableLogin,
  enabling,
  onDelete,
  deleting,
}) {
  const [form, setForm] = useState({
    full_name: agent.full_name || "",
    title: agent.title || "",
    license: agent.license || "",
    phone: agent.phone || "",
  });
  const [status, setStatus] = useState("");

  const patch = async (changes) => {
    setStatus("Saving…");
    const { error } = await supabase.from("profiles").update(changes).eq("id", agent.id);
    if (error) {
      onError(error.message);
      setStatus("");
      return false;
    }
    onError("");
    setStatus("Saved");
    onSaved();
    return true;
  };

  const saveText = (field) => () => {
    const value = form[field].trim();
    if (field === "full_name" && !value) {
      setForm((f) => ({ ...f, full_name: agent.full_name || "" }));
      return;
    }
    if (value === (agent[field] || "")) return;
    patch({ [field]: value });
  };

  const setText = (field) => (e) => {
    setStatus("");
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="w-full px-5 py-4 flex items-center justify-between gap-3 text-left hover:bg-black/[0.02] dark:hover:bg-white/[0.03] transition-colors"
      >
        <span className="flex items-center gap-3 min-w-0">
          <img
            src={agent.photo_url || AVATAR_FALLBACK}
            alt=""
            className="h-10 w-10 rounded-full object-cover bg-black/5 dark:bg-white/10 shrink-0"
          />
          <span className="min-w-0">
            <span className="block font-medium text-sm truncate">{agent.full_name || "(no name yet)"}</span>
            <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">{agent.email}</span>
          </span>
        </span>
        <span className="flex items-center gap-2 shrink-0">
          {agent.role === "admin" && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#ed2127]/15 text-[#ed2127] dark:text-[#f2454b]">
              Admin
            </span>
          )}
          {!agent.login_enabled && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
              No login
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            className={`text-[#1c1a17]/40 dark:text-[#faf9f7]/40 transition-transform ${expanded ? "rotate-90" : ""}`}
          >
            <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="px-5 pb-6 pt-1 space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className={sectionTitle}>Details</h3>
              <span className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">{status}</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Full name</label>
                <input value={form.full_name} onChange={setText("full_name")} onBlur={saveText("full_name")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Title</label>
                <input value={form.title} onChange={setText("title")} onBlur={saveText("title")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>License</label>
                <input
                  value={form.license}
                  onChange={setText("license")}
                  onBlur={saveText("license")}
                  placeholder="LIC #000000"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Phone</label>
                <input value={form.phone} onChange={setText("phone")} onBlur={saveText("phone")} className={inputClass} />
              </div>
            </div>
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">Email: {agent.email}</p>
            <ImageUploadField
              bucket="profile-photos"
              folder={agent.id}
              value={agent.photo_url || ""}
              onChange={(url) => patch({ photo_url: url || null })}
              label="Headshot"
            />
          </section>

          <section className="space-y-3">
            <h3 className={sectionTitle}>Access</h3>
            <div>
              <label className={labelClass}>Website</label>
              <select
                value={agent.site_access}
                onChange={(e) => patch({ site_access: e.target.value })}
                className={inputClass}
              >
                <option value="full">Full — every part of their site</option>
                <option value="limited">Limited — blog posts only</option>
                <option value="none">None — no website (Listings, Upcoming and People only)</option>
              </select>
            </div>
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={!!agent.people_enabled}
                onChange={(e) => patch({ people_enabled: e.target.checked })}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">People module</span>
                <span className="block text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                  Leads, Pipeline and Transactions. Private to this agent — even admins can't see their people.
                </span>
              </span>
            </label>
            <div>
              <label className={labelClass}>Role</label>
              <select
                value={agent.role}
                onChange={(e) => patch({ role: e.target.value })}
                disabled={isSelf}
                className={`${inputClass} disabled:opacity-60`}
              >
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
              {isSelf && (
                <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1">You can't change your own role.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className={sectionTitle}>Login</h3>
            {agent.login_enabled ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">This agent can log in.</p>
            ) : (
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60">No login yet.</p>
                <button
                  type="button"
                  onClick={onEnableLogin}
                  disabled={enabling}
                  className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
                >
                  {enabling ? "Sending…" : "Enable Login"}
                </button>
              </div>
            )}
          </section>

          {!isSelf && (
            <div className="pt-4 border-t border-black/5 dark:border-white/10">
              <button
                type="button"
                onClick={onDelete}
                disabled={deleting}
                className="text-sm font-semibold text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete agent"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
