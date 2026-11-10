import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useCopy } from "../../TrackedLinks";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const pill = "rounded-full border border-black/10 dark:border-white/15 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/[0.04] dark:hover:bg-white/[0.06]";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2 disabled:opacity-50";
const input = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";

export const DOWNLOAD_URL = "/downloads/AgencyTextSync.zip";

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
  const [name, setName] = useState("My Mac");
  const [busy, setBusy] = useState(false);
  const [fresh, setFresh] = useState("");
  const [error, setError] = useState("");
  const [copied, copy] = useCopy();

  const load = useCallback(async () => {
    const { data } = await supabase.from("text_sync_devices").select("id, name, token_hint, created_at, last_seen_at, last_synced_at").is("revoked_at", null).order("created_at", { ascending: false });
    setDevices(data || []);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const make = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { data, error: err } = await supabase.rpc("create_text_sync_device", { p_name: name.trim() || "My Mac" });
    setBusy(false);
    if (err) return setError(err.message);
    setFresh(data);
    load();
  };
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

      <section>
        <h3 className="font-semibold mb-1">1. Install the app on your Mac</h3>
        <p className={`${muted} mb-2`}>For a Mac running macOS 13 or newer, signed in to the same Messages account as your iPhone. Open the download and drag the app to Applications. The first time, right-click it and choose Open (it isn\u2019t from the App Store). Then click the speech-bubble icon that appears in your menu bar.</p>
        <a href={DOWNLOAD_URL} className={pill} download>
          Download Agency Text Sync for Mac
        </a>
        <p className={`mt-2 text-xs ${muted}`}>When it asks, allow it under System Settings &gt; Privacy &amp; Security &gt; Full Disk Access. That's how a Mac lets an app read Messages.</p>
      </section>

      <section>
        <h3 className="font-semibold mb-1">2. Connect it to your account</h3>
        {fresh ? (
          <div className="rounded-xl border border-black/10 dark:border-white/15 p-3 space-y-2">
            <p className={muted}>Copy this connection code and paste it into the app. It's shown once.</p>
            <p className="break-all font-mono text-xs select-all rounded-lg bg-black/[0.04] dark:bg-white/[0.06] p-2">{fresh}</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => copy("code", fresh)} className={pill}>
                {copied === "code" ? "Copied ✓" : "Copy code"}
              </button>
              <button type="button" onClick={() => setFresh("")} className={pill}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={make} className="flex flex-wrap items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} aria-label="Name for this Mac" className={`${input} max-w-[14rem]`} />
            <button type="submit" disabled={busy} className={primary}>
              {busy ? "Making…" : "Make a connection code"}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}
        {devices.length > 0 && (
          <ul className="mt-3 divide-y divide-black/5 dark:divide-white/10">
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
        <h3 className="font-semibold mb-1">3. Choose whose texts and calls to sync</h3>
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
