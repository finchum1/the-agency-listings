import { useCallback, useState } from "react";

// Width of the person side peek on a desktop. Three presets (the wide one is where a deal's two columns, details beside
// the checklists, fit side by side), and the left edge can be dragged to any width in between. Remembered in this
// browser, separately for deals and for leads/pipeline.
export const PEEK_WIDTHS = {
  narrow: { label: "Narrow", px: 420 },
  standard: { label: "Standard", px: 600 },
  wide: { label: "Wide", px: 880 },
};
export const PEEK_MIN_PX = 360;
const clamp = (n) => Math.max(PEEK_MIN_PX, Math.min(Math.round(n), Math.max(PEEK_MIN_PX, window.innerWidth - 128)));

const pxKey = (isTransaction) => `peoplePeekPx:${isTransaction ? "transaction" : "people"}`;
const oldKey = (isTransaction) => `peoplePeekWidth:${isTransaction ? "transaction" : "people"}`; // preset names, from the first version

function readSaved(isTransaction) {
  try {
    const px = Number(localStorage.getItem(pxKey(isTransaction)));
    if (px >= PEEK_MIN_PX) return px;
    const old = localStorage.getItem(oldKey(isTransaction));
    if (old && PEEK_WIDTHS[old]) return PEEK_WIDTHS[old].px;
  } catch {
    /* storage blocked: use the default */
  }
  return isTransaction ? PEEK_WIDTHS.wide.px : PEEK_WIDTHS.standard.px;
}

export function usePeekWidth(isTransaction) {
  const [px, setPxState] = useState(() => readSaved(isTransaction));
  const [resizing, setResizing] = useState(false);

  // While the edge is being dragged: just the number on screen, nothing written yet.
  const setPx = useCallback((n) => setPxState(clamp(n)), []);
  // Settled (a preset, or the drag ended): remember it.
  const commit = useCallback(
    (n) => {
      const v = clamp(n);
      setPxState(v);
      try {
        localStorage.setItem(pxKey(isTransaction), String(v));
      } catch {
        /* just won't be remembered */
      }
    },
    [isTransaction],
  );
  const preset = useCallback((key) => commit(PEEK_WIDTHS[key].px), [commit]);
  const choice = Object.keys(PEEK_WIDTHS).find((k) => PEEK_WIDTHS[k].px === px) || null;
  // Never wider than the screen leaves room for (the dashboard menu stays reachable).
  const css = `min(${px}px, calc(100vw - 8rem))`;
  return { px, choice, css, resizing, setResizing, setPx, commit, preset };
}
