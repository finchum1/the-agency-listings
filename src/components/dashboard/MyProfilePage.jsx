import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useTheme } from "../../hooks/useTheme";
import ImageUploadField from "./ImageUploadField";

const THEME_OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

// Self-service profile editing — the one gap left over from bootstrapping
// the first admin directly in the Supabase dashboard (which skips the
// invite flow's full_name/title/license/phone fields). Any agent can edit
// their own row here; RLS (profiles_update_own_or_admin) enforces that
// server-side regardless of what this form sends.
export default function MyProfilePage() {
  const { profile, user } = useAuth();
  const [theme, setTheme] = useTheme();
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
    "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
  const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";

  if (!profile) return <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-display font-semibold mb-2">My Profile</h1>
      <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-6">
        This is what shows up as your contact info on every listing site you're assigned to.
      </p>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5">
        <ImageUploadField
          bucket="profile-photos"
          folder={user.id}
          value={form.photo_url}
          onChange={(url) => {
            setSaved(false);
            setForm((f) => ({ ...f, photo_url: url || "" }));
          }}
          label="Headshot"
        />

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

        <div className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Email: {profile.email} (contact your admin to change this)</div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {saved && <p className="text-sm text-emerald-700 dark:text-emerald-400">Saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
        <h2 className="font-display text-lg font-semibold">Appearance</h2>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1 mb-4">
          Switch the dashboard between light and dark, or follow your device's setting.
        </p>
        <div className="inline-flex items-center gap-1 rounded-full bg-black/5 dark:bg-white/10 p-1">
          {THEME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTheme(opt.value)}
              className={`text-xs font-semibold rounded-full px-4 py-2 transition-colors ${
                theme === opt.value
                  ? "bg-[#1c1a17] dark:bg-[#f2454b] text-white"
                  : "text-[#1c1a17]/70 dark:text-[#faf9f7]/70 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
