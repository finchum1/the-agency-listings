import { useEffect, useState } from "react";
import { useListingContext } from "../../context/ListingContext";

const links = [
  { href: "#overview", label: "Overview" },
  { href: "#gallery", label: "Gallery" },
  { href: "#features", label: "Features" },
  { href: "#location", label: "Location" },
  { href: "#contact", label: "Contact" },
];

export default function Navbar() {
  const { listing } = useListingContext();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-colors duration-300 ${
        scrolled ? "bg-[var(--ls-bg)]/95 backdrop-blur shadow-sm" : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-10 flex items-center justify-between py-3">
        <a href="#overview" className="flex items-center min-w-0">
          <img
            src={listing.brokerage.logo}
            alt={listing.brokerage.name}
            className="h-14 sm:h-16 w-auto"
          />
        </a>

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
