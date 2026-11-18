// What each domain-check result means and what to do about it. Used by the emails, the dashboard check, and the bot alerts feed.
export const LABELS = {
  ok: "Live",
  no_dns: "No DNS record found for this domain.",
  not_attached: "The domain points at Vercel, but hasn't been added to the project.",
  elsewhere: "The domain loads, but not from this app. It may still point at an old host or a parking page.",
  tls: "The security certificate isn't ready yet. This can take a few minutes after connecting.",
  timeout: "The domain didn't answer in time.",
  unreachable: "The domain couldn't be reached.",
};

export const FIX = {
  no_dns: "Check the domain's DNS records at the registrar. The domain may have expired, or its records may have been changed or removed.",
  not_attached: "Add the domain to the Vercel project (Settings, then Domains). The DNS is pointed at Vercel but Vercel doesn't know which project it belongs to.",
  elsewhere: "Check where the domain's DNS now points. It should point at Vercel, and may have been moved to another host or a parking page.",
  tls: "Vercel is usually still issuing the certificate. If it doesn't clear within an hour, check the domain in the Vercel project.",
  timeout: "This is often temporary. You'll get another email when it answers again.",
  unreachable: "This is often temporary. You'll get another email when it answers again.",
};

// The www check: property sites use the plain domain, and www should permanently redirect to it.
export const WWW_LABELS = {
  not_redirecting: "www doesn't redirect to the plain domain yet.",
  missing: "www has no address yet, so www.<domain> doesn't load.",
};

export const WWW_FIX = {
  not_redirecting: "In the Vercel project (Settings, then Domains), edit the www entry: choose Redirect to Another Domain, pick the plain domain, and set 308 Permanent Redirect.",
  missing: "In the Vercel project (Settings, then Domains), add www.<domain> with Redirect to Another Domain pointing at the plain domain (308). If the domain's DNS is not on Vercel, also add a www CNAME to cname.vercel-dns.com.",
};
