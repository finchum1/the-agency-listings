import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const quiet = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06] disabled:opacity-50";

const keyBytes = (b64) => {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const token = async () => (await supabase.auth.getSession()).data.session?.access_token || "";
const post = async (body) => {
  const res = await fetch("/api/push", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${await token()}` }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json;
};

// "Phone alerts" in My Profile: turns on notifications on THIS device (a phone with the app added to its Home Screen, or a computer's browser). The morning
// deadline run (api/deadline-nudges.js) then sends a short note of what is due. Subscriptions are per device; see api/push.js.
export default function PhoneAlerts() {
  const supported = typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const iphone = typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
  const installed = typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!supported) return;
    navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()).then((sub) => setOn(Boolean(sub))).catch(() => {});
  }, [supported]);

  const enable = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      if ((await Notification.requestPermission()) !== "granted") throw new Error("Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.");
      const key = await (await fetch("/api/push")).json();
      if (!key.publicKey) throw new Error("Alerts aren't available right now.");
      const reg = await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key.publicKey) }));
      await post({ action: "subscribe", subscription: sub.toJSON() });
      setOn(true);
      setNote("Alerts are on for this device.");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const disable = async () => {
    setBusy(true);
    setError("");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await post({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      setOn(false);
      setNote("");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true);
    setError("");
    setNote("");
    try {
      const r = await post({ action: "test" });
      setNote(r.ok ? "Sent. It should arrive in a few seconds." : "Nothing was sent. Turn alerts off and on again on this device.");
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mt-6">
      <h2 className="font-display text-lg font-semibold">Phone alerts</h2>
      <p className={`mt-1 text-xs ${muted}`}>A short notification on this device on mornings when something is due on a deal: key dates, tasks due, anything overdue. Tap it to open the deal.</p>
      {!supported ? (
        <p className="mt-3 text-sm">This browser can't show alerts. On an iPhone, add this app to your Home Screen first and open it from there.</p>
      ) : iphone && !installed ? (
        <p className="mt-3 text-sm">On an iPhone, alerts work from the app on your Home Screen: tap Share, then Add to Home Screen, open it from there and come back to this page.</p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input type="checkbox" checked={on} disabled={busy} onChange={(e) => (e.target.checked ? enable() : disable())} />
            <span className="font-medium">Send deadline alerts to this device</span>
          </label>
          {on && (
            <button type="button" onClick={test} disabled={busy} className={quiet}>
              Send a test
            </button>
          )}
        </div>
      )}
      {note && <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-400">{note}</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
