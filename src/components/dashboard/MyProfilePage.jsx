import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import ClaudeConnectionCard from "./ClaudeConnectionCard";
import BotApiCard from "./BotApiCard";
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

  // Optional second address for lead alerts. Kept in a private table (never on the public profile row).
  const [alertEmail, setAlertEmail] = useState("");
  const [domainAlerts, setDomainAlerts] = useState(false);
  const [domainAlertsError, setDomainAlertsError] = useState("");
  const [dealUpdatesAuto, setDealUpdatesAuto] = useState(true);
  const [dealUpdatesError, setDealUpdatesError] = useState("");
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertError, setAlertError] = useState("");
  const [alertSaved, setAlertSaved] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase
      .from("agent_notification_settings")
      .select("lead_alert_email, domain_alerts, deal_updates_auto")
      .eq("agent_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (active) {
          setAlertEmail(data?.lead_alert_email || "");
          setDomainAlerts(Boolean(data?.domain_alerts));
          setDealUpdatesAuto(data?.deal_updates_auto !== false);
        }
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  const toggleDomainAlerts = async (on) => {
    setDomainAlerts(on);
    setDomainAlertsError("");
    const { error } = await supabase.from("agent_notification_settings").upsert({ agent_id: user.id, domain_alerts: on, updated_at: new Date().toISOString() });
    if (error) {
      setDomainAlerts(!on);
      setDomainAlertsError(error.message);
    }
  };

  const toggleDealUpdatesAuto = async (on) => {
    setDealUpdatesAuto(on);
    setDealUpdatesError("");
    const { error } = await supabase.from("agent_notification_settings").upsert({ agent_id: user.id, deal_updates_auto: on, updated_at: new Date().toISOString() });
    if (error) {
      setDealUpdatesAuto(!on);
      setDealUpdatesError(error.message);
    }
  };

  const handleAlertSubmit = async (e) => {
    e.preventDefault();
    setAlertError("");
    const value = alertEmail.trim();
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setAlertError("That doesn't look like an email address.");
      return;
    }
    setAlertSaving(true);
    const { error } = await supabase
      .from("agent_notification_settings")
      .upsert({ agent_id: user.id, lead_alert_email: value || null, updated_at: new Date().toISOString() });
    setAlertSaving(false);
    if (error) {
      setAlertError(error.message);
      return;
    }
    setAlertEmail(value);
    setAlertSaved(true);
  };

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

      <form
        onSubmit={handleAlertSubmit}
        className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6 space-y-4"
      >
        <div>
          <h2 className="font-display text-lg font-semibold">Lead alerts</h2>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
            New website inquiries are emailed to {profile.email}. If they land in spam, or you'd like them somewhere you check
            more often, add a second address and every alert goes to both.
          </p>
        </div>
        <div>
          <label htmlFor="lead-alert-email" className={labelClass}>
            Also send my lead alerts to (optional)
          </label>
          <input
            id="lead-alert-email"
            type="email"
            value={alertEmail}
            onChange={(e) => {
              setAlertSaved(false);
              setAlertEmail(e.target.value);
            }}
            className={inputClass}
            placeholder="you@gmail.com"
          />
        </div>
        {alertError && <p className="text-sm text-red-600 dark:text-red-400">{alertError}</p>}
        {alertSaved && (
          <p className="text-sm text-emerald-700 dark:text-emerald-400">
            {alertEmail ? "Saved. Alerts will go to both addresses." : "Saved. Alerts go to your main address only."}
          </p>
        )}
        <button
          type="submit"
          disabled={alertSaving}
          className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors disabled:opacity-60"
        >
          {alertSaving ? "Saving…" : "Save alert address"}
        </button>
      </form>

      {profile.role === "admin" && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
          <h2 className="font-display text-lg font-semibold">Domain alerts</h2>
          <label className="mt-3 flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={domainAlerts} onChange={(e) => toggleDomainAlerts(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Email me when a property site's custom domain stops responding</span>
              <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                Every domain is checked every 15 minutes (and whenever the Listings page is opened). You get one email when a working domain goes down, with what to check, and one when it's back.
              </span>
            </span>
          </label>
          {domainAlertsError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{domainAlertsError}</p>}
        </div>
      )}

      {profile.deals_role === "tc" && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
          <h2 className="font-display text-lg font-semibold">Updates to agents</h2>
          <label className="mt-3 flex items-start gap-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={dealUpdatesAuto} onChange={(e) => toggleDealUpdatesAuto(e.target.checked)} className="mt-0.5" />
            <span>
              <span className="font-medium">Email my agents automatically at deal milestones</span>
              <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                When closing, an inspection, the appraisal or the financing deadline is a couple of days out, when every document is collected, or when compliance approves, the agent gets a short status email with you as the reply-to. On Mondays they get one summary of deals with something overdue or coming up. You can always send an update yourself from a deal's Overview.
              </span>
            </span>
          </label>
          {dealUpdatesError && <p className="mt-2 text-sm text-red-600 dark:text-red-400">{dealUpdatesError}</p>}
        </div>
      )}

      {profile.people_enabled && (
        <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
          <h2 className="font-display text-lg font-semibold">Deals</h2>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1 mb-4">
            Edit the buyer and seller checklists that get added to your deals.
          </p>
          <Link
            to="/dashboard/settings"
            className="inline-block rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 hover:bg-[#1c1a17]/90 dark:hover:bg-[#f2454b]/90 transition-colors"
          >
            Deal Checklists
          </Link>
        </div>
      )}

      {profile?.role === "admin" && <ClaudeConnectionCard />}
      {profile?.role === "admin" && <BotApiCard />}

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
