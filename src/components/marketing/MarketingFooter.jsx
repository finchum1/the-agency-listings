import { Link } from "react-router-dom";
import brokerage from "../../lib/brokerage";

// Shared footer for every marketing page. Kept deliberately simple (no
// social, no newsletter) — this is an internal brokerage tool's pitch
// page, not a consumer brand site.
export default function MarketingFooter() {
  return (
    <footer className="bg-[#1c1a17] text-white/60 px-6 lg:px-10 py-10">
      <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-6">
        <img src={brokerage.logo} alt={brokerage.name} className="h-8 w-auto" />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <Link to="/agent-websites" className="hover:text-white transition-colors">
            Agent Websites
          </Link>
          <Link to="/property-websites" className="hover:text-white transition-colors">
            Property Sites
          </Link>
          <Link to="/login" className="hover:text-white transition-colors">
            Sign In
          </Link>
        </nav>
        <p className="text-xs">
          {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
          {brokerage.address.zip}
        </p>
      </div>
    </footer>
  );
}
