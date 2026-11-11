import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useNativeTextSync } from "../../../../hooks/useNativeTextSync";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const pill = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";

export const DOWNLOAD_URL = "/downloads/Latchpoint.zip";

const STATE_TITLE = { signedOut: "Signed out", registering: "Connecting…", noContacts: "Connected", needsAccess: "Needs permission to read Messages", syncing: "Syncing…", upToDate: "Syncing from this Mac", error: "Problem" };

const ago = (iso) => {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} hours ago`;
  return new Date(iso).toLocaleDateString();
};

// Contacts > Text sync: connect a Mac (the app that reads Messages and calls there), and choose whose texts and calls come in.
// Who syncs is per contact (a switch on the contact, or "Sync texts" on a selection / a tag / a smart list); this is where an agent turns it on for everyone.
export default function TextSyncModal({ contacts, onClose, onSetAll }) {
  const [devices, setDevices] = useState([]);
  const app = useNativeTextSync();

  const load = useCallback(async () => {
    const { data } = await supabase.from("text_sync_devices").select("id, name, token_hint, created_at, last_seen_at, last_synced_at").is("revoked_at", null).order("created_at", { ascending: false });
    setDevices(data || []);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const disconnect = async (d) => {
    if (!confirm(`Disconnect ${d.name}? Its app stops syncing until you connect it again.`)) return;
    await supabase.rpc("revoke_text_sync_device", { p_id: d.id });
    load();
  };

  const active = contacts.filter((c) => !c.archived);
  const syncing = active.filter((c) => c.text_sync).length;
  const withPhone = active.filter((c) => (c.phone || "").replace(/\D/g, "").length >= 7 || (c.other_phones || []).some((p) => String(p).replace(/\D/g, "").length >= 7));

  return (
    <div className="space-y-6 text-sm">
      <p className={muted}>
        Texts and calls between you and the contacts you pick show up in their History, so you can see the whole conversation in one place. A small app on your Mac reads Messages and your call history there and sends only
        the one-to-one conversations with contacts you've turned on. Nothing else leaves your Mac, and nobody else can see them.
      </p>

      {app.inApp ? (
        <section>
          <h3 className="font-semibold mb-1">1. This Mac</h3>
          <div className="rounded-xl border border-black/10 dark:border-white/15 p-3 space-y-2">
            <p className="font-semibold">{app.status ? STATE_TITLE[app.status.state] || "Text sync" : "Latchpoint is running"}</p>
            <p className={muted}>{app.status?.message || "Text sync starts as soon as you're signed in."}</p>
            {app.status?.lastSync && <p className={`text-xs ${muted}`}>Last checked {ago(app.status.lastSync)}{app.status.totalSaved ? ` · ${app.status.totalSaved.toLocaleString()} saved since Latchpoint opened` : ""}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => app.post({ type: "sync_now" })} disabled={app.status?.state === "syncing" || app.status?.state === "signedOut"} className={`${pill} disabled:opacity-50`}>
                Sync now
              </button>
              {app.status?.state === "needsAccess" && (
                <button type="button" onClick={() => app.post({ type: "open_full_disk_access" })} className={pill}>
                  Allow access to Messages…
                </button>
              )}
            </div>
            {app.status?.state === "needsAccess" && <p className={`text-xs ${muted}`}>Switch on Latchpoint in Full Disk Access, then choose Relaunch Latchpoint from its menu-bar icon.</p>}
          </div>
          <p className={`mt-2 text-xs ${muted}`}>Syncing runs while Latchpoint is open. Closing its window keeps it running in the menu bar.</p>
        </section>
      ) : (
        <section>
          <h3 className="font-semibold mb-1">1. Get the Latchpoint app for your Mac</h3>
          <p className={`${muted} mb-2`}>
            For a Mac running macOS 14 or newer. Open the download and drag the app to Applications. Until the app is notarized by Apple, your Mac will say it "could not verify" it: click Done, open System Settings &gt; Privacy &amp; Security, scroll down to the message about
            Latchpoint and click Open Anyway. Then sign in with your normal login, and text sync sets itself up. There's no code to copy.
          </p>
          <a href={DOWNLOAD_URL} className={pill} download>
            Download Latchpoint for Mac
          </a>
          <p className={`mt-2 text-xs ${muted}`}>When it asks, allow it under System Settings &gt; Privacy &amp; Security &gt; Full Disk Access. That's how a Mac lets an app read Messages.</p>
        </section>
      )}

      <section>
        <h3 className="font-semibold mb-1">Your connected Macs</h3>
        {devices.length === 0 ? (
          <p className={muted}>None yet.</p>
        ) : (
          <ul className="divide-y divide-black/5 dark:divide-white/10">
            {devices.map((d) => (
              <li key={d.id} className="py-2 flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="font-semibold">{d.name}</span>
                  <span className={`block text-xs ${muted}`}>
                    {d.last_seen_at ? `Last checked in ${ago(d.last_seen_at)}` : "Not connected yet"}
                    {d.last_synced_at ? ` · last sent ${ago(d.last_synced_at)}` : ""}
                  </span>
                </span>
                <button type="button" onClick={() => disconnect(d)} className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline">
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="font-semibold mb-1">2. Choose whose texts and calls to sync</h3>
        <p className={`${muted} mb-2`}>
          {syncing === 0 ? "No contacts are syncing yet." : `${syncing.toLocaleString()} contact${syncing === 1 ? " is" : "s are"} syncing.`} To pick people, open a contact and switch on Text sync, or select people in the list
          (filter by a tag or a smart list first, then select all) and choose Sync texts.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (confirm(`Turn text sync on for all ${withPhone.length.toLocaleString()} contacts that have a phone number?`)) onSetAll(withPhone.map((c) => c.id), true);
            }}
            className={pill}
          >
            Turn on for everyone with a phone number ({withPhone.length.toLocaleString()})
          </button>
          {syncing > 0 && (
            <button
              type="button"
              onClick={() => {
                if (confirm("Stop syncing for every contact? Texts already saved stay in their History.")) onSetAll(active.filter((c) => c.text_sync).map((c) => c.id), false);
              }}
              className={pill}
            >
              Turn off for everyone
            </button>
          )}
        </div>
        <p className={`mt-2 text-xs ${muted}`}>One-to-one texts and calls only; group texts aren't synced. Turning a contact off stops new ones; what's already saved stays until you delete it from their History.</p>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={pill}>
          Close
        </button>
      </div>
    </div>
  );
}
