import { Link, useLocation } from "react-router-dom";
import brokerage from "../../lib/brokerage";

const LINKS = [
  { path: "/agent-websites", label: "Agent Websites" },
  { path: "/property-websites", label: "Property Sites" },
];

// Shared sticky header for every marketing page (home + the two product
// deep-dives) — see DESIGN.md Navigation: active link gets a translucent
// ink/10 pill, inactive is ink/70 with a subtle hover tint. Same pattern
// the dashboard nav uses, just applied to marketing routes instead of
// dashboard tabs.
export default function MarketingNav() {
  const location = useLocation();

  return (
    <header className="sticky top-0 z-40 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-10 h-20 flex items-center justify-between gap-6">
        <Link to="/" className="shrink-0">
          <img src={brokerage.logo} alt={brokerage.name} className="h-11 w-auto" />
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          {LINKS.map((link) => {
            const active = location.pathname === link.path;
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`text-sm font-medium px-4 py-2 rounded-full transition-colors ${
                  active ? "bg-[#1c1a17]/10 text-[#1c1a17]" : "text-[#1c1a17]/70 hover:bg-black/5"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <Link
          to="/login"
          className="shrink-0 text-sm font-semibold px-5 py-2.5 rounded-full border border-[#1c1a17] text-[#1c1a17] hover:bg-[#1c1a17] hover:text-white transition-colors"
        >
          Sign In
        </Link>
      </div>
    </header>
  );
}
