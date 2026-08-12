import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const emptyForm = {
  email: "",
  full_name: "",
  title: "Real Estate Agent",
  license: "",
  phone: "",
  photo_url: "",
  role: "agent",
  sendInvite: false,
};

export default function AgentsPage() {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [enablingId, setEnablingId] = useState(null);

  const refresh = () => {
    setLoading(true);
    supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setAgents(data || []);
        setLoading(false);
      });
  };

  useEffect(refresh, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleAdd = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/admin/add-agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to add agent");
      setSuccess(
        form.sendInvite
          ? `Invited ${form.email} — they'll get an email to set their password.`
          : `Added ${form.full_name}. They can't log in yet — use "Enable Login" whenever you're ready.`
      );
      setForm(emptyForm);
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

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <div>
        <h1 className="text-2xl font-display font-semibold mb-6">Agents</h1>
        {loading ? (
          <p className="text-sm text-[#1c1a17]/50">Loading…</p>
        ) : (
          <div className="bg-white border border-black/5 rounded-2xl divide-y divide-black/5">
            {agents.map((a) => (
              <div key={a.id} className="px-5 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{a.full_name || "(no name yet)"}</p>
                  <p className="text-xs text-[#1c1a17]/50 truncate">{a.email}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      a.login_enabled ? "bg-emerald-50 text-emerald-700" : "bg-black/5 text-[#1c1a17]/50"
                    }`}
                  >
                    {a.login_enabled ? "Can log in" : "No login"}
                  </span>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      a.role === "admin" ? "bg-[#8a7a5c]/15 text-[#8a7a5c]" : "bg-black/5 text-[#1c1a17]/60"
                    }`}
                  >
                    {a.role === "admin" ? "Admin" : "Agent"}
                  </span>
                  {!a.login_enabled && (
                    <button
                      type="button"
                      onClick={() => handleEnableLogin(a)}
                      disabled={enablingId === a.id}
                      className="text-xs font-semibold text-[#8a7a5c] hover:underline disabled:opacity-50 whitespace-nowrap"
                    >
                      {enablingId === a.id ? "Sending…" : "Enable Login"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-display font-semibold mb-4 mt-1">Add an Agent</h2>
        <form onSubmit={handleAdd} className="bg-white border border-black/5 rounded-2xl p-6 space-y-4">
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
            <label className={labelClass}>Headshot URL (optional)</label>
            <input value={form.photo_url} onChange={update("photo_url")} className={inputClass} placeholder="https://…" />
          </div>

          <label className="flex items-start gap-2.5 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={form.sendInvite}
              onChange={(e) => setForm((f) => ({ ...f, sendInvite: e.target.checked }))}
              className="mt-0.5"
            />
            <span className="text-sm">
              <span className="font-medium">Let this agent log in</span>
              <span className="block text-xs text-[#1c1a17]/50">
                Sends them an email to set a password. Leave unchecked to just create their profile
                — you can enable login for them anytime later.
              </span>
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-emerald-700">{success}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
          >
            {saving ? "Saving…" : form.sendInvite ? "Send Invite" : "Add Agent"}
          </button>
        </form>
      </div>
    </div>
  );
}
