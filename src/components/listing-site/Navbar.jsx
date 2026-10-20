import { useEffect, useState } from "react";
import { useListingContext } from "../../context/ListingContext";
import BrandLogo from "../BrandLogo";

const links = [
  { href: "#overview", label: "Overview" },
  { href: "#gallery", label: "Gallery" },
  { href: "#features", label: "Features" },
  { href: "#location", label: "Location" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar({ backLink }) {
  const { listing } = useListingContext();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // The optional short text beside the logo (a neighborhood or city), with a thin divider. Light over the hero, dark
  // once the bar is solid.
  const labelEl = listing.headerLabel ? (
    <span className={`flex items-center gap-3 min-w-0 transition-colors ${scrolled || open ? "text-[var(--ls-text)]" : "text-[var(--ls-on-dark)]"}`}>
      <span className="hidden sm:block h-7 w-px bg-current opacity-25 shrink-0" aria-hidden="true" />
      <span className="hidden sm:block text-sm font-display tracking-wide whitespace-nowrap truncate">{listing.headerLabel}</span>
    </span>
  ) : null;

  if (listing.headerStyle === "floating") {
    // A clear header at the top that becomes a detached, rounded pill once scrolled (same idea as the agent sites'
    // floating header). On the pill, text uses the page's own text color; over the hero it stays light.
    const tone = scrolled || open ? "text-[var(--ls-text)]" : "text-[var(--ls-on-dark)]";
    const linkClass = `text-xs font-medium tracking-wide uppercase transition-colors whitespace-nowrap px-4 py-2 rounded-full ${
      scrolled ? "text-[var(--ls-text)]/75 hover:text-[var(--ls-text)] hover:bg-[var(--ls-text)]/10" : "text-[var(--ls-on-dark)]/80 hover:text-[var(--ls-on-dark)] hover:bg-[var(--ls-on-dark)]/10"
    }`;
    return (
      <div className="fixed top-0 inset-x-0 z-50 pt-4 px-4 sm:px-6">
        <header className="mx-auto max-w-7xl">
          <div
            className={`flex items-center gap-4 rounded-full px-4 sm:px-5 py-2 transition-all duration-300 ${
              scrolled || open ? "bg-[var(--ls-bg)]/95 backdrop-blur shadow-[0_16px_36px_-16px_rgba(0,0,0,0.45)]" : "bg-transparent"
            }`}
          >
            <a href="#overview" className="flex items-center min-w-0 shrink-0">
              <BrandLogo src={listing.brokerage.logo} name={listing.brokerage.name} className="h-11 sm:h-12 w-auto" />
            </a>
            {labelEl}
            {backLink && (
              <a href={backLink.href} className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors opacity-85 hover:opacity-100 ${tone}`}>
                <span aria-hidden="true">←</span>
                <span className="hidden sm:inline">{backLink.label}</span>
                <span className="sm:hidden">Back</span>
              </a>
            )}
            <div className="ml-auto flex items-center gap-2">
              <nav className="hidden lg:flex items-center gap-1">
                {links.map((link) => (
                  <a key={link.href} href={link.href} className={linkClass}>
                    {link.label}
                  </a>
                ))}
                <a
                  href="#contact"
                  className={`ml-2 text-xs font-semibold tracking-wide uppercase px-5 py-2.5 rounded-full whitespace-nowrap transition-colors ${
                    scrolled ? "bg-[var(--ls-accent)] text-white hover:opacity-90" : "border border-[var(--ls-on-dark)]/70 text-[var(--ls-on-dark)] hover:bg-[var(--ls-on-dark)] hover:text-[var(--ls-text)]"
                  }`}
                >
                  Schedule a Tour
                </a>
              </nav>
              <button className={`lg:hidden p-2 shrink-0 ${tone}`} onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  {open ? <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /> : <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />}
                </svg>
              </button>
            </div>
          </div>
          {open && (
            <div className="lg:hidden mt-2 rounded-2xl bg-[var(--ls-bg)] shadow-[0_16px_36px_-16px_rgba(0,0,0,0.45)] px-6 py-4 flex flex-col gap-4">
              {links.map((link) => (
                <a key={link.href} href={link.href} onClick={() => setOpen(false)} className="text-sm font-medium text-[var(--ls-text)]/80">
                  {link.label}
                </a>
              ))}
              <a href="#contact" onClick={() => setOpen(false)} className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ls-accent)] text-white text-center">
                Schedule a Tour
              </a>
            </div>
          )}
        </header>
      </div>
    );
  }

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-[var(--ls-bg)]/95 backdrop-blur shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between py-3">
        <div className="flex items-center gap-3 sm:gap-5 min-w-0">
          <a href="#overview" className="flex items-center min-w-0">
            <BrandLogo src={listing.brokerage.logo} name={listing.brokerage.name} className="h-14 sm:h-16 w-auto" />
          </a>
          {labelEl}
          {backLink && (
            <a
              href={backLink.href}
              className={`inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium whitespace-nowrap transition-colors ${
                scrolled
                  ? "text-[var(--ls-text)]/80 hover:text-[var(--ls-text)]"
                  : "text-[var(--ls-on-dark)]/85 hover:text-[var(--ls-on-dark)]"
              }`}
            >
              <span aria-hidden="true">←</span>
              <span className="hidden sm:inline">{backLink.label}</span>
              <span className="sm:hidden">Back</span>
            </a>
          )}
        </div>

        <nav className="hidden lg:flex items-center gap-6 xl:gap-8 shrink-0">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className={`text-sm font-medium tracking-wide transition-colors whitespace-nowrap ${
                scrolled
                  ? "text-[var(--ls-text)]/80 hover:text-[var(--ls-text)]"
                  : "text-[var(--ls-on-dark)]/85 hover:text-[var(--ls-on-dark)]"
              }`}
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            className={`text-sm font-semibold px-5 py-2.5 rounded-full border whitespace-nowrap transition-colors ${
              scrolled
                ? "border-[var(--ls-text)] text-[var(--ls-text)] hover:bg-[var(--ls-text)] hover:text-[var(--ls-bg)]"
                : "border-[var(--ls-on-dark)] text-[var(--ls-on-dark)] hover:bg-[var(--ls-on-dark)] hover:text-[var(--ls-text)]"
            }`}
          >
            Schedule a Tour
          </a>
        </nav>

        <button
          className={`lg:hidden p-2 shrink-0 ${scrolled ? "text-[var(--ls-text)]" : "text-[var(--ls-on-dark)]"}`}
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
        <div className="lg:hidden bg-[var(--ls-bg)] border-t border-black/5 px-6 py-4 flex flex-col gap-4">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-[var(--ls-text)]/80"
            >
              {link.label}
            </a>
          ))}
          <a
            href="#contact"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold px-5 py-2.5 rounded-full bg-[var(--ls-text)] text-[var(--ls-bg)] text-center"
          >
            Schedule a Tour
          </a>
        </div>
      )}
    </header>
  );
}
