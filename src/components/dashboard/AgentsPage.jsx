import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import ImageUploadField from "./ImageUploadField";
import AgentRow from "./AgentRow";

const emptyForm = {
  email: "",
  full_name: "",
  title: "Real Estate Agent",
  license: "",
  phone: "",
  photo_url: "",
  role: "agent",
  site_access: "full",
  people_enabled: false,
  sendInvite: false,
};

export default function AgentsPage() {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  // A not-yet-created agent has no id to key their photo upload's storage
  // folder by — this stands in for one. Admin uploads bypass the
  // folder-ownership check entirely (see supabase/profile-photos-storage-policies.sql),
  // so any placeholder works; a fresh one just keeps each pending upload
  // in its own folder rather than piling them into one shared bucket.
  const [pendingPhotoFolder, setPendingPhotoFolder] = useState(() => crypto.randomUUID());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [enablingId, setEnablingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const refresh = (silent) => {
    if (silent !== true) setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAgents(data || []);
        setLoading(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const authedFetch = async (url, body) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify(body),
    });
    const responseBody = await res.json();
    if (!res.ok) throw new Error(responseBody.error || "Request failed");
    return responseBody;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      await authedFetch("/api/admin/agents", { action: "add", ...form });
      setSuccess(
        form.sendInvite
          ? `Invited ${form.email} — they'll get an email to set their password.`
          : `Added ${form.full_name}. They can't log in yet — use "Enable Login" whenever you're ready.`
      );
      setForm(emptyForm);
      setPendingPhotoFolder(crypto.randomUUID());
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleEnableLogin = async (agent) => {
    setError("");
    setSuccess("");
    setEnablingId(agent.id);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(agent.email, {
        redirectTo: `${window.location.origin}/accept-invite`,
      });
      if (resetError) throw resetError;
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ login_enabled: true })
        .eq("id", agent.id);
      if (updateError) throw updateError;
      setSuccess(`Sent ${agent.full_name || agent.email} a link to set their password.`);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setEnablingId(null);
    }
  };

  const handleDelete = async (agent) => {
    if (
      !confirm(
        `Permanently delete ${agent.full_name || agent.email}? This removes their login, profile, and their agent site (if they have one). This can't be undone.`,
      )
    ) {
      return;
    }
    setError("");
    setSuccess("");
    setDeletingId(agent.id);
    try {
      await authedFetch("/api/admin/agents", { action: "delete", agentId: agent.id });
      setSuccess(`Deleted ${agent.full_name || agent.email}.`);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setDeletingId(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div>
        <h1 className="text-2xl font-display font-semibold mb-6">Agents</h1>
        {loading ? (
          <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
        ) : (
          <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl divide-y divide-black/5 dark:divide-white/10">
            {agents.map((a) => (
              <AgentRow
                key={a.id}
                agent={a}
                isSelf={a.id === user?.id}
                expanded={expandedId === a.id}
                onToggle={() => setExpandedId((id) => (id === a.id ? null : a.id))}
                onSaved={() => refresh(true)}
                onError={setError}
                onEnableLogin={() => handleEnableLogin(a)}
                enabling={enablingId === a.id}
                onDelete={() => handleDelete(a)}
                deleting={deletingId === a.id}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4 mt-1">Add an Agent</h2>
        <form onSubmit={handleAdd} className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Full name</label>
              <input required value={form.full_name} onChange={update("full_name")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input required type="email" value={form.email} onChange={update("email")} className={inputClass} />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Title</label>
              <input value={form.title} onChange={update("title")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>License</label>
              <input
                value={form.license}
                onChange={update("license")}
                className={inputClass}
                placeholder="LIC #000000"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Phone</label>
              <input value={form.phone} onChange={update("phone")} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Role</label>
              <select value={form.role} onChange={update("role")} className={inputClass}>
                <option value="agent">Agent</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Website access</label>
            <select value={form.site_access} onChange={update("site_access")} className={inputClass}>
              <option value="full">Full — all editing options (theme, bio, photos, custom domain, etc.)</option>
              <option value="limited">Limited — blog posts only</option>
              <option value="none">None — no website (Listings, Upcoming and People only)</option>
            </select>
            <p className="text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1">
              Limited agents only see their Blog Posts when they log in — you can still edit
              everything else on their site yourself from the Agent Sites page. "None" hides Website
              entirely for agents who only use Listings, Upcoming and People. Switchable anytime.
            </p>
          </div>
          <label className="flex items-start gap-2.5 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.people_enabled}
              onChange={(e) => setForm((f) => ({ ...f, people_enabled: e.target.checked }))}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">People module</span>
              <span className="block text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                Leads and Pipeline boards with contact info, follow-ups and notes. Private to this agent —
                even admins can't see their people. Switchable anytime.
              </span>
            </span>
          </label>
          <ImageUploadField
            bucket="profile-photos"
            folder={pendingPhotoFolder}
            value={form.photo_url}
            onChange={(url) => setForm((f) => ({ ...f, photo_url: url || "" }))}
            label="Headshot (optional)"
          />

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium">Let this agent log in</span>
              <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                Sends them an email to set a password. Leave unchecked to just create their profile
                — you can enable login for them anytime later.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : form.sendInvite ? "Send Invite" : "Add Agent"}
          </button>
        </form>
      </div>
    </div>
  );
}
