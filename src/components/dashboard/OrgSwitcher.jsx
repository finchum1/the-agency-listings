import { useState } from "react";
import { useOrg } from "../../context/OrgContext";
import { SITE_ORIGIN } from "../../lib/seo";

// Platform owner only: pick which organization the dashboard is working in. Everyone else never sees it. Shown at the top of My Profile.
export default function OrgSwitcher({ flush = false }) {
  const { org, orgs, isPlatformAdmin, switchOrg } = useOrg();
  if (!isPlatformAdmin || orgs.length === 0) return null;
  return (
    <div className={flush ? "pb-3" : "px-4 pb-3 shrink-0"}>
      <label
        htmlFor="org-switcher"
        className="block text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mb-1"
      >
        Working in
      </label>
      <select
        id="org-switcher"
        value={org?.id || ""}
        onChange={(e) => switchOrg(e.target.value)}
        className="w-full rounded-lg border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm text-[#1c1a17] dark:text-[#faf9f7]"
      >
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.brand?.admin_name || o.name}
          </option>
        ))}
      </select>
      <CopyLoginLink org={org} />
    </div>
  );
}

// The organization's personal sign-in link (see hooks/useAuthOrg.js): its logo on the login screen. Built on the platform's
// own address (VITE_SITE_ORIGIN), whatever host the owner happens to be on.
function CopyLoginLink({ org }) {
  const [copied, setCopied] = useState(false);
  if (!org?.slug) return null;
  const link = `${SITE_ORIGIN}/login?org=${org.slug}`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // clipboard blocked (older browser, insecure context): fall back to a prompt the owner can copy from
      window.prompt("Copy this login link:", link);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={link}
      className="mt-1.5 text-xs font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] transition-colors"
    >
      {copied ? "Copied!" : "Copy login link"}
    </button>
  );
}
