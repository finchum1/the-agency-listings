import { useState } from "react";
import { navPages, splitNav } from "../../lib/siteNav";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const arrow = "text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 px-1";

// The order of the pages in the site's header and footer menus. The pages listed are the ones the menus show right now (a page whose section is off, or the
// Sellers / Home Value / Buyers pages while they're off, aren't here). Drag a row or use the arrows; the new order is saved with the rest of the form as
// agent_sites.nav_order. Each page also says whether it sits in the header bar or in the menu button beside the phone number (agent_sites.nav_menu, the
// pages in the menu). `homeSections`, `landing`, `value` (nav_order) and `navMenu` come from the form.
export default function MenuOrderEditor({ homeSections, landing, value, onChange, navMenu = null, onNavMenu, hasSales = false }) {
  const pages = navPages({ homeSections, landing, navOrder: value, hasSales });
  const split = splitNav(pages, navMenu);
  const inMenu = new Set(split.more.map((p) => p.path));
  const place = (path, toMenu) => {
    const next = new Set(inMenu);
    if (toMenu) next.add(path);
    else next.delete(path);
    onNavMenu?.(pages.filter((p) => next.has(p.path)).map((p) => p.path));
  };
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const save = (list) => onChange(list.map((p) => p.path));
  const move = (from, to) => {
    if (to < 0 || to >= pages.length || from === to) return;
    const list = [...pages];
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    save(list);
  };
  const isCustom = (Array.isArray(value) && value.length > 0) || Array.isArray(navMenu);
  const seg = (on) => `px-2.5 py-1 text-xs font-medium transition-colors ${on ? "bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17]" : "text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:bg-black/5 dark:hover:bg-white/10"}`;

  return (
    <div className="space-y-2.5">
      <ul className="space-y-1.5" aria-label="Menu order">
        {pages.map((page, i) => (
          <li
            key={page.path}
            draggable
            onDragStart={() => setDragging(i)}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(i);
            }}
            onDragEnd={() => {
              setDragging(null);
              setOver(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragging != null) move(dragging, i);
              setDragging(null);
              setOver(null);
            }}
            className={`flex items-center gap-2 rounded-lg border bg-white dark:bg-[#1a1a1a] px-3 py-2 text-sm ${
              over === i && dragging !== i ? "border-[#ed2127] dark:border-[#f2454b]" : "border-black/10 dark:border-white/15"
            } ${dragging === i ? "opacity-50" : ""}`}
          >
            <span className={`cursor-grab select-none ${muted}`} aria-hidden="true">
              ⠿
            </span>
            <span className="flex-1 font-medium">{page.label}</span>
            {onNavMenu && (
              <span role="group" aria-label={`Where ${page.label} shows`} className="flex overflow-hidden rounded-full border border-black/10 dark:border-white/15">
                <button type="button" onClick={() => place(page.path, false)} aria-pressed={!inMenu.has(page.path)} className={seg(!inMenu.has(page.path))}>
                  Header
                </button>
                <button type="button" onClick={() => place(page.path, true)} aria-pressed={inMenu.has(page.path)} className={seg(inMenu.has(page.path))}>
                  Menu
                </button>
              </span>
            )}
            <button type="button" onClick={() => move(i, i - 1)} disabled={i === 0} className={arrow} title="Move earlier" aria-label={`Move ${page.label} earlier`}>
              ↑
            </button>
            <button type="button" onClick={() => move(i, i + 1)} disabled={i === pages.length - 1} className={arrow} title="Move later" aria-label={`Move ${page.label} later`}>
              ↓
            </button>
          </li>
        ))}
      </ul>
      {onNavMenu && (
        <p className={`text-xs ${split.bar.length > 6 ? "text-amber-700 dark:text-amber-400" : muted}`}>
          {split.bar.length} in the header, {split.more.length} in the menu button{split.bar.length > 6 ? ". That is a lot for the header: it will switch to the phone-style menu on all but the widest screens." : "."}
        </p>
      )}
      {isCustom && (
        <button
          type="button"
          onClick={() => {
            onChange([]);
            onNavMenu?.(null);
          }}
          className={`text-xs hover:underline ${muted}`}
        >
          Back to the standard order and layout
        </button>
      )}
    </div>
  );
}
