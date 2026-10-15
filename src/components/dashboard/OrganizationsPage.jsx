import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { adminApi } from "../../lib/adminApi";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import { brandFromOrg } from "../../lib/brand";
import { SITE_ORIGIN } from "../../lib/seo";
import {
  AGENCY_LOGOS,
  HEX,
  agencyOfficeRow,
  checkLogoFile,
  slugProblem,
  slugify,
  tidyLocation,
  uploadOrgLogo,
} from "../../lib/orgBrand";
import BrandLogo from "../BrandLogo";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3.5 py-2.5 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5";
const hintClass = "text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-1.5 leading-snug";
const cardClass = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 space-y-5";

const KINDS = [
  { value: "agency", label: "The Agency office", description: "A new Agency location. Just type where it is." },
  { value: "brokerage", label: "Another brokerage", description: "Its own name, logo and colors." },
  { value: "solo", label: "Solo agent", description: "One agent with their own brand." },
];

const EMPTY = { kind: "agency", location: "", name: "", color: "", slug: "", slugEdited: false, ownerName: "", ownerEmail: "" };

function LoginLink({ slug }) {
  const [copied, setCopied] = useState(false);
  const link = `${SITE_ORIGIN}/login?org=${slug}`;
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          window.prompt("Copy this sign-in link", link);
        }
      }}
      className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline"
    >
      {copied ? "Copied" : "Copy sign-in link"}
    </button>
  );
}

function OrgRow({ o, current, onOpen }) {
  const b = brandFromOrg(o);
  return (
    <li className="flex items-center gap-4 py-3.5">
      <div className="h-11 w-28 shrink-0 rounded-lg bg-black/[0.03] dark:bg-white/[0.06] flex items-center justify-center overflow-hidden px-2">
        <BrandLogo src={b.logo} darkSrc={b.darkLogo} name={o.name} className="max-h-8 w-auto" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold truncate">
          {o.brand?.admin_name || o.name}
          {current && <span className="ml-2 text-[10px] font-semibold uppercase tracking-wider text-[#ed2127] dark:text-[#f2454b]">Open now</span>}
        </p>
        <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 truncate">
          {o.type === "solo" ? "Solo agent" : o.brand?.franchise ? "Agency office" : "Brokerage"} · {o.slug}
          {o.status !== "active" && ` · ${o.status}`}
        </p>
      </div>
      <LoginLink slug={o.slug} />
      {!current && (
        <button
          type="button"
          onClick={() => onOpen(o.id)}
          className="rounded-full border border-black/10 dark:border-white/15 text-xs font-semibold px-4 py-2 hover:bg-black/5 dark:hover:bg-white/10"
        >
          Open
        </button>
      )}
    </li>
  );
}

// Platform owner only: every organization on the platform, and the form that creates a new one. An Agency office needs
// nothing but its location (it gets The Agency's name, logos, colors and disclosures, so it reads like
// "The Agency | OKLAHOMA"); other organizations add their own name and logo. Optionally invites the first admin.
export default function OrganizationsPage() {
  const { user } = useAuth();
  const { org, orgs, switchOrg, refreshOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState(EMPTY);
  const [logoFile, setLogoFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ""), [logoFile]);
  useEffect(() => () => logoPreview && URL.revokeObjectURL(logoPreview), [logoPreview]);

  const location = tidyLocation(f.location);
  const autoSlug = f.kind === "agency" ? (location ? `the-agency-${slugify(location)}` : "") : slugify(f.name);
  const slug = f.slugEdited ? f.slug : autoSlug;
  const set = (patch) => setF((prev) => ({ ...prev, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const isAgency = f.kind === "agency";
    if (isAgency && !location) return setError("Type the office's location, for example Texas or Austin.");
    if (!isAgency && !f.name.trim()) return setError("Add a name.");
    if (f.color.trim() && !HEX.test(f.color.trim())) return setError("The brand color must look like #1a5fb4.");
    const problem = slugProblem(slug);
    if (problem) return setError(`Address name: ${problem}`);
    if (logoFile) {
      const logoProblem = checkLogoFile(logoFile);
      if (logoProblem) return setError(logoProblem);
    }
    if (f.ownerEmail.trim() && !f.ownerName.trim()) return setError("Add the owner's name too, or clear their email.");

    setBusy(true);
    const warnings = [];

    const row = isAgency
      ? { ...agencyOfficeRow(location), slug }
      : {
          slug,
          name: f.name.trim(),
          type: f.kind === "solo" ? "solo" : "brokerage",
          brand: { ...(location ? { location_label: location } : {}), accent_colors: f.color.trim() ? [f.color.trim().toLowerCase()] : [] },
        };

    const { data: created, error: insertError } = await supabase.from("organizations").insert(row).select().single();
    if (insertError) {
      setBusy(false);
      return setError(
        insertError.code === "23505" ? `The address name “${slug}” is already taken. Change it and try again.` : insertError.message,
      );
    }

    const { error: settingsError } = await supabase.from("org_settings").insert({ org_id: created.id });
    if (settingsError) warnings.push(`Settings row: ${settingsError.message}`);
    await supabase.from("audit_log").insert({ actor_id: user?.id, org_id: created.id, action: "create_org", detail: { kind: f.kind, slug } });

    if (logoFile) {
      try {
        const url = await uploadOrgLogo(created.id, "main", logoFile);
        const { error: brandError } = await supabase
          .from("organizations")
          .update({ brand: { ...created.brand, logos: { main: url }, default_logo: "main" } })
          .eq("id", created.id);
        if (brandError) throw new Error(brandError.message);
      } catch (err) {
        warnings.push(`Logo not saved (${err.message}). Add it from Brand settings.`);
      }
    }

    let invited = "";
    if (f.ownerEmail.trim()) {
      try {
        await adminApi({
          action: "add",
          email: f.ownerEmail.trim(),
          full_name: f.ownerName.trim(),
          role: "admin",
          sendInvite: true,
          org_id: created.id,
          site_access: "full",
          people_enabled: true,
        });
        invited = f.ownerEmail.trim();
      } catch (err) {
        warnings.push(`Owner invite not sent (${err.message}). Open the organization and add them from Agents.`);
      }
    }

    setBusy(false);
    setResult({ id: created.id, slug, name: row.brand?.admin_name || row.name, invited, warnings });
    setF(EMPTY);
    setLogoFile(null);
    setOpen(false);
    refreshOrg();
  };

  const previewLogo = f.kind === "agency" ? AGENCY_LOGOS.red : logoPreview;
  const previewName = f.kind === "agency" ? "The Agency" : f.name || "Name";

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-semibold">Organizations</h1>
          <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
            Every brokerage, office and solo agent on the platform. Their data stays walled off from each other.
          </p>
        </div>
        {!open && (
          <button
            type="button"
            onClick={() => {
              setResult(null);
              setOpen(true);
            }}
            className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5"
          >
            + New organization
          </button>
        )}
      </div>

      {result && (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 space-y-2">
          <p className="text-sm font-semibold">{result.name} is ready.</p>
          <p className="text-sm text-[#1c1a17]/70 dark:text-[#faf9f7]/70">
            {result.invited ? `An invitation was sent to ${result.invited}. ` : "No owner was invited yet. "}
            Open it to add agents, upload a logo or set up its site.
          </p>
          {result.warnings.map((w) => (
            <p key={w} className="text-sm text-amber-700 dark:text-amber-400">
              {w}
            </p>
          ))}
          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={() => switchOrg(result.id)}
              className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-xs font-semibold px-4 py-2"
            >
              Open {result.name}
            </button>
            <LoginLink slug={result.slug} />
          </div>
        </div>
      )}

      {open && (
        <form onSubmit={submit} className={cardClass}>
          <h2 className="font-display text-base font-semibold">New organization</h2>

          <div className="grid sm:grid-cols-3 gap-3">
            {KINDS.map((k) => (
              <button
                key={k.value}
                type="button"
                onClick={() => set({ kind: k.value })}
                className={`text-left rounded-xl border p-3.5 transition-colors ${
                  f.kind === k.value
                    ? "border-[#ed2127] dark:border-[#f2454b] ring-2 ring-[#ed2127]/30 dark:ring-[#f2454b]/30"
                    : "border-black/10 dark:border-white/15 hover:border-black/20 dark:hover:border-white/25"
                }`}
              >
                <p className="text-sm font-semibold">{k.label}</p>
                <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50 mt-0.5 leading-snug">{k.description}</p>
              </button>
            ))}
          </div>

          {f.kind === "agency" ? (
            <div>
              <label className={labelClass}>Location</label>
              <input
                value={f.location}
                onChange={(e) => set({ location: e.target.value })}
                placeholder="Texas"
                maxLength={60}
                autoFocus
                className={inputClass}
              />
              <p className={hintClass}>
                The office takes The Agency's name, logos, red and black, and franchise disclosure. Only the location is yours to type.
              </p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>{f.kind === "solo" ? "Agent or business name" : "Brokerage name"}</label>
                <input value={f.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} autoFocus className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Location (optional)</label>
                <input value={f.location} onChange={(e) => set({ location: e.target.value })} placeholder="Austin" maxLength={60} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Logo (optional)</label>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs file:mr-3 file:rounded-full file:border-0 file:bg-black/5 dark:file:bg-white/10 file:px-4 file:py-2 file:text-xs file:font-semibold"
                />
                <p className={hintClass}>PNG, JPG, WebP or SVG up to 2 MB. Without one, the name is shown as text. More versions can be added later.</p>
              </div>
              <div>
                <label className={labelClass}>Brand color (optional)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={HEX.test(f.color) ? f.color : "#1a5fb4"}
                    onChange={(e) => set({ color: e.target.value })}
                    className="h-10 w-12 rounded-lg border border-black/10 dark:border-white/15 bg-transparent p-1 cursor-pointer"
                    aria-label="Brand color"
                  />
                  <input value={f.color} onChange={(e) => set({ color: e.target.value })} placeholder="#1a5fb4" maxLength={7} className={`${inputClass} w-32 font-mono`} />
                </div>
              </div>
            </div>
          )}

          <div>
            <p className={labelClass}>Preview</p>
            <div className="rounded-xl border border-black/10 bg-white text-[#1c1a17] px-5 py-4 flex items-center gap-3 min-h-[4.5rem]">
              <BrandLogo src={previewLogo} name={previewName} className="h-9 w-auto" />
              {location && <span className="h-6 w-px bg-black/10" aria-hidden="true" />}
              {location && <span className="text-xs font-semibold tracking-[0.18em] uppercase opacity-60">{location}</span>}
            </div>
          </div>

          <div>
            <label className={labelClass}>Address name</label>
            <input
              value={slug}
              onChange={(e) => set({ slug: slugify(e.target.value), slugEdited: true })}
              placeholder="the-agency-texas"
              className={`${inputClass} font-mono`}
            />
            <p className={hintClass}>
              Used in the sign-in link: {SITE_ORIGIN}/login?org={slug || "…"}. Can't be changed later without Latchpoint.
            </p>
          </div>

          <div className="border-t border-black/5 dark:border-white/10 pt-5 space-y-3">
            <div>
              <h3 className="text-sm font-semibold">Owner (optional)</h3>
              <p className={hintClass}>Gets an email invitation to set a password and becomes this organization's admin. You can also add them later from Agents.</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Name</label>
                <input value={f.ownerName} onChange={(e) => set({ ownerName: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input type="email" value={f.ownerEmail} onChange={(e) => set({ ownerEmail: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-3">
            <button type="submit" disabled={busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-3 disabled:opacity-60">
              {busy ? "Creating…" : "Create organization"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError("");
              }}
              className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <section className={cardClass}>
        <h2 className="font-display text-base font-semibold">All organizations ({orgs.length})</h2>
        <ul className="divide-y divide-black/5 dark:divide-white/10 -my-2">
          {orgs.map((o) => (
            <OrgRow key={o.id} o={o} current={o.id === org?.id} onOpen={switchOrg} />
          ))}
        </ul>
      </section>
    </div>
  );
}
