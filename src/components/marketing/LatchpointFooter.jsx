import { LatchpointWordmark } from "./LatchpointMarks";

// This footer is deliberately identical to realestate.latchpointstudios.com's (latchpoint-studios repo,
// src/components/realestate/re-footer.tsx): same wordmark, blurb, two link columns and bottom line. Change them together.
const PRODUCT = [
  { href: "/#home", label: "Your day" },
  { href: "/#website", label: "Website" },
  { href: "/#back-office", label: "Back office" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#who", label: "Who it's for" },
  { href: "/#faq", label: "FAQ" },
  { href: "/#early-access", label: "Request early access" },
];

const COMPANY = [
  { href: "https://app.latchpointstudios.com", label: "Sign in" },
  { href: "https://latchpointstudios.com", label: "Latchpoint Studios" },
  { href: "mailto:hello@latchpointstudios.com", label: "Email us" },
  { href: "https://app.latchpointstudios.com/privacy", label: "Privacy" },
  { href: "https://app.latchpointstudios.com/terms", label: "Terms" },
];

const heading = "font-geist-mono text-[11px] uppercase tracking-[0.14em] text-[#6c6e76]";
const link = "text-sm text-[#a4a5ac] transition-colors hover:text-[#f5f5f4]";

// Always dark, like Latchpoint's own footer, on both themes.
export default function LatchpointFooter() {
  return (
    <footer className="border-t border-white/10 bg-[#08090b] font-geist">
      <div className="mx-auto max-w-7xl px-6 py-14 lg:px-10">
        <div className="flex flex-col justify-between gap-12 lg:flex-row">
          <div className="max-w-sm">
            <a href="/" aria-label="Latchpoint Real Estate, home">
              <LatchpointWordmark name="Real Estate" inverse />
            </a>
            <p className="mt-4 text-sm leading-relaxed text-[#a4a5ac]">
              The website and back office for real estate agents and brokerages, built and maintained by Latchpoint
              Studios in Edmond, Oklahoma.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-12 sm:gap-20">
            <div>
              <h3 className={heading}>The product</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {PRODUCT.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} className={link}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className={heading}>Latchpoint</h3>
              <ul className="mt-4 flex flex-col gap-3">
                {COMPANY.map((l) => (
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

        <div className="mt-14 border-t border-white/10 pt-8">
          <p className="text-xs text-[#6c6e76]">
            &copy; {new Date().getFullYear()} Latchpoint Studios. Edmond, Oklahoma.
          </p>
        </div>
      </div>
    </footer>
  );
}
