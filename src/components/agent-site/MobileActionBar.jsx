import { useEffect, useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";

// A bar pinned to the bottom of the screen on phones only: Call, Text and Email, so a visitor can reach the agent from any page in one tap. It
// reads the site's own theme tokens and the as-btn class, so it matches the colors and the square or pill button shape the agent picked. On a team
// site, Call and Text go to the site owner's number and Email goes to everyone on the team. Each button is left out if there's nothing to send it to.
// Like the header, it is not there when a visitor arrives: it slides up once they have scrolled (the same 40px the header uses to leave its clear state).
// Rendered at the end of every public agent-site page, after the footer; the spacer keeps the footer's last line from sitting under the bar.
const btn = "as-btn flex items-center justify-center gap-2 h-12 text-[11px] sm:text-xs font-medium tracked-wide uppercase whitespace-nowrap transition duration-150 active:scale-[0.98]";
const outline = `${btn} flex-1 border-2 border-[var(--as-text)] text-[var(--as-text)]`;

const icons = {
  call: <path d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25c1.1.37 2.3.57 3.6.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z" />,
  text: <path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 1-2z" />,
};
const Icon = ({ name }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
    {icons[name]}
  </svg>
);

export default function MobileActionBar() {
  const { site } = useAgentSiteContext();
  const { agent } = site;
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const phone = (agent.phone || "").trim();
  const digits = phone.replace(/[^\d+]/g, "");
  const emails = [...new Set((agent.members || []).map((m) => m.email).filter(Boolean))];
  if (!digits && emails.length === 0) return null;

  return (
    <>
      <div className="h-[calc(5rem+env(safe-area-inset-bottom))] bg-[var(--as-dark)] md:hidden" aria-hidden="true" />
      <nav
        aria-label="Contact"
        aria-hidden={!scrolled}
        className={`fixed inset-x-0 bottom-0 z-40 flex items-center gap-2.5 transition duration-300 ease-out border-t border-[var(--as-text)]/15 bg-[var(--as-bg)] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.25)] md:hidden ${scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-full opacity-0"}`}
      >
        {digits && (
          <a href={`tel:${digits}`} tabIndex={scrolled ? 0 : -1} className={outline}>
            <Icon name="call" />
            Call
          </a>
        )}
        {digits && (
          <a href={`sms:${digits}`} tabIndex={scrolled ? 0 : -1} className={outline}>
            <Icon name="text" />
            Text
          </a>
        )}
        {emails.length > 0 && (
          <a href={`mailto:${emails.join(",")}`} tabIndex={scrolled ? 0 : -1} className={`${btn} flex-[1.5] bg-[var(--as-accent)] text-white hover:opacity-90`}>
            {site.team ? "Email the team" : `Email ${agent.first || ""}`.trim()}
          </a>
        )}
      </nav>
    </>
  );
}
