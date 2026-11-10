import { useEffect, useState } from "react";

// Inside the Latchpoint Mac app the page has window.latchpoint, and the app keeps window.latchpoint.textSync up to date with what text sync is doing
// ({ state, message, contacts, lastSync, lastSaved, totalSaved }) and fires "latchpoint:textsync" when it changes. In a normal browser neither exists.
const read = () => (typeof window !== "undefined" && window.latchpoint ? { inApp: true, status: window.latchpoint.textSync || null } : { inApp: false, status: null });

export function useNativeTextSync() {
  const [s, setS] = useState(read);
  useEffect(() => {
    const onChange = () => setS(read());
    window.addEventListener("latchpoint:textsync", onChange);
    onChange();
    return () => window.removeEventListener("latchpoint:textsync", onChange);
  }, []);
  const post = (message) => window.latchpoint?.postMessage?.(message);
  return { ...s, post };
}
