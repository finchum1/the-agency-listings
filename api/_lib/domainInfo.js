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
