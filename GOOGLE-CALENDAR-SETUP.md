# Turning on Google Calendar two-way sync (one-time setup)

The dashboard home page can connect each agent's Google account so their calendars stay in sync both ways: events
show live, and events added or edited on the dashboard appear in Google Calendar. The code is built and deployed; it stays
hidden ("hasn't been switched on") until this setup is done once.

## 1. Create the Google "app" (about 10 minutes, Google Cloud Console)

1. Go to https://console.cloud.google.com and sign in with the Google account that should own this. Create a project, for example "Agency Dashboard".
2. **APIs & Services → Library → Google Calendar API → Enable.**
3. **APIs & Services → OAuth consent screen** (called "Google Auth platform" in the newer console):
   - **User type.** If every agent signs in with a Google Workspace address on one domain (for example @theagencyre.com) and the project belongs to that Workspace, choose **Internal**: no review by Google, no warning screen, any user in that Workspace. Otherwise choose **External**.
   - App name "The Agency Dashboard" (or your own), your support email, authorized domain **latchpointstudios.com**.
   - **Scopes** (add these four): `openid`, `email`, `.../auth/calendar.events`, `.../auth/calendar.calendarlist.readonly`.
   - If you chose **External**, press **Publish app** (status: *In production*). Left in "Testing", Google expires every connection after 7 days. Until Google verifies the app, agents see an "unverified app" screen they click through (Advanced → Go to ... (unsafe)), and Google caps unverified apps at 100 users. Verification is a review Google does for calendar scopes; start it before you add more than a handful of outside brokerages.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID → Web application.**
   - **Authorized redirect URI:** `https://app.latchpointstudios.com/api/google-callback`
   - (Optional second one for testing on the Vercel address: `https://the-agency-listings.vercel.app/api/google-callback`.)
   - Copy the **Client ID** and **Client secret**.

## 2. Give them to the dashboard (Vercel)

Vercel → the-agency-dashboard → Settings → Environment Variables → add for **Production**:

- `GOOGLE_CLIENT_ID` = the Client ID
- `GOOGLE_CLIENT_SECRET` = the Client secret (mark it *Sensitive*; paste it yourself, never into a chat)

Then redeploy (Deployments → ... → Redeploy). Nothing else is needed: refresh tokens are encrypted with a key derived from the
existing `SUPABASE_SERVICE_ROLE_KEY`.

## 3. Try it

Dashboard home → **Schedule → Calendars → Connect a Google account**. Approve, choose which calendars to show, and add an event with **+ Event**.

## Good to know

- Rotating `SUPABASE_SERVICE_ROLE_KEY` makes stored Google tokens unreadable; agents would just reconnect (the dashboard flags them "Needs reconnecting").
- An agent can disconnect any time (this also revokes access at Google), or remove the app at https://myaccount.google.com/permissions.
- Only these Google scopes are requested: calendar events, the calendar list, and the account's email. The dashboard never asks for Gmail, Drive or contacts.
- Linking by a calendar's private iCal address (view only) still works without any of this.
