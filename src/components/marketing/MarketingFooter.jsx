import { Link } from "react-router-dom";
import brokerage from "../../lib/brokerage";

// The real Latchpoint Studios mark (rounded-square outline + accent
// chip), ported from that project's own src/components/logomark.tsx —
// same paths, with its var(--accent) swapped for the literal color
// (#e8623f) since that CSS variable doesn't exist in this app.
function LatchpointLogomark({ className = "" }) {
  return (
    <svg viewBox="2.5 1.2 20.3 20.3" fill="none" className={className} aria-hidden="true">
      <rect x="3.5" y="3.5" width="17" height="17" rx="6" stroke="currentColor" strokeWidth="2" />
      <rect x="14.8" y="1.2" width="8" height="8" rx="2.7" fill="#e8623f" />
    </svg>
  );
}

// Shared footer for every marketing page. Kept deliberately simple (no
// social, no newsletter) — this is a product-marketing pitch page, not a
// consumer brand site.
export default function MarketingFooter() {
  return (
    <footer className="bg-[#1c1a17] text-white/60 px-6 lg:px-10 py-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <img src={brokerage.logo} alt={brokerage.name} className="h-10 w-auto" />
          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <Link to="/agent-websites" className="hover:text-white transition-colors">
              Agent Websites
            </Link>
            <Link to="/property-websites" className="hover:text-white transition-colors">
              Property Sites
            </Link>
            <Link to="/upcoming" className="hover:text-white transition-colors">
              Upcoming
            </Link>
          </nav>
          <p className="text-xs">
            {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
            {brokerage.address.zip}
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/10 flex justify-center sm:justify-start">
          <a
            href="https://latchpointstudios.com"
            target="_blank"
            rel="noopener noreferrer"
            className="latchpoint-credit inline-flex items-center gap-2 text-xs text-white/45 hover:text-white transition-colors"
          >
            <span>Designed by</span>
            <LatchpointLogomark className="latchpoint-mark h-4 w-4" />
            <span className="font-semibold tracking-tight">Latchpoint Studios</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
