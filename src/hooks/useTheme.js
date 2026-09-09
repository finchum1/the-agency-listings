import { useEffect, useState } from "react";

// Three-way preference — "light" | "dark" | "system" — stored under this
// key so the anti-flash inline script in index.html and this hook agree
// on where to look. "system" is the default (no stored value): follows
// the OS/browser preference and stays live if the user changes it while
// the app is open.
const STORAGE_KEY = "dash-theme";

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolvedIsDark(preference) {
  return preference === "dark" || (preference === "system" && systemPrefersDark());
}

// Applies (or removes) the `dark` class on <html>. Exported so both this
// hook and the index.html anti-flash script apply the exact same rule —
// duplicated there in plain JS (a hook can't run before React mounts).
export function applyTheme(preference) {
  document.documentElement.classList.toggle("dark", resolvedIsDark(preference));
}

function readStoredPreference() {
  try {
    return localStorage.getItem(STORAGE_KEY) || "system";
  } catch {
    return "system";
  }
}

// Reactive read/write access to the theme preference, for the toggle UI
// in MyProfilePage.jsx. The actual class-on-<html> application already
// happened before first paint (index.html's inline script) and on every
// change here — this hook mostly just tracks what to show as "selected"
// and re-applies when the user picks a new option or the OS theme shifts
// while "system" is active.
export function useTheme() {
  const [preference, setPreference] = useState(readStoredPreference);

  useEffect(() => {
    applyTheme(preference);
    try {
      localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      // private browsing / storage blocked — theme still applies for
      // this load, it just won't be remembered next visit.
    }
  }, [preference]);

  // While "system" is selected, keep following the OS preference live
  // (e.g. the user's Mac switches to dark mode at sunset) without
  // needing a reload.
  useEffect(() => {
    if (preference !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  return [preference, setPreference];
}
