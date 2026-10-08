import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { LatchpointWordmark } from "./LatchpointMarks";
import ThemeToggle from "./MarketingThemeToggle";

// Latchpoint Studios' floating glass-pill header, as used on
// latchpointstudios.com and realestate.latchpointstudios.com, tagged "The
// Agency". Rendered by MarketingNav on the Latchpoint marketing subdomain
// only. The pill is fixed, so a spacer in the normal flow holds the same
// room the old in-flow header did and nothing on the page shifts.
//
// Links collapse into a menu below `lg` (the five product links plus the
// wordmark and tag need the room); the tag stays visible at every size.
export default function LatchpointNav({ links, pathname, open, onToggle, onClose }) {
  return (
    <>
      <div className="h-[92px] sm:h-[104px]" aria-hidden="true" />
      <header className="fixed inset-x-0 top-4 z-40 flex justify-center px-4 sm:top-6">
        <div className="relative w-full max-w-5xl">
          <div className="glass-pill flex items-center justify-between gap-2 rounded-full py-2 pl-4 pr-2 sm:gap-4 sm:pl-5">
            <a href="https://latchpointstudios.com" className="flex shrink-0 items-center" aria-label="Latchpoint Studios, home">
              <LatchpointWordmark tag="The Agency" />
            </a>

            <nav className="hidden items-center gap-1 lg:flex">
              {links.map((l) => {
                const active = pathname === l.path;
                return (
                  <Link
                    key={l.path}
                    to={l.path}
                    className={`group relative whitespace-nowrap px-3 py-1.5 font-geist text-sm transition-colors ${
                      active ? "text-(--lp-text)" : "text-(--lp-text-muted) hover:text-(--lp-text)"
                    }`}
                  >
                    {l.label}
                    <span
                      className={`absolute inset-x-3 -bottom-0.5 h-px origin-left bg-(--lp-ember) transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                        active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1">
              <ThemeToggle />
              <button
                type="button"
                onClick={onToggle}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-(--lp-text) transition-colors hover:bg-black/5 dark:hover:bg-white/10 lg:hidden"
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
                className="glass-pill glass-dense absolute inset-x-0 top-[calc(100%+0.5rem)] rounded-[20px] p-2 lg:hidden"
              >
                <div className="flex flex-col gap-1">
                  {links.map((l) => {
                    const active = pathname === l.path;
                    return (
                      <Link
                        key={l.path}
                        to={l.path}
                        onClick={onClose}
                        className={`rounded-xl px-3 py-2.5 font-geist text-[15px] transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${
                          active ? "text-(--lp-text)" : "text-(--lp-text-muted)"
                        }`}
                      >
                        <span className="inline-flex items-center gap-2">
                          {active && <span className="size-1.5 rounded-full bg-(--lp-ember)" />}
                          {l.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>
    </>
  );
}
