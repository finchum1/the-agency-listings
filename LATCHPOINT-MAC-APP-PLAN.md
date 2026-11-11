# Latchpoint for Mac: plan

> **Status (2026-11-11):** stages 1 to 4 and most of 5 are built, in `../latchpoint-mac`: the web shell, text sync (Latchpoint Text is retired), notifications / menu bar / quick add, native Contacts, and native Today (with Tasks), Deals (board, list, detail, checklist actions). Still ahead: Developer ID signing and notarization (needs the Apple Developer Program under Latchpoint Studios, LLC), Sparkle auto-update, and Deals actions beyond the checklist (stage moves, documents, signatures, compliance stay in the dashboard for now). The notes below are the original plan.
>
> **Parked for a possible future build (decided 2026-11-11):** Deals signatures, the compliance review and its Messages thread (sending a deal for review, send-backs). They stay in the dashboard; the Mac app's Messages tab points there.

Written 2026-11-10. A native Mac app for the whole dashboard, built in stages. Nothing here is built yet except the Text sync engine (the Latchpoint Text app, `agency-text-sync/`).

## 1. What it is, in one paragraph

One app called **Latchpoint** that agents install from your site. It is a real Mac app (Dock icon, menu bar, notifications, keyboard shortcuts, auto-update) that **shows the existing dashboard inside it** and adds the things a browser tab can't do: text and call sync from Messages, instant alerts for new leads, a menu-bar "Today" view, a quick-add hotkey, and click-to-call / click-to-text. Over time the screens agents use all day (Contacts, Today, Deals, Tasks) become fully native. Rarely used screens (site editor, settings, analytics) stay web inside the app. That is a feature, not a shortcut: it keeps one source of truth and keeps the app shippable at every stage.

## 2. Why hybrid, not a full native rewrite

What exists today (measured, not guessed):

| | Size |
|---|---|
| Dashboard screens (React) | 136 files, about 28,700 lines |
| Routes | about 116 |
| Hooks (data logic) | 53 |
| API functions | 35 |
| Sign-in | email + password only (no Google sign-in), so an embedded web view works |
| Data access | Supabase with row-level security, called straight from the browser |
| Live updates | none today; menu bubbles refresh by polling |
| Push notifications | none today (alerts go by email) |

A full native rewrite means rebuilding all of that and then keeping two apps in step with every schema change. It would take months before agents saw anything new. The hybrid ships something useful in the first stage and gets more native each stage.

**The rule for deciding what goes native:** native only where the screen is used daily and native makes it clearly better (speed, search, offline, system integration). Everything else stays web.

## 3. Architecture

```
Latchpoint.app  (Swift / SwiftUI, one process)
 ├─ Shell        windows, toolbar, menu commands, Dock, deep links (latchpoint://), auto-update (Sparkle)
 ├─ Web view     WKWebView showing app.latchpointstudios.com (the existing dashboard)
 ├─ Bridge       small two-way channel between the web page and the app (see 3.2)
 ├─ Services     Text sync engine, notifications, menu-bar "Today", quick add, Keychain
 └─ Native screens (stage 4 onward)  talk to Supabase directly with the signed-in session
```

### 3.1 Sign-in
- The user signs in on the dashboard's normal login page, inside the web view. The session lives in the web view's storage, so it persists between launches.
- The web page passes the session to the app through the bridge on sign-in and on every token refresh. The app keeps it in the Keychain and uses it for native calls and background work.
- **This removes the copy-and-paste connection code.** After sign-in the app creates its own Text sync device through the existing `create_text_sync_device` function. No new backend work.

### 3.2 The bridge
- The app injects `window.latchpoint = { version, postMessage }` into every page. The web app checks for it and changes its behavior: hide "Download Latchpoint Text", show sync status, route print/export/phone links through the app.
- Messages web -> app: session tokens, "open a native compose window", "start a call", "print this".
- Messages app -> web: "navigate to this route" (used by notifications and deep links).
- Everything is a small named message with a fixed shape, tested on both sides.

### 3.3 Data for native screens (stage 4 onward)
- Official `supabase-swift` for auth, REST and Realtime, so row-level security stays the only gatekeeper. No new "native API" to secure.
- Local cache in SQLite (GRDB) so lists open instantly and work offline; background refresh through Realtime plus a 60-second fallback.
- Writes go straight to the same tables the web uses. Server-side rules (triggers, RPC functions) stay the single source of truth.

### 3.4 Distribution
- Direct download from your site, signed with a Developer ID certificate and notarized. **Not the Mac App Store**: a sandboxed App Store app can't read Messages, and text sync is the headline feature.
- **Auto-update with Sparkle** so agents never re-download. The update feed and release files live on the platform. This is why notarization matters more than it first seems: without it every update re-triggers the "could not verify" dialog.
- Apple Developer Program enrolled as an **organization (Latchpoint Studios, LLC)**, which needs a D-U-N-S number. Start that first because it can take days to weeks.
- Minimum macOS 14 (recommended). The Text app currently supports 13; 14 gives native tables and inspectors for stage 4.

### 3.5 Repo and build
- New folder `latchpoint-mac/` with an Xcode project generated from a `project.yml` (XcodeGen), so it can use entitlements, an asset catalog, Sparkle and tests. The current Text sync code moves in as a module.
- One release script: build, sign, notarize, staple, zip, update the Sparkle feed, upload. Run by me, approved by you.

## 4. Stages

Sizes: S = a focused session, M = a few sessions, L = a multi-week chunk. These are rough.

### Stage 1: The shell (M)
**Goal:** open Latchpoint, sign in, use the whole dashboard in a real Mac window.
- Window with the web view, toolbar (back, forward, reload), standard shortcuts, remembers window size and position.
- Links to other sites open in the browser; `tel:`, `sms:` and `mailto:` links open FaceTime, Messages and Mail.
- Downloads work (flyer PDFs, CSV exports); file uploads and drag-and-drop work.
- **Printing** works (the web view needs explicit support for flyer printing).
- Friendly offline and error page.
- Session handoff to the app (3.1) built and tested even though stage 1 doesn't use it yet.
- **Done when:** you can do a full day of normal work in it, and printing a flyer, uploading a photo and exporting contacts all work.

### Stage 2: Latchpoint Text merged in (S to M)
- The sync engine becomes a module. After sign-in the app provisions its own device; first-run screen walks through Full Disk Access.
- Sync status in the menu bar and a Settings screen; the dashboard's Text sync modal shows "Syncing from this Mac" instead of the download button when it's running inside the app.
- Latchpoint Text is retired.
- **Done when:** a fresh install on a second Mac syncs with no code pasting.

### Stage 3: Notifications, menu bar, quick add (M)
- Native notifications for: a new website lead (with the speed-to-lead countdown), follow-ups due today, deal tasks due, new deal messages. Buttons on the notification: Call, Text, Open.
- Menu-bar "Today": leads waiting, follow-ups due, what's next. Click an item to open it.
- Global hotkey for quick add (contact, note, task, "log a call").
- Delivery: Realtime subscription on the existing tables, with the 60-second fallback. Works while the app is open and the Mac is awake. **It does not wake a sleeping or closed Mac**; email alerts keep covering that. True remote push (APNs) is a later option and needs an extra server piece.
- Possible small backend change: enable Realtime on a few tables (a migration, with your approval).
- **Done when:** a test website inquiry produces a notification within seconds and the Call button dials.

### Stage 4: Native Contacts (L)
- The first native screen, because 1,446 contacts and 48,000 synced messages make it the best case: instant search, a real table, a detail panel, and a History timeline with the texts and calls, offline.
- Click-to-call and click-to-text through the iPhone and Messages.
- Tags, filters, bulk actions and import stay web for the first release (open in the web view); they move over later.
- **Done when:** it can replace the web Contacts page for daily use without losing anything you use daily.

### Stage 5: Native Today, Tasks, Deals (L)
Same approach, one screen at a time, in the order you actually use them. Each ships as its own update.

### Stays web, inside the app (permanently)
Site editor, listing editor, flyers, social posts, marketing, settings, office analytics, agent management. They are used occasionally, are rich editors, and are expensive to duplicate.

## 5. Things that will bite (and what we do about them)

| Risk | What we do |
|---|---|
| Printing and downloads inside a web view are fiddly | Handle both explicitly in stage 1; test with real flyers |
| Two UIs (web and native) can drift apart | Native only where it clearly wins; schema rules live in the database, not in either UI |
| I can't see your screen, so visual polish needs your eyes | I build and test logic, the bridge and the sync engine; you review each stage visually, and I fix what you flag |
| Sparkle and notarization need the paid Apple membership | Enroll as the LLC first; until then builds are ad-hoc and need Open Anyway |
| Selling the business | Keep the signing identity, repo, domain and Sparkle keys in the LLC; document the release process |
| Brand clearance | "Latchpoint" is used by other software businesses; the app name and bundle id (`com.latchpoint.app`) should wait on the attorney's search before wide release |
| macOS only | Agents on Windows or iPad keep using the web. A later iPhone app can share much of stage 4+ if you want it |
| White-label for other brokerages | Not in this plan. Starts as "Latchpoint" for everyone; per-office branding in the app is a later decision |

## 6. What changes in the existing dashboard
- Small additions that check for `window.latchpoint`: hide the Mac download, show sync status, route print and phone links.
- No changes needed to existing tables for stages 1 and 2. Stage 3 may add a Realtime migration.
- Nothing about how the website works for people not using the app changes.

## 7. Decisions needed from you before stage 1
1. **App name:** "Latchpoint" (as the app) with the full name "Latchpoint Real Estate" on the website? Final name should wait for the trademark search before public release.
2. **Minimum macOS 14?** Do your agents have Macs that new? If many are on 13, stay on 13 and skip native tables.
3. **Apple Developer enrollment** as Latchpoint Studios, LLC: start the D-U-N-S request now.
4. **Where it's first used:** just you for a month before other agents, or straight to your office? (I recommend you alone first.)
5. **Alerts:** is "works while the app is open" enough for stage 3, or do you want alerts on a sleeping Mac (needs APNs, an extra build)?

## 8. Proposed order
1. You: start the D-U-N-S request and the Apple enrollment (calendar time, no work needed from me).
2. Me: stage 1 shell, then stage 2, then you use it daily for a week.
3. Me: stage 3.
4. Decide whether stage 4 (native Contacts) is worth the investment based on how stage 1 to 3 feel.
