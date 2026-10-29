import { useEffect, useRef } from "react";
import { tabTitle } from "../../lib/tabTitles";

// The row of dashboard tabs (see hooks/useDashboardTabs.js): one per open page, a close button on each (while there is more than one), and a + that
// opens a new tab on Home.
export default function TabBar({ tabs, active, onSelect, onAdd, onClose, max }) {
  const scroller = useRef(null);
  useEffect(() => {
    scroller.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, tabs.length]);
  const many = tabs.length > 1;

  return (
    <div className="sticky top-0 z-30 flex items-center gap-1.5 bg-[#faf9f7] dark:bg-[#0d0d0d] pl-4 md:pl-9 pr-3 pt-3.5 pb-2 print:hidden">
      <div ref={scroller} role="tablist" aria-label="Open pages" className="flex min-w-0 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const on = tab.id === active;
          const title = tabTitle(tab.url);
          return (
            <div
              key={tab.id}
              className={`group relative flex h-8 min-w-[7rem] max-w-[13rem] shrink-0 items-center rounded-xl border text-sm transition-colors ${
                on
                  ? "border-black/10 dark:border-white/15 bg-white dark:bg-[#1f1f1f] text-[#1c1a17] dark:text-[#faf9f7] shadow-sm"
                  : "border-transparent text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10"
              }`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={on}
                title={title}
                onClick={() => onSelect(tab.id)}
                onAuxClick={(e) => e.button === 1 && many && onClose(tab.id)}
                className="min-w-0 flex-1 truncate rounded-xl py-1.5 pl-3.5 pr-1 text-left font-medium"
              >
                {title}
              </button>
              {many && (
                <button
                  type="button"
                  onClick={() => onClose(tab.id)}
                  aria-label={`Close ${title}`}
                  title="Close tab"
                  className={`mr-1.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:bg-black/10 dark:hover:bg-white/15 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] ${
                    on ? "" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                  }`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => onAdd()}
        disabled={tabs.length >= max}
        aria-label="New tab"
        title={tabs.length >= max ? "That's the most tabs you can open" : "New tab"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#1c1a17]/60 dark:text-[#faf9f7]/60 transition-colors hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-30"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    </div>
  );
}
