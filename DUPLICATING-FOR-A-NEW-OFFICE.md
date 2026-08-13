# Duplicating this app for a new office

This app is **single-office by construction** — there's no multi-tenant data
model, no `office_id` column anywhere, no shared database across offices.
When you're ready to stand up a second office (e.g. Dallas), the plan is to
run a **second, fully independent copy** of this exact app: its own GitHub
repo, its own Supabase project, its own Vercel project/domain, its own
agents and listings. Nothing is shared with the Oklahoma instance — that's
deliberate, not a limitation to work around.

This is a checklist for that duplication, written for whenever that day
actually comes — nothing here needs doing today.

## 1. Fork the code

Duplicate this repo into a new one (e.g. `the-agency-listings-dallas`).
Easiest path: clone this repo fresh under the new name rather than forking
on GitHub, so its git history starts clean.

## 2. Swap every office-specific value

These are the *only* places this codebase assumes it's the Oklahoma office.
Grep for `Oklahoma`/`Edmond`/`the-agency-listings` in a fresh checkout if
this list ever drifts out of date.

| File | What to change |
|---|---|
| `src/lib/brokerage.js` | `name`, `address` (line1/city/state/zip), `disclaimer` — the big one, read by the dashboard header, every agent site's Navbar/Footer, listing pages, and the landing page |
| `public/images/brokerage-logo.png` | Replace with the new office's logo (same filename, or update the path in `brokerage.js` if you rename it) |
| `src/components/dashboard/DashboardLayout.jsx` | The location label next to the logo (currently hardcoded `"Oklahoma"`) |
| `src/lib/seo.js` | `SITE_ORIGIN` constant — used to build canonical URLs, sitemap entries, and Open Graph tags. Must match the new deployment's real domain |
| `public/robots.txt` | Its `Sitemap:` line has the same domain hardcoded — keep it in sync with `SITE_ORIGIN` above |
| `src/lib/appHosts.js` | Only needed **if** you attach a real custom domain (e.g. `theagencydallas.com`) — add it to `KNOWN_APP_HOSTS`. Skip this if the new deployment just lives at its own `*.vercel.app` URL; those are already recognized automatically |

Optional/cosmetic — not required, just regional flavor text in placeholder
examples an agent sees while filling out a form (nothing breaks if you skip
these): `src/components/dashboard/SiteForm.jsx`'s `"Oklahoma City Metro"`
placeholder, and `src/components/dashboard/ListingForm.jsx`'s `"Edmond, OK"`
placeholder example.

## 3. New Supabase project

Follow the main **README → Setup** steps 1, 3, and 4 (create the project,
local env, bootstrap the first admin), but run **all** of these SQL files
in the SQL Editor, in this order (the README's own list is short — this is
the complete, current one):

1. `supabase/schema.sql`
2. `supabase/storage-policies.sql` — first create the bucket it expects:
   **Storage → New bucket** → name `listing-photos` → **Public bucket: ON**
3. `supabase/add-login-enabled-column.sql`
4. `supabase/add-custom-domain-index.sql`
5. `supabase/agent-sites-schema.sql`
6. `supabase/agent-sites-storage-policies.sql` — first create its bucket:
   **Storage → New bucket** → name `agent-site-photos` → **Public bucket: ON**
7. `supabase/agent-sites-theming-and-domain.sql`
8. `supabase/seo-fields.sql`
9. `supabase/analytics.sql`

Then add the new deployment's URL + `/accept-invite` path to **Supabase →
Authentication → URL Configuration → Redirect URLs** (README's Deploy
section covers why).

## 4. New Vercel project

Follow the main README's **Deploy** section: new GitHub repo → connect to
Vercel → set env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, optionally `LEAD_FROM_EMAIL`)
pointing at the **new** Supabase project and a **new** Resend sending
identity (a shared Resend account is fine, but each office should send
from its own "from" address, e.g. `Dallas Inquiries <...>`) — attach a
domain if there's one for this office.

## 5. Content

Nothing carries over from Oklahoma — this is a genuinely fresh database.
Add the new office's agents via **Dashboard → Agents**; each agent then
fills in their own listings and site under **My Site**, same as today.

## Not covered here

`the-agency-oklahoma` (the public, office-wide marketing site + agent
directory) is a **separate project**, not part of this repo. If a new
office wants an equivalent public site, that's its own duplication effort
— this checklist only covers the listings/agent-sites dashboard app.
