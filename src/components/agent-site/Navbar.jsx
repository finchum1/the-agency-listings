import { useEffect, useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";

const links = [
  { href: "#bio", label: "About" },
  { href: "#listings", label: "Listings" },
  { href: "#areas", label: "Areas" },
  { href: "#blog", label: "Blog" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const { site } = useAgentSiteContext();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled || open ? "bg-[var(--as-dark)] shadow-md" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between py-4">
        <a href="#" className="flex items-center gap-3 min-w-0">
          <img src={site.brokerage.logo} alt={site.brokerage.name} className="h-9 sm:h-11 w-auto" />
          {site.secondaryLogo && (
            <>
              <span className="h-8 w-px bg-[var(--as-on-dark)]/25 shrink-0" aria-hidden="true" />
              <img src={site.secondaryLogo} alt="" className="h-8 sm:h-10 w-auto" />
            </>
          )}
          <span className="hidden sm:block text-sm font-display tracked-wide whitespace-nowrap text-[var(--as-on-dark)]">
            {site.agent.name}
          </span>
        </a>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 shrink-0">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-xs font-medium tracked-wide uppercase transition-colors whitespace-nowrap text-[var(--as-on-dark)]/75 hover:text-[var(--as-on-dark)]"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className="text-xs font-medium tracked-wide uppercase px-5 py-2.5 border border-[var(--as-on-dark)]/70 text-[var(--as-on-dark)] whitespace-nowrap transition-colors hover:bg-[var(--as-on-dark)] hover:text-[var(--as-dark)]"
          >
            Let&rsquo;s Connect
          </a>
        </nav>

        <button
          className="lg:hidden p-2 shrink-0 text-[var(--as-on-dark)]"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            )}
          </svg>
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-[var(--as-dark)] border-t border-[var(--as-on-dark)]/10 px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-xs font-medium tracked-wide uppercase text-[var(--as-on-dark)]/80"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="text-xs font-medium tracked-wide uppercase px-5 py-3 bg-[var(--as-accent)] text-white text-center"
          >
            Let&rsquo;s Connect
          </a>
        </div>
      )}
    </header>
  );
}
