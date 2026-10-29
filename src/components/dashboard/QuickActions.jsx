import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { boardPath, dealAccess } from "../../lib/deals";
import { dashboardGo } from "../../lib/dashboardGo";
import StartDealModal from "./people/StartDealModal";
import QuickAddModal from "./people/QuickAddModal";

const PLUS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const SEARCH = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4.5 4.5" />
  </svg>
);

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
export const SEARCH_HINT = isMac ? "⌘K" : "Ctrl K";

// Everything that can be added from anywhere, by what this person may do. `modal` ones open a window right here; the rest go to the page that adds them.
function addItems(profile, isAdmin, limited) {
  const deals = dealAccess(profile);
  const people = Boolean(profile?.people_enabled) && !limited;
  const items = [];
  if (people) items.push({ key: "lead", label: "Lead", hint: "Someone new to follow up with", modal: "lead" });
  if (people) items.push({ key: "pipeline", label: "Pipeline contact", hint: "Someone you're already working with", modal: "pipeline" });
  if (deals.any && !limited) items.push({ key: "deal", label: "Deal", hint: "Start a transaction", modal: "transaction" });
  if (people) items.push({ key: "contact", label: "Contact", hint: "Add to your contacts", to: "/dashboard/people/contacts?new=1" });
  items.push({ key: "listing", label: "Listing", hint: "A new property", to: "/dashboard/listings/new" });
  if ((profile?.site_access || "full") !== "none" && !limited) items.push({ key: "blog", label: "Blog post", hint: "Write for your site", to: "/dashboard/site/blog?new=1" });
  if (isAdmin) items.push({ key: "vendor", label: "Vendor", hint: "Add a preferred vendor", to: "/dashboard/vendors?new=1" });
  return items;
}

// The + button and the search button at the top of the menu (full width in the open menu, icons in the rail), the menu of things to add, and the
// windows for the quick adds. `onSearch` opens the dashboard search (it lives in the layout, once).
export default function QuickActions({ rail = false, limited = false, onSearch, onNavigate }) {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null); // { x, y, w } when open
  const [modal, setModal] = useState(null); // lead | pipeline | transaction
  const button = useRef(null);
  const items = addItems(profile, isAdmin, limited);

  useEffect(() => {
    if (!menu) return undefined;
    const close = (e) => {
      if (e.type === "keydown" && e.key !== "Escape") return;
      if (e.type === "pointerdown" && (e.target.closest?.("[data-add-menu]") || button.current?.contains(e.target))) return;
      setMenu(null);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("resize", close);
    };
  }, [menu]);

  const toggle = () => {
    if (menu) return setMenu(null);
    const r = button.current.getBoundingClientRect();
    setMenu(rail ? { x: r.right + 10, y: r.top, w: 232 } : { x: r.left, y: r.bottom + 6, w: Math.max(r.width, 232) });
  };
  const choose = (item) => {
    setMenu(null);
    if (item.modal) setModal(item.modal);
    else {
      onNavigate?.();
      dashboardGo(navigate, item.to);
    }
  };

  const plusLabel = "Add something new";
  const plusButton = rail ? (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-label={plusLabel}
      aria-haspopup="menu"
      aria-expanded={Boolean(menu)}
      title={plusLabel}
      className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17] shadow-sm transition-transform hover:scale-105 active:scale-95"
    >
      {PLUS}
    </button>
  ) : (
    <button
      ref={button}
      type="button"
      onClick={toggle}
      aria-haspopup="menu"
      aria-expanded={Boolean(menu)}
      className="flex w-full items-center gap-3 rounded-xl bg-[#1c1a17] dark:bg-[#faf9f7] px-3 py-2.5 text-sm font-semibold text-white dark:text-[#1c1a17] transition-opacity hover:opacity-90"
    >
      {PLUS}
      <span>Add new</span>
    </button>
  );
  const searchButton = rail ? (
    <button
      type="button"
      onClick={onSearch}
      aria-label="Search the dashboard"
      title={`Search (${SEARCH_HINT})`}
      className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl text-[#1c1a17]/60 dark:text-[#faf9f7]/60 transition-colors hover:bg-black/5 dark:hover:bg-white/10 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]"
    >
      {SEARCH}
    </button>
  ) : (
    <button
      type="button"
      onClick={onSearch}
      className="flex w-full items-center gap-3 rounded-xl border border-black/10 dark:border-white/15 px-3 py-2.5 text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
    >
      {SEARCH}
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden md:inline-block rounded-md border border-black/10 dark:border-white/15 px-1.5 py-0.5 text-[10px] font-medium text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{SEARCH_HINT}</kbd>
    </button>
  );

  return (
    <>
      <div className={rail ? "flex flex-col gap-1.5" : "space-y-2"}>
        {plusButton}
        {searchButton}
      </div>
      {menu &&
        createPortal(
          <div
            data-add-menu=""
            role="menu"
            aria-label="Add something new"
            style={{ left: menu.x, top: Math.max(8, Math.min(menu.y, window.innerHeight - (items.length * 52 + 56))), width: menu.w }}
            className="fixed z-[60] rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] text-[#1c1a17] dark:text-[#faf9f7] p-1.5 shadow-xl print:hidden"
          >
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/40 dark:text-[#faf9f7]/40">Add new</p>
            {items.map((item) => (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                onClick={() => choose(item)}
                className="block w-full rounded-lg px-3 py-2 text-left transition-colors hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className="block text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">{item.hint}</span>
              </button>
            ))}
          </div>,
          document.body,
        )}
      {modal === "transaction" && (
        <StartDealModal
          coordinator={dealAccess(profile).isTc}
          onClose={() => setModal(null)}
          onStarted={(id) => {
            setModal(null);
            onNavigate?.();
            dashboardGo(navigate, `/dashboard/deals?deal=${id}`);
          }}
        />
      )}
      {(modal === "lead" || modal === "pipeline") && (
        <QuickAddModal
          kind={modal}
          onClose={() => setModal(null)}
          onAdded={(info) => {
            setModal(null);
            onNavigate?.();
            dashboardGo(navigate, info.id ? `${boardPath(info.kind)}?person=${info.id}` : boardPath(info.kind));
          }}
        />
      )}
    </>
  );
}
