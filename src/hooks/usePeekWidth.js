import { useCallback, useState } from "react";

// The three widths of the person side peek on a desktop. The wide one is where a deal's two columns (details beside the
// checklists) fit side by side. Remembered in this browser, separately for deals and for leads/pipeline.
export const PEEK_WIDTHS = {
  narrow: { label: "Narrow", px: 420 },
  standard: { label: "Standard", px: 600 },
  wide: { label: "Wide", px: 880 },
};

const keyFor = (isTransaction) => `peoplePeekWidth:${isTransaction ? "transaction" : "people"}`;

export function usePeekWidth(isTransaction) {
  const [choice, setChoice] = useState(() => {
    try {
      const saved = localStorage.getItem(keyFor(isTransaction));
      if (saved && PEEK_WIDTHS[saved]) return saved;
    } catch {
      /* storage blocked: fall back to the default */
    }
    return isTransaction ? "wide" : "standard";
  });
  const set = useCallback(
    (next) => {
      setChoice(next);
      try {
        localStorage.setItem(keyFor(isTransaction), next);
      } catch {
        /* just won't be remembered */
      }
    },
    [isTransaction],
  );
  // Never wider than the screen leaves room for (the dashboard menu stays reachable).
  const css = `min(${PEEK_WIDTHS[choice].px}px, calc(100vw - 8rem))`;
  return { choice, set, css };
}
