import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

// Tabs across the top of the dashboard, like a browser's: each tab is a page (an address) you can leave and come back to, so several things can stay open
// at once. A tab remembers the last page you were on inside it, and the set of tabs is remembered between visits (per person, in this browser).
// Switching tabs opens that tab's page again, so a half-typed form doesn't wait in the background.
const MAX_TABS = 12;
const HOME = "/dashboard";
const newId = () => Math.random().toString(36).slice(2, 9);
const keyFor = (userId) => `dashboardTabs:${userId || "anon"}`;

function read(userId) {
  try {
    const v = JSON.parse(localStorage.getItem(keyFor(userId)) || "null");
    if (v && Array.isArray(v.tabs) && v.tabs.length && v.tabs.every((t) => t && typeof t.id === "string" && typeof t.url === "string" && t.url.startsWith("/dashboard"))) {
      return { tabs: v.tabs.slice(0, MAX_TABS), active: v.tabs.some((t) => t.id === v.active) ? v.active : v.tabs[0].id };
    }
  } catch {
    /* storage blocked or unreadable: start with one tab */
  }
  return null;
}

// Scroll back to where a tab was. The page is still loading when this starts, so it tries again for a couple of seconds until the page is tall enough.
function restoreScroll(y) {
  if (!(y > 0)) return;
  let tries = 0;
  const tick = () => {
    window.scrollTo(0, y);
    tries += 1;
    if (tries < 24 && Math.abs(window.scrollY - y) > 4) setTimeout(tick, 100);
  };
  setTimeout(tick, 60);
}

export default function useDashboardTabs(userId) {
  const location = useLocation();
  const navigate = useNavigate();
  const here = `${location.pathname}${location.search}`;
  const [state, setState] = useState(() => {
    const saved = read(userId);
    if (saved) return saved;
    const id = newId();
    return { tabs: [{ id, url: here }], active: id };
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  // The person's id can arrive after the first render: read their tabs when it does.
  const firstUserId = useRef(userId);
  useEffect(() => {
    if (firstUserId.current === userId) return;
    firstUserId.current = userId;
    const saved = read(userId);
    // The page you are on now belongs to the active tab, whatever it showed last time.
    if (saved) setState({ ...saved, tabs: saved.tabs.map((t) => (t.id === saved.active ? { ...t, url: here } : t)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Whatever page you are on belongs to the active tab.
  useEffect(() => {
    setState((s) => {
      const tab = s.tabs.find((t) => t.id === s.active);
      if (!tab || tab.url === here) return s;
      return { ...s, tabs: s.tabs.map((t) => (t.id === s.active ? { ...t, url: here } : t)) };
    });
  }, [here]);

  useEffect(() => {
    try {
      localStorage.setItem(keyFor(userId), JSON.stringify(state));
    } catch {
      /* a remembered set of tabs is a convenience */
    }
  }, [state, userId]);

  // The tab being left keeps how far down its page you were (only good for that same address).
  const leaving = (s) => s.tabs.map((t) => (t.id === s.active ? { ...t, scroll: { url: t.url, y: Math.round(window.scrollY) } } : t));

  const select = useCallback(
    (id) => {
      const s = stateRef.current;
      const tab = s.tabs.find((t) => t.id === id);
      if (!tab || id === s.active) return;
      setState({ tabs: leaving(s), active: id });
      navigate(tab.url);
      if (tab.scroll?.url === tab.url) restoreScroll(tab.scroll.y);
    },
    [navigate],
  );

  const add = useCallback(
    (url = HOME) => {
      if (stateRef.current.tabs.length >= MAX_TABS) return;
      const id = newId();
      setState((s) => ({ tabs: [...leaving(s), { id, url }], active: id }));
      navigate(url);
      window.scrollTo(0, 0);
    },
    [navigate],
  );

  const close = useCallback(
    (id) => {
      const s = stateRef.current;
      if (s.tabs.length <= 1) return;
      const index = s.tabs.findIndex((t) => t.id === id);
      const tabs = s.tabs.filter((t) => t.id !== id);
      if (s.active !== id) return setState({ tabs, active: s.active });
      const next = tabs[Math.min(index, tabs.length - 1)];
      setState({ tabs, active: next.id });
      navigate(next.url);
      if (next.scroll?.url === next.url) restoreScroll(next.scroll.y);
    },
    [navigate],
  );

  return { tabs: state.tabs, active: state.active, select, add, close, max: MAX_TABS };
}
