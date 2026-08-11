import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";

// Self-service profile editing — the one gap left over from bootstrapping
// the first admin directly in the Supabase dashboard (which skips the
// invite flow's full_name/title/license/phone fields). Any agent can edit
// their own row here; RLS (profiles_update_own_or_admin) enforces that
// server-side regardless of what this form sends.
export default function MyProfilePage() {
  const { profile, user } = useAuth();
  const [form, setForm] = useState({
    full_name: "",
    title: "",
    license: "",
    phone: "",
    photo_url: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile) {
      setForm({
        full_name: profile.full_name || "",
        title: profile.title || "",
        license: profile.license || "",
        phone: profile.phone || "",
        photo_url: profile.photo_url || "",
      });
    }
  }, [profile]);

  const update = (field) => (e) => {
    setSaved(false);
    setForm((f) => ({ ...f, [field]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSaving(true);
    const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
  };

  const inputClass =
    "w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 mb-1.5";

  if (!profile) return <p className="text-sm text-[#1c1a17]/50">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-display font-semibold mb-2">My Profile</h1>
      <p className="text-sm text-[#1c1a17]/60 mb-6">
        This is what shows up as your contact info on every listing site you're assigned to.
      </p>

      <form onSubmit={handleSubmit} className="bg-white border border-black/5 rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-4">
          <img
            src={form.photo_url || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23e5e0d8'/%3E%3Cpath d='M4 20c0-4 4-6 8-6s8 2 8 6' fill='%23e5e0d8'/%3E%3C/svg%3E"}
            alt=""
            className="h-16 w-16 rounded-full object-cover bg-black/5"
          />
          <div className="flex-1">
            <label className={labelClass}>Headshot URL</label>
            <input
              value={form.photo_url}
              onChange={update("photo_url")}
              className={inputClass}
              placeholder="https://…"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Full name</label>
            <input required value={form.full_name} onChange={update("full_name")} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input value={form.title} onChange={update("title")} className={inputClass} />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>License</label>
            <input
              value={form.license}
              onChange={update("license")}
              className={inputClass}
              placeholder="LIC #000000"
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input value={form.phone} onChange={update("phone")} className={inputClass} />
          </div>
        </div>

        <div className="text-sm text-[#1c1a17]/50">Email: {profile.email} (contact your admin to change this)</div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {saved && <p className="text-sm text-emerald-700">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#1c1a17] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
