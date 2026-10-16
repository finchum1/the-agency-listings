import { AnimatePresence, motion } from "framer-motion";
import { LatchpointWordmark } from "./LatchpointMarks";
import ThemeToggle from "./MarketingThemeToggle";

// Latchpoint Studios' floating glass-pill header, as used on
// latchpointstudios.com and realestate.latchpointstudios.com, tagged "The
// Agency". Rendered by MarketingNav on the Latchpoint marketing subdomain
// only. The pill is fixed, so a spacer in the normal flow holds the same
// room the old in-flow header did and nothing on the page shifts.
//
// Links collapse into a menu below `xl` (the five product links, the wordmark and tag, the theme switch and the
// early-access button need the room); the button shows from `lg`, the tag at every size. The theme switch sits
// directly left of the button.
// Same arrow as realestate.latchpointstudios.com's buttons, so the two pages' buttons are the same size.
function ArrowRight() {
  return (
    <svg width="15" height="15" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-0.5">
      <path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z" />
    </svg>
  );
}

export default function LatchpointNav({ links, open, onToggle, onClose }) {
  return (
    <>
      <div className="h-[92px] sm:h-[104px]" aria-hidden="true" />
      <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4 sm:top-6">
        <div className="relative w-full max-w-6xl">
          <div className="glass-pill flex items-center justify-between gap-2 rounded-full py-2 pl-4 pr-2 sm:gap-4 sm:pl-5">
            <a href="/" className="flex shrink-0 items-center" aria-label="Latchpoint Real Estate, home">
              <LatchpointWordmark name="Real Estate" />
            </a>

            <nav className="hidden items-center gap-1 xl:flex">
              {links.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="whitespace-nowrap px-3 py-1.5 font-geist text-sm text-(--lp-text-muted) transition-colors hover:text-(--lp-text)"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <a
                href="/#early-access"
                className="group ml-1 hidden items-center justify-center gap-2 whitespace-nowrap rounded-full bg-(--lp-ember) px-5 py-2 font-geist text-sm font-medium leading-none text-[#08090b] transition-colors hover:bg-[#f0714f] lg:inline-flex"
              >
                Request early access
                <ArrowRight />
              </a>
              <button
                type="button"
                onClick={onToggle}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-(--lp-text) transition-colors hover:bg-black/5 dark:hover:bg-white/10 xl:hidden"
              >
                {open ? (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                className="glass-pill glass-dense absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-[20px] p-2 xl:hidden"
              >
                <div className="flex flex-col gap-1">
                  {links.map((l) => (
                    <a
                      key={l.href}
                      href={l.href}
                      onClick={onClose}
                      className="rounded-xl px-3 py-2.5 font-geist text-[15px] text-(--lp-text-muted) transition-colors hover:bg-black/5 hover:text-(--lp-text) dark:hover:bg-white/10"
                    >
                      {l.label}
                    </a>
                  ))}
                  <a
                    href="/#early-access"
                    onClick={onClose}
                    className="mt-1 rounded-full bg-(--lp-ember) px-5 py-3 text-center font-geist text-[15px] font-medium text-[#08090b]"
                  >
                    Request early access
                  </a>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  );
}
