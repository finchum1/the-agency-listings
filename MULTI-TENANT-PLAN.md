# Multi-tenant platform plan

Status: draft for review, written 2026-10-14. Nothing in this document has been built or changed yet.

This plans how to turn the dashboard that runs The Agency into one platform that can host many separate
organizations (other brokerages, and one-off agents), fully walled off from each other, managed by Latchpoint from one
place.

## 0. Decisions already made

1. Brokerages are **completely walled off** from each other and from The Agency.
2. **One-off agents get the full back office.** Their website access can be switched between full and blog-only, and
   their People (CRM) access can be switched on or off. These switches already exist on every profile
   (`profiles.site_access` = full / limited / none, `profiles.people_enabled`).
3. Brokerage websites and agent websites carry a **startup fee plus a monthly maintenance fee**. Billing stays in
   Latchpoint HQ (quotes, invoices, subscriptions already exist there).
4. Moving to **Vercel Pro and Resend Pro** (and a paid Supabase plan if needed) is approved.
5. The platform is **its own app, not built inside HQ.** HQ stays the private business console. The platform gets an
   organization switcher that only the Latchpoint owner sees. The two are linked (section 6.7).

## 1. Fix first: public sign-up can create an admin (security finding)

This is separate from the multi-tenant work and should be fixed **before anything else**, in production, now.

**What I found (read-only checks, no account was created):**

- Supabase Auth on The Agency project has public sign-up **enabled** (`disable_signup: false` from the project's
  public `/auth/v1/settings` endpoint).
- The database trigger `handle_new_user` copies `role` straight from the sign-up request's user metadata into the new
  profile: `coalesce(new.raw_user_meta_data->>'role', 'agent')`. The `profiles.role` check allows `'admin'`.
- The project URL and the anon key are public by design (they ship in the browser bundle).
- Email confirmation is on (`mailer_autoconfirm: false`), but an attacker only needs an inbox they control.

**What that means:** anyone could call the sign-up endpoint with `data: { role: "admin" }`, confirm their email, and
become an admin. Admins can read every lead (names, emails, phones), edit every listing and agent site, and call
`api/admin/agents.js`, which creates and deletes agents. I did not test this by creating an account, because that
would write to the live system, but the settings and the trigger say it works.

**Fix (small, independent of everything else):**

1. In the Supabase dashboard for The Agency Listings: Authentication, Sign In / Providers, turn **off** "Allow new
   users to sign up". Inviting agents still works, because invites go through the admin API.
2. Change `handle_new_user` so it never trusts metadata for `role`: always insert `'agent'`.
3. Update `api/admin/agents.js` to set the role (and `site_access`, `people_enabled`) with a follow-up service-role
   update after creating the user. The guard trigger already lets the service role through.
4. Check the profiles table for any admin you don't recognize. (There are 5 profiles today; two are admins, you and
   Stephen.)

The multi-tenant design below replaces this trigger anyway (section 6.3), but the hole is open today.

## 2. Goals and non-goals

**Goals**

- One codebase, one database, one deployment, many organizations.
- Zero data visible across organizations: leads, listings, agents, People/CRM, analytics, files.
- Per-organization brand: name, logos, colors, disclaimer, address, domains. No more hardcoded The Agency.
- You (platform owner) can switch into any organization, and nobody else can.
- The Agency keeps working, unchanged, as organization #1 through the whole migration.
- Independent agents are a first-class case (an organization with one person).

**Non-goals (for now)**

- Self-serve sign-up by new brokerages. You onboard everyone; HQ is the front door.
- Per-organization databases. Kept only as an escape hatch for a client who insists (same code, separate deployment).
- Rebuilding the public site templates. They stay; only their brand inputs change.

## 3. What blocks multi-tenancy today

Found by reading the schema, every RLS policy, the triggers, the storage policies and the code.

| Area | Today | Why it breaks with many organizations |
|---|---|---|
| Brand | `src/lib/brokerage.js` constant (name, logo, address, disclaimer) imported by 15 files; about 85 files mention The Agency, Oklahoma, Edmond, the brand red or the logo | Every organization would show The Agency's name and logo |
| "Admin" | `profiles.role = 'admin'` is checked in 30+ RLS policies, in the dashboard UI, and in `api/admin/agents.js` | An admin can read and edit everything in the database. Stephen would see other brokerages' leads |
| Office-shared data | `buyer_needs` and `upcoming_listings` are readable by **any signed-in user** (`auth.uid() IS NOT NULL`) | Intended for one office; across organizations it leaks. Must become same-organization only |
| Profiles | `profiles_read_public` lets **anyone**, signed in or not, read every profile (email, phone, license, role, login flags) | Public across tenants. Must become "agents with a published site, or my own organization" |
| Brokerage site | `brokerage_site` is a one-row table (`singleton_guard`); `brokerage_agents`, `brokerage_areas`, `brokerage_posts` are global lists; slugs unique globally; the app assumes a single row | Needs one per organization, with the app asking for the right one |
| Area templates | `area_template_areas` holds Oklahoma neighborhoods and a trigger copies them into **every new agent site** | A Texas agent would get Edmond and Nichols Hills. Templates must belong to an organization |
| Leads and views | `leads` and `page_views` have no organization; admin reads all | Needs organization scoping |
| Storage | Four public-read buckets; write rights depend on site/listing ownership or any admin; `brokerage-site-photos` writable by any admin | Writes must be limited to the organization's own folder |
| Hosts and domains | `KNOWN_APP_HOSTS`, `MARKETING_HOST`, `VERIFIED_HOSTS`, the Google verification map, `SITE_ORIGIN` and `robots.txt` are hardcoded; the sitemap and bot snapshots assume one brokerage | Must come from the database |
| Slugs | `agent_sites.slug`, `listings.slug` unique across the whole database; public URLs are `/sites/:slug` on one host | Fine if kept globally unique and reserved-word protected, but needs a policy (section 9) |
| Email | One `LEAD_FROM_EMAIL`; valuation leads go to `brokerage_site.contact_email` | Sender name and recipients must follow the organization |
| IDX | One Repliers key in the environment | Each brokerage will need its own IDX credentials |
| Sign-up | Section 1 | Replace the trigger, close public sign-up |
| Hosting | Vercel Hobby: at the 12-function cap, and Hobby is meant for non-commercial use | Move to Pro |

**Already good (keep):** People/CRM, checklists, documents and notes are scoped by `owner_id`, so even admins can't
read an agent's CRM. That is a selling point worth preserving: **organization admins should not see their agents' People
data either.** Contact forms look up the recipient server-side (never trusting the browser). Custom domains per site
already work.

## 4. Target architecture

### 4.1 Concepts

- **Organization**: the tenant. Type `brokerage` or `solo`. Owns agents, sites, listings, leads, brand, domains.
- **Membership**: each profile belongs to exactly one organization (`profiles.org_id`) with an `org_role`:
  `owner` (the solo agent, or the broker who signed up), `admin` (office staff), `agent`.
- **Platform admin**: you. A separate table (`platform_admins`), not a role value on profiles, so it can never be
  granted by a profile edit or a sign-up.

### 4.2 New tables

- `organizations`: `id`, `slug`, `name`, `type`, `status` (`active` | `paused` | `archived`), contact and address
  fields, `disclaimer`, `franchise_disclaimer`, `brand` (jsonb: logo variants, allowed accent colors, default theme,
  fonts), `features` (jsonb: website access ceiling, People allowed, IDX allowed, max agents), `idx_config`,
  `hq_client_id` (links to HQ), `created_at`.
- `org_domains`: `domain`, `org_id`, `kind` (`site` | `app`), `verified`. Replaces the hardcoded host lists. Existing
  per-site `custom_domain` columns keep working and are mirrored here.
- `platform_admins`: `user_id`.
- `audit_log`: `id`, `at`, `actor_id`, `org_id`, `action`, `detail`. Records platform-owner actions inside
  organizations (who switched in, what they changed).

### 4.3 Changes to existing tables

Full table-by-table list is in Appendix A. Summary: add `org_id` to every table that owns data directly (profiles,
listings, agent_sites, leads, upcoming_listings, buyer_needs, brokerage_*, area templates, page_views). Child tables
(photos, open houses, testimonials, areas, posts, calendar, redirects) inherit through their parent. People, notes,
tasks, documents and templates stay owner-scoped and need no organization column.

### 4.4 Access rules (RLS)

Three helper functions, security definer, with a fixed search path:

- `current_org_id()`: the signed-in user's organization.
- `is_org_admin(org uuid)`: owner or admin of that organization.
- `is_platform_admin()`: present in `platform_admins`.

Rule shapes that replace today's:

| Today | Becomes |
|---|---|
| `auth.uid() = agent_id OR role = 'admin'` | `auth.uid() = agent_id OR is_org_admin(org_id) OR is_platform_admin()` |
| `auth.uid() IS NOT NULL` (shared boards) | `org_id = current_org_id() OR is_platform_admin()` |
| `profiles` public read | published-site agent, or same organization, or platform admin |
| `status <> 'draft'` public read | unchanged, and the app filters by organization |
| People/CRM `owner_id = auth.uid() AND people_enabled` | unchanged, plus organization ceiling (4.6) |

### 4.5 Brand in the database, not in code

- Replace `src/lib/brokerage.js` with an organization lookup: for the dashboard, from the signed-in user; for public
  pages, from the site being viewed (site, then organization). A `useBrand()` hook and a `getBrand(site)` helper
  replace the 15 imports.
- Today's Agency-specific rules become per-organization data: the three logo variants (red/white/black), the two
  allowed accent colors (`#ed2127`, `#000000`), the disclaimer. The `accent_color` and `logo_variant` CHECK
  constraints are dropped and validated against the organization's brand instead.
- The Agency's red stays as The Agency's `brand` row. Latchpoint-built solo agents get a simple brand kit (logo,
  accent, fonts) chosen from the existing theme and font options.

### 4.6 Features and plans (what you sell)

`organizations.features` sets ceilings; profile switches stay as they are but can never exceed the ceiling:

- `site_access_max`: `full` | `limited` | `none`
- `people_allowed`: boolean
- `idx_allowed`: boolean
- `max_agents`: number

For a one-off agent, you set the switches (website full or blog-only, People on or off), so they only get what they
pay for. For a brokerage, the broker can manage their agents' switches up to the ceiling you set. A database trigger
enforces this so it holds even if someone calls the API directly.

### 4.7 The two apps, connected

- HQ client gets a `platform_org_id`. HQ shows an **Open dashboard** link that lands you in that organization (the
  switcher honors an `?org=` parameter after you sign in as platform admin).
- HQ shows read-only status per client: sites published or draft, agents, last blog post, organization status.
  HQ's server reads this from the platform database with a service key kept in HQ's private environment.
- Later: **Set up this client** in HQ calls a signed endpoint on the platform that creates the organization, invites
  the owner, and creates a draft site; and a lapsed subscription can set the organization to `paused`.

### 4.8 Domains and hosting

- One neutral app host for logins (name to be chosen, section 9). Public sites keep working at `/sites/:slug` and on
  each agent's own domain.
- Hardcoded host lists, `SITE_ORIGIN`, the Google verification tokens and the sitemap move to `org_domains` / the
  organization row. `middleware.js` already reads redirects with the public key per host; it will read domains the
  same way.
- Per-brokerage branded login domains come later (Phase 4).
- The agency marketing page (`theagency.latchpointstudios.com`) becomes The Agency's own showcase. The platform's
  pitch lives at `realestate.latchpointstudios.com`, which already exists.
- Vercel Pro lifts the 12-function limit. Nothing needs un-merging immediately; the merged functions can stay.

### 4.9 Email

- Phase 1: one shared, verified sender with the organization's name as the display name and the agent as reply-to.
- Resend Pro raises the 3-domain limit, which allows per-brokerage sending domains later.
- `api/contact.js` and `agent-site-contact.js` keep resolving recipients server-side from the database; the valuation
  form resolves the brokerage contact by organization.

## 5. Phases

Sizes are relative (S/M/L/XL), not calendar promises.

### Phase 0: Prepare (S)

1. Fix section 1 (sign-up hole) in production.
2. Upgrade Vercel to Pro; move The Agency Listings Supabase to a paid plan (backups, point-in-time recovery, test
   branches); upgrade Resend when per-brokerage domains are needed.
3. Take a full database backup and note the restore steps.
4. Create a staging copy: a Supabase branch (or a cloned project) plus a Vercel preview environment pointed at it.
5. Choose the platform name and app domain (section 9).
6. Have the conversation with The Agency (section 9).

### Phase 1: Organization core, The Agency as organization #1 (XL, the risky one)

1. **Migration A (additive, safe):** create `organizations`, `platform_admins`, `audit_log`, `org_domains`; add
   nullable `org_id` columns; create The Agency organization and backfill every row; add the helper functions.
2. **Migration B:** make `org_id` required, add foreign keys and indexes, add insert defaults (`org_id` from the
   signed-in user) so the current app keeps working unchanged.
3. **Migration C:** replace the RLS policies and storage policies table by table (Appendix A). Per-table: add new
   policy, test, drop old policy. Replace `handle_new_user` and `guard_profile_privileged_columns`; scope
   `copy_template_areas`.
4. **App changes:** organization provider and `useBrand()`; replace the 15 `brokerage.js` imports; replace
   `isAdmin` with organization role plus platform-admin; add the organization switcher; make every brokerage-site
   query filter by organization; DB-driven hosts.
5. **API changes** (Appendix C): scope by organization; `admin/agents.js` creates users inside the caller's
   organization.
6. **Cross-tenant test suite (must pass before cutover):** create two throwaway organizations with users in each;
   assert no read, write, delete, storage access, RPC or API route crosses between them, and that anonymous visitors
   only see published sites of the organization they're viewing.
7. **Cutover:** run on staging with a copy of production data; rehearse; then production in a quiet window with a
   backup taken immediately before. Migrations A and B are additive; only C changes behavior, and it can be rolled
   back by restoring policies from the saved definitions or restoring the backup.
8. **Acceptance for The Agency (before and after, same results):** login, agent edits site, publishes a blog post,
   lead form delivers, People board loads, brokerage site renders, terrencefinchum.com and denitahenryhomes.com
   render, sitemap and bot snapshots correct.

### Phase 2: One-off agents (L)

- "Create organization" for a solo agent: organization of type `solo` with the agent as owner and a default feature
  set (you control website and People switches).
- Per-organization **area template packs** (start empty or pick a city/state pack) instead of the Oklahoma set.
- Simplified brand kit editor.
- **Intake form to site:** import the answers from the HQ intake into the new draft site (name, bio drafts, areas,
  testimonials, socials, photos). This is the cross-project piece deferred earlier.
- Onboarding checklist stays in HQ.

### Phase 3: Brokerages (L)

- Brokerage site per organization (the existing brokerage-site templates, filtered by organization).
- Roster import (CSV) into `brokerage_agents`, and invite agents into the organization.
- Per-organization brand rules (logo variants, accent list, disclaimer, franchise language).
- Broker-managed agent switches within the ceiling; per-organization IDX credentials.

### Phase 4: Connect, automate, harden (M)

- HQ link: `platform_org_id`, status panel, **Open dashboard**, **Set up this client**, pause on lapsed subscription.
- Per-brokerage login domains and sending domains.
- Audit log viewer, per-organization analytics, export tool (offboarding), delete-organization flow that also cleans
  storage.

## 5a. Phase 1 progress log

**2026-10-14: database layer done and passing on STAGING** (not production yet).

Files (all in `supabase/`): `multi-tenant-1a-additive.sql`, `multi-tenant-1b-constraints-triggers.sql`,
`multi-tenant-1c-access-rules.sql`, and the release gate `tests/cross-tenant-leak-test.sql`.

Design choices made while building (small departures from section 4):
- **No separate `org_role` column.** `profiles.role` ('admin' | 'agent') now means "admin of THIS profile's organization".
  Platform owner lives only in `platform_admins`. A solo agent is an ordinary `agent` in a `solo` organization, which is what
  makes "only the platform owner can change a solo agent's website/People switches" enforceable.
- **Private settings are split out:** `organizations` is public brand/contact data (name, logos, address, disclaimer);
  `org_settings` (plan ceilings, IDX, HQ link) is private to the organization and the platform owner.
- **`profiles.org_id` stays nullable on purpose:** a new account with no organization can see nothing until the server assigns one.
- **Organization stamping by trigger** (`set_org_id`): the current app can insert rows without sending `org_id`.
- **Public profile visibility is narrower than before:** only the account itself, its organization, the platform owner,
  and agents with something published (a non-draft site or listing).
- **Brokerage tables are now one set per organization** (`unique(org_id)` / `unique(org_id, slug)`). The current brokerage pages still
  ask for "the" brokerage and work only because there is one organization; app queries must filter by organization (below).
- **Storage:** brokerage photos are scoped by a leading `{org_id}/` folder; legacy un-prefixed files belong to The Agency
  (`storage_path_org`). New uploads must use the organization folder.

Test result on staging: **106 of 106 checks pass** (reads, writes, storage, privacy, platform owner, anonymous, and
organization-stamping, each deny paired with a control). A mutation check confirmed the suite fails when a rule is deliberately weakened.
The current, unchanged app renders the same public pages against the migrated staging database.

**Still to do for Phase 1 (app side, then production cutover):**
1. `api/admin/agents.js`: set the new account's `org_id` (the caller's organization; platform owner passes one). **Required**, because a new
   account with no organization sees nothing.
2. Organization provider and `useBrand()`; replace the 15 `brokerage.js` imports and the hardcoded Agency text.
3. `isAdmin` becomes "admin of my organization or platform owner"; add the platform owner's organization switcher.
4. Every brokerage-site query filters by organization (hooks: useBrokerageSite, useBrokeragePost, useBrokerageArea, useBrokerageSiteEditor,
   the Brokerage*Manager components, `api/sitemap.js`); brokerage uploads use the `{org_id}/` folder.
5. DB-driven hosts (`appHosts.js`, `middleware.js`, `SITE_ORIGIN`).
6. Production cutover order: part A, deploy the API change, part B, part C, deploy the app, run the leak test and the acceptance flows,
   with a fresh backup right before and `rollback-policies-and-functions.sql` ready.

## 6. Testing strategy

- **Policy tests in SQL:** for each table, run as user A of org 1, user B of org 2, an anonymous visitor, an
  organization admin, and the platform admin; assert exactly what each can select, insert, update and delete.
- **Storage tests:** upload, overwrite and delete across organizations; public read still works for published assets.
- **API tests:** each `api/*` route called with another organization's ids.
- **Browser tests (Playwright):** The Agency flows before and after; a second test organization end to end.
- **Leak canary:** a scheduled check that creates nothing, only counts rows visible to a throwaway user in each table
  and alerts if the number is ever non-zero.
- **Performance:** indexes on `(org_id, ...)` for every filtered table; check the slow public-site queries.

## 7. Risks and how they are handled

| Risk | Handling |
|---|---|
| Cross-organization leak (the worst failure) | Helper-function policies, automated leak tests as a release gate, platform actions audited |
| Breaking The Agency's live system | Additive migrations first, staging rehearsal with production data, backup immediately before, smoke tests, rollback plan |
| Policy rewrite mistakes on 26 tables | One table at a time, new policy tested before the old is dropped |
| App assumes a single brokerage row | Find every `.single()` / unfiltered brokerage query and add the organization filter (listed in Appendix B) |
| Slug collisions between organizations | Keep slugs globally unique, reserve system words, suggest alternatives on conflict |
| Org admin seeing agent CRM | People stays owner-only by design; documented as a feature |
| Cost creep | Limits per plan (`max_agents`) and the Vercel/Supabase/Resend upgrades listed in section 8 |
| The Agency's franchise brand | Platform gets its own name; The Agency keeps its brand as its own organization (section 9) |

## 8. Costs (check current pricing before buying)

- **Vercel Pro**: required for commercial use and the function limit; I believe about $20 per user per month.
- **Supabase paid plan**: backups, point-in-time recovery and test branches; I believe about $25 per month.
- **Resend Pro**: more sending domains and volume; I believe about $20 per month.

I can't make these purchases. Confirm prices on each provider's pricing page.

## 9. Decisions

**Decided (2026-10-14):**

1. **Platform name:** "Latchpoint Real Estate" (working name; run a trademark and domain search before printing it
   anywhere). **App host:** `app.latchpointstudios.com`, a subdomain, not a new domain. The pitch site stays at
   `realestate.latchpointstudios.com`, and `theagency.latchpointstudios.com` stays as The Agency's showcase. The app
   host is a setting in the database (`org_domains`, kind `app`), never hardcoded, so it can be changed later and
   brokerages can get their own (section 4.8 and the notes below).
2. **The Agency agreement:** the real counterparty is The Agency Oklahoma, not the national brand. A draft term sheet
   is in `../latchpoint-business-docs/Agency-Oklahoma-Term-Sheet-DRAFT.docx`. It needs an attorney's review and a
   check of the franchise agreement before anything is signed.
3. **One-off agent switches:** Latchpoint (platform owner) controls website access and People access for solo agents.
4. **Slugs:** one global namespace for `/sites/:slug`, with reserved words and automatic suggestions on a clash.
   Each client's own domain is their real address.
5. **Offboarding:** clients can export blog posts, listings and leads any time. After they leave, data is kept 90 days
   (read-only, exportable), then deleted.
6. **Support:** Latchpoint handles platform and website issues for everyone. Brokerage admins handle their own
   agents' basics (password resets, access switches within the plan ceiling).

**Still open:** pricing model and amounts, who signs for The Agency Oklahoma, what happens to an agent's site when
they leave an office, and MLS/IDX account ownership (all listed in the term sheet's "To settle before signing").

### Changing the app domain later, and brokerage-owned dashboard domains

- **Moving `app.latchpointstudios.com` later is easy and low risk.** Public client sites are unaffected (they run on
  their own domains). What changes: users sign in again once (login sessions belong to a domain), anyone who installed
  the dashboard as a phone/desktop app reinstalls it, and the new host must be added to the Supabase Auth redirect
  list. The old host can keep redirecting forever, so old invite links and bookmarks keep working.
- **A brokerage's own dashboard domain** (for example `dashboard.theirbrokerage.com`) is supported by the design as
  a Phase 4 item: they add one DNS record, we attach the domain in Vercel (the certificate is automatic), add it to
  `org_domains`, and add it to the Supabase redirect list. The login page loads that organization's logo and colors
  from the host. Invite and reset emails must use that host. This can be automated, but it is a few steps per
  brokerage, so it is not needed on day one.
- **Cheaper in between:** a branded login on the shared host, `app.latchpointstudios.com/o/<org-slug>`, with no DNS
  work. It shows the brokerage's logo and colors before sign-in.

## Appendix A: table-by-table change list

| Table or object | Change |
|---|---|
| `profiles` | Add `org_id`, `org_role`. Replace public read with published-site / same-organization / platform. Guard trigger becomes organization-aware (organization admins manage their own members only; nobody can grant platform admin) |
| `platform_admins`, `organizations`, `org_domains`, `audit_log` | New |
| `listings` | Add `org_id`. Owner / organization admin / platform write. Public read of non-draft unchanged. Slug stays globally unique |
| `listing_photos`, `open_houses` | Inherit through listing; policies updated to organization helpers |
| `agent_sites` | Add `org_id`. Drop accent and logo CHECKs in favor of per-organization brand validation |
| `agent_site_testimonials`, `agent_site_areas`, `agent_site_posts`, `agent_blog_calendar`, `site_redirects` | Inherit through site; policies updated |
| `leads` | Add `org_id`. Read: the agent, their organization admin, or platform |
| `page_views` | Add `org_id` (set by `api/track-view.js`). Read: organization-scoped |
| `upcoming_listings`, `buyer_needs` | Add `org_id`. Read becomes same-organization only (today: any signed-in user) |
| `brokerage_site` | Remove `singleton_guard`; add `org_id` unique; one row per brokerage organization |
| `brokerage_agents`, `brokerage_areas`, `brokerage_posts` | Add `org_id`; slug unique per organization |
| `area_template_areas` | Add nullable `org_id` (null = platform default pack); `copy_template_areas` copies the organization's pack, or nothing |
| `people`, `people_notes`, `people_settings`, `checklist_templates`, `document_templates`, `transaction_tasks`, `transaction_documents` | No organization column. Stay owner-scoped. `people_enabled` must also respect the organization ceiling |
| `handle_new_user` | Never read role from metadata; always `agent`; organization comes from a server-side invite |
| `copy_template_areas`, `create_person_from_lead` | Scope by organization |
| Buckets `agent-site-photos`, `brokerage-site-photos`, `listing-photos`, `profile-photos` | Public read stays (public sites need it). Write policies check the caller's organization; `brokerage-site-photos` write limited to that organization's admins. Folder convention starts with the organization id for new uploads |

## Appendix B: code to touch

- **Brand constant** (`src/lib/brokerage.js`, 15 importers) and the ~85 files that mention The Agency, Oklahoma,
  Edmond, the brand red or the logo, grouped as: agent-site components (Footer), brokerage-site components (About,
  AgentRoster, AreasOfExpertise, Footer, Hero, HomeValuation, Idx*), dashboard components (about 40), people
  components, auth pages (LoginPage, SetPasswordPage), marketing pages, `index.html`, `src/index.css`.
- **Single-brokerage assumptions:** brokerage site components and pages (`BrokerageSitePage`, `BrokerageWebsitePage`,
  `BrokeragePostPage`, `BrokerageAreaPage`), `adaptBrokerageSite.js`, and every query that expects one `brokerage_site`
  row.
- **Hosts and SEO:** `src/lib/appHosts.js`, `src/lib/seo.js` (`SITE_ORIGIN`), `public/robots.txt`, `middleware.js`
  (`MARKETING_HOST`, `VERIFIED_HOSTS`), `api/meta-custom-domain.js` (Google verification map), `api/sitemap.js`.
- **Auth:** `src/hooks/useAuth.js` (`isAdmin`), `ProtectedRoute.jsx`, `DashboardLayout.jsx`, all components using
  `isAdmin`.

## Appendix C: API routes

| Route | Change |
|---|---|
| `api/admin/agents.js` | Caller must be organization admin or platform admin; create inside the caller's organization (platform admin passes `org_id`); delete only within the same organization; set role after creation |
| `api/contact.js` | Listing leads unchanged (recipient from the listing's agent); valuation leads use that organization's brokerage contact; sender display name from the organization |
| `api/agent-site-contact.js` | Add organization name to sender |
| `api/track-view.js` | Write `org_id` with each view |
| `api/blog-automation.js` | Keep bearer secret; iterate per organization; never cross organizations |
| `api/sitemap.js`, `api/meta-*.js` | Organization-aware brand strings and canonical URLs |
| `api/repliers.js` | Per-organization IDX credentials |
| `middleware.js` | Domains and redirects from the database; no hardcoded hosts |
| New: platform provisioning route (Phase 4) | Signed request from HQ creates and pauses organizations |
