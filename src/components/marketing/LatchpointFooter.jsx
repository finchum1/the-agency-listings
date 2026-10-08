import { Link } from "react-router-dom";
import brokerage from "../../lib/brokerage";
import { LatchpointWordmark } from "./LatchpointMarks";

const PLATFORM = [
  { to: "/brokerage-website", label: "Brokerage Site" },
  { to: "/agent-websites", label: "Agent Websites" },
  { to: "/property-websites", label: "Property Sites" },
  { to: "/people", label: "People" },
  { to: "/upcoming", label: "Upcoming" },
];

const STUDIO = [
  { href: "https://realestate.latchpointstudios.com", label: "Real estate" },
  { href: "https://latchpointstudios.com/work", label: "Our work" },
  { href: "https://latchpointstudios.com/about", label: "About" },
  { href: "mailto:hello@latchpointstudios.com", label: "Email us" },
];

const heading = "font-geist-mono text-[11px] uppercase tracking-[0.14em] text-[#6c6e76]";
const link = "text-sm text-[#a4a5ac] transition-colors hover:text-[#f5f5f4]";

// Latchpoint Studios' footer for theagency.latchpointstudios.com: Latchpoint
// leads (wordmark tagged "The Agency", then the studio's own links), and The
// Agency's logo and office address sit underneath as the client the platform
// was built for. Always dark, like Latchpoint's own footer, on both themes.
export default function LatchpointFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#08090b] font-geist">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="flex flex-col justify-between gap-12 lg:flex-row">
          <div className="max-w-sm">
            <a href="https://latchpointstudios.com" aria-label="Latchpoint Studios, home">
              <LatchpointWordmark tag="The Agency" inverse />
            </a>
            <p className="mt-4 text-sm leading-relaxed text-[#a4a5ac]">
              Designed and built by Latchpoint Studios, a small studio that builds websites, dashboards, and
              back offices.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            <div>
              <h3 className={heading}>The platform</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {PLATFORM.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className={link}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={heading}>Latchpoint Studios</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {STUDIO.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
            <p className="text-xs leading-relaxed text-[#6c6e76]">
              {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}
            </p>
          </div>
          <p className="text-xs text-[#6c6e76]">
            &copy; {new Date().getFullYear()} Latchpoint Studios. Edmond, Oklahoma.
          </p>
        </div>
      </div>
    </footer>
  );
}
