# Production cutover checklist: The Agency Listings becomes the multi-tenant platform

Prepared 2026-10-14 from a full from-scratch rehearsal on staging (see `MULTI-TENANT-PLAN.md`, "rehearsal"). Nothing in here has been run on production yet.

**T** = Terrence does it. **C** = Claude does it (and reports the result before moving on).
Tick a box only when the expected result is seen. If a result is not what is written, **stop** and use section 5.

---

## 0. What this is, in plain terms

- **What changes:** the database gets the organization layer (7 SQL parts, A to G) and the app is replaced by the new version (merge `multi-tenant-phase1` into `main`; Vercel builds it).
- **What agents and Stephen will notice:** almost nothing. The one visible change: the sign-in screen shows the **Latchpoint Studios** mark instead of The Agency's logo. After someone signs in once on a browser, that browser remembers The Agency and shows its logo from then on. A link ending in `/login?org=the-agency-oklahoma` always shows The Agency's logo. Tell Stephen so nobody thinks the site was hijacked.
- **How long:** about 60 to 90 minutes in total, of which the database changes are roughly 10 minutes. Choose a quiet time (late evening or a Sunday).
- **How safe:** every SQL part runs as one transaction (it fully applies or fully doesn't). Parts A, B, D, E, F and G change nothing agents can see. Only **C** changes who can see what, and it has a tested undo (section 5).
- **Tested:** the whole sequence was run from scratch on a copy of production's data: 109/109 leak checks and every browser/API suite passed. The old app was also run against the new database rules (the few minutes between "database done" and "app deployed"): 15/15 checks passed when only The Agency exists, which is the case on production.

### Decisions and approvals I need from you before we pick a date

| # | Decision | My recommendation |
|---|---|---|
| 1 | **Vercel Pro** upgrade done? | Required before cutover (you said later this week). The project is at exactly the 12-function Hobby limit. |
| 2 | **The Agency Oklahoma agreement** (term sheet) agreed? | Business gate, not technical: the platform is only worth switching on once that is settled. |
| 3 | **`VITE_SITE_ORIGIN` / `VITE_APP_HOSTS`:** set them at cutover? | **No.** Leave both unset. They are baked into the build and `VITE_SITE_ORIGIN` would move every Agency page's canonical address (an SEO change). Do `app.latchpointstudios.com` as its own step afterwards (section 6). Side effect: the "Copy login link" button copies `the-agency-listings.vercel.app/login?org=...` until then. |
| 4 | **Production SQL access:** the session's safety check may ask you to approve each SQL step on production. | Approve them in the session as they come up; I will say exactly what each one is first. |
| 5 | **Pushing to `main`** (this publishes the new app). | I will not do this until you say "go" in chat at step 4.1. |

---

## 1. Before the day (all must be ticked)

- [ ] **T** Vercel Pro upgrade completed.
- [ ] **T** The Agency Oklahoma agreement settled (or you consciously decide to cut over before it).
- [ ] **T** Tell Stephen and the agents the window in advance: *during it, nobody invites agents, publishes, or edits in the dashboard.* After it, ask Stephen and one agent to sign in and report back (step 4.6).
- [ ] **T** Supabase dashboard (project `hhzoahoaitnlotagpace`, **Database > Backups**): confirm daily backups are listed and note the latest restore point. This is the last-resort safety net (it also covers the private People/CRM tables, which my own file backup deliberately doesn't copy).
- [ ] **T** Vercel project `the-agency-dashboard` > Settings > Environment Variables (Production): confirm these **exist** (names only; I never need the values): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, `LEAD_FROM_EMAIL`, `BLOG_AUTOMATION_SECRET`. Optional (IDX): `REPLIERS_API_KEY`, `REPLIERS_BOARD_ID`, `REPLIERS_BROKERAGE_NAME`. **Do not add** `VITE_SITE_ORIGIN` or `VITE_APP_HOSTS` (decision 3).
- [ ] **C** Confirm the branch is a clean fast-forward of `main`: `git log origin/main..multi-tenant-phase1` shows only our commits and `git log multi-tenant-phase1..origin/main` is empty (checked 2026-10-14: 8 commits ahead, 0 behind; re-check on the day because any push to `main` changes this).
- [ ] **C** Deploy the branch's latest commit as a **Preview** (it points at staging, never production) and run the hosted smoke test (`tools/multi-tenant-checks/preview-smoke.js`). Expect all green.
- [ ] **C** Re-run the full staging suite one last time on the final commit (list in section 7). All green.
- [ ] **C** Note the **current production deployment id** in Vercel (the "undo" button for the app). Write it here: `________________`.
- [ ] **C** Take the "before" snapshot of every public address (read-only): `node tools/cutover/prod-smoke.mjs snapshot cutover-before.json`. A baseline from 2026-10-14 already exists (`cutover-baseline-2026-10-14.json`); retake it on the day.

## 2. Go / no-go (30 minutes before)

All yes, or we don't start:
- [ ] Section 1 fully ticked.
- [ ] Nobody is mid-edit in the dashboard (T asks Stephen).
- [ ] No pending Vercel or Supabase incident (C checks status pages).
- [ ] T has an hour or two of uninterrupted time, and a phone nearby for Stephen.
- [ ] Time is "quiet": check the last 24h of page views if unsure (C can chart `page_views`).

---

## 3. The window: database changes (C does these; T watches)

Files are in `supabase/` on the branch. Each is pasted into the Supabase SQL tool on production and run as one call. After each part C runs the check query and reports the numbers; **do not continue until they match**.

### 3.1 Freeze and backup
- [ ] **T** Tell Stephen: window open, hands off the dashboard.
- [ ] **C** **Schema is still what the backup describes** (read-only). Run on production and expect exactly:

  ```sql
  select
    (select count(*) from pg_tables where schemaname='public') tables,                                                              -- 26
    (select count(*) from information_schema.columns where table_schema='public') columns,                                          -- 320
    (select count(*) from pg_policies where schemaname='public') public_policies,                                                   -- 53
    (select count(*) from pg_policies where schemaname='storage' and tablename='objects') storage_policies,                         -- 12
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public') functions,                -- 6
    (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
       where not t.tgisinternal and (n.nspname='public' or (n.nspname='auth' and c.relname='users'))) triggers,                     -- 13
    (select count(*) from pg_constraint c join pg_namespace n on n.oid=c.connamespace
       where n.nspname='public' and c.contype in ('p','u','c','f')) constraints,                                                    -- 95
    to_regclass('public.organizations') is not null already_migrated;                                                               -- false
  ```
  (Verified against production on 2026-10-14: all matched.) **Any other number = someone changed production since the backup. Stop and find out what.**
- [ ] **C** **Fresh file backup** (rows and stored files, read-only): `node tools/cutover/backup-data.mjs <listings-app/.env> latchpoint-backups/<date>-pre-cutover <worktree>`. Expect `problems: none`, row counts equal to the live counts, about 117 files. (Tested on staging 2026-10-14: 1,714 rows, 116 files, no problems.) Private People/CRM tables are counted but not copied, as before.
- [ ] **C** Have the undo file ready: `shasum -a 256 rollback-policies-and-functions.sql` must equal `7cef4c92f00b11e48e7ded8ee2634a15b787751ac933160e0034961d3b4ffc26` (recorded 2026-10-14; the file itself is unchanged since the Oct 14 backup), and keep it open in a tab.

### 3.2 The seven parts, in this order

| Part | File | Expected result (query) | Visible to agents? |
|---|---|---|---|
| **A** | `multi-tenant-1a-additive.sql` | `organizations`=1, `platform_admins`=1, rows still unassigned to an organization = **0** in profiles, listings, agent_sites, leads, page_views, upcoming_listings, buyer_needs, brokerage_* | No |
| **B** | `multi-tenant-1b-constraints-triggers.sql` | `set_org_id` triggers = **10**; constraint `brokerage_site_org_key` exists | No |
| **C** | `multi-tenant-1c-access-rules.sql` | public policies = **57**, storage policies = **12** (this is the switch) | Invisible if all is well |
| **D** | `multi-tenant-1d-brand-fields.sql` | `select brand->>'service_area' from organizations` is not null | No |
| **E** | `multi-tenant-1e-domain-registry.sql` | `org_domains` rows = number of custom domains on listings + agent_sites + brokerage_site (expect 2: terrencefinchum.com, denitahenryhomes.com, plus any added since); the Search Console token is on terrencefinchum.com | No |
| **F** | `multi-tenant-1f-brand-choices.sql` | `validate_brand_choices` triggers = **3** | No |
| **G** | `multi-tenant-1g-idx-settings.sql` | `has_column_privilege('authenticated','public.org_settings','idx_config','select')` = **false**; The Agency's `brand->'map_center'` set | No |

- [ ] A applied and checked  - [ ] B applied and checked  - [ ] C applied and checked
- [ ] D applied and checked  - [ ] E applied and checked  - [ ] F applied and checked  - [ ] G applied and checked

Also, once, after A: **the platform owner is Terrence.** `select user_id from platform_admins` must equal the id of `terrence.finchum@theagencyre.com` (`ecbf43ef-...`, verified present on production 2026-10-14).

> **Between C and the app deploy (step 4.1) the old app runs on the new rules.** It works when The Agency is the only organization (tested 15/15). **Do not create any second organization's brokerage site before the new app is live:** the old app expects exactly one brokerage-site row and shows "Page not found" with two. Do step 4.1 straight after G; don't pause.

---

## 4. The window: deploy and verify

### 4.1 Deploy the app
- [ ] **T** says "go" in chat.
- [ ] **C** fast-forwards `main` to `multi-tenant-phase1` and pushes. Vercel builds Production.
- [ ] **C** Confirm the build is **Ready** and is the Production target (watch the deployment; a failed build leaves the old app serving, which is safe, see section 5). Build takes about a minute.

### 4.2 Database tests on production (all roll themselves back, so they leave nothing behind)
- [ ] `cross-tenant-leak-test.sql`: `LEAKTEST pass=109 fail=0`
- [ ] `domain-registry-test.sql`: `DOMAIN REGISTRY failures: none`
- [ ] `brand-choices-test.sql`: `BRAND CHOICES failures: none`
- [ ] `idx-settings-test.sql`: `IDX SETTINGS failures: none`

### 4.3 Public addresses answer as before (C, read-only)
- [ ] `node tools/cutover/prod-smoke.mjs snapshot cutover-after.json`, then `node tools/cutover/prod-smoke.mjs compare cutover-before.json cutover-after.json`. Expect "All addresses answer exactly as before" (the rebuilt app shell may change a hash; titles, redirects, canonicals, robots and sitemap URL counts must not).
- [ ] The two client sites still carry their Search Console tag: `curl -sA Googlebot https://www.terrencefinchum.com/ | grep google-site-verification` returns the tag. (The tag is served from `org_domains` now.)
- [ ] A page view is still recorded and stamped: load `https://denitahenryhomes.com/` in a browser, then `select org_id from page_views order by created_at desc limit 1` equals The Agency's id.

### 4.4 Walk-through as the platform owner (T, with C watching logs)
Sign in at the-agency-listings.vercel.app/login (you will see the Latchpoint mark; that's expected).
- [ ] After sign-in the sidebar shows The Agency's logo and "Oklahoma"; the **Working in** switcher lists **The Agency** only; **Copy login link** copies a `/login?org=the-agency-oklahoma` link.
- [ ] **Listings**, **Agents**, **Agent Sites**, **Upcoming**, **Buyer needs**, **People** all load with the same rows as before.
- [ ] **Brokerage Site** editor loads with the same content; the logo and accent pickers show The Agency's three logos and red/black.
- [ ] **A write works:** open your own agent site, change nothing, press **Save**. No error.
- [ ] **Blog:** create a draft post titled `ZZ cutover test`, publish it, see it on the live site, then delete it.
- [ ] **A lead arrives:** submit the contact form on your own site as `ZZ Cutover Test` (a real email you own). It appears under Leads, the notification email arrives, and People gets the entry (if People is on). **C then deletes that one lead and its People row by id** (nothing else).
- [ ] The marketing site (`theagency.latchpointstudios.com`) and the sign-in page on a phone look right.

### 4.5 Watch the logs (C), 10 minutes
- [ ] Vercel runtime errors since the deploy: none new (`get_runtime_errors`).
- [ ] Supabase API/Postgres logs: no spike of 4xx/5xx or "permission denied"/"violates row-level security".

### 4.6 Hand back
- [ ] **T** Tell Stephen the window is closed and ask him (and one agent) to sign in, open Listings and their site, and report anything odd.
- [ ] **C** Update `MULTI-TENANT-PLAN.md` and memory with the result and the timestamp; commit.

**Success =** every box in 3 and 4 ticked, and Stephen plus one agent confirm. Keep the backup folder and the previous-deployment id for at least 7 days.

---

## 5. If something goes wrong (read this before you start)

**Rule of thumb:** a data-loss or privacy problem (someone sees another organization's data, or an Agency user cannot see their own) = roll back first, investigate second. A cosmetic problem = fix forward.

| Where it fails | What to do | Time |
|---|---|---|
| **A, B, D, E, F or G errors** | Each part is one transaction, so nothing is half-applied. Read the error, fix, re-run the same part. These parts don't change what agents see, so the app keeps working in the meantime. | minutes |
| **C errors** | Same: one transaction, nothing changed. | minutes |
| **C applied, but access looks wrong** (the walk-through or Stephen reports missing data or a leak) | **1.** Promote the previous production deployment in Vercel (the id from section 1) so the old app serves. **2.** Run `rollback-policies-and-functions.sql` (restores the 65 saved access rules and 6 functions; byte-for-byte the same statements that rebuilt staging successfully). **Order matters: app first, then SQL**, because the SQL rollback drops the new `organizations` rules and the new app needs them. | ~5 min |
| **Build fails or the app is broken but the database is fine** | Vercel: promote the previous deployment (the old app is proven to run on the new rules). Leave the database alone. | ~1 min |
| **Leak suite fails on production** | Treat as a leak: do the C rollback above. Do not reopen the dashboard until the suite is 109/109. | ~5 min |
| **Catastrophe** (data lost or corrupted) | Last resort, your call: restore from the Supabase backup or point-in-time recovery, and top up from my file backup. This loses anything written since the restore point (the window is frozen so that should be nothing). | an hour or more |

After a rollback of C, one thing to remember: the new triggers stay in place and accounts created by the **old** invite flow have no organization, so their first listing would fail. Until we try again, if you must add an agent, tell me and I'll assign them to The Agency by SQL (`update profiles set org_id = <The Agency> where org_id is null`).

---

## 6. After the window (separate days, not part of the cutover)

1. **Attach `app.latchpointstudios.com`:** add the domain to the Vercel project (DNS is already at Vercel), add it to Supabase Auth's redirect list, set `VITE_APP_HOSTS=app.latchpointstudios.com` (and, only if you want canonical addresses to move, `VITE_SITE_ORIGIN=https://app.latchpointstudios.com`), redeploy (these are build-time variables). Then the "Copy login link" button copies `app.latchpointstudios.com` links.
2. **First non-Agency client:** there is no "create organization" screen yet (Phase 2). C creates the organization, its brand and logos, its admin, and its login link by script; set its `org_settings.features` switches and, if it has IDX, its `idx_config` (Repliers key, board, exact office name) by SQL. Never put another organization's data in until the new app is live (step 3.2 warning).
3. **Cleanup on staging:** remove the test brokerage "ZZB Realty" and the `zzb-app.localhost` registry row when finished testing.
4. **Hardening, optional:** a scheduled leak canary (a throwaway user counting rows visible per table) that alerts if anything ever leaks.
5. Pause or archive the old `the-agency-oklahoma` Vercel project only if it is unused (not part of this cutover; ask me to check).

---

## 7. Reference

| Thing | Value |
|---|---|
| Production Supabase project | `hhzoahoaitnlotagpace` |
| Staging Supabase project | `ihslmbnakcfuswlmgckf` (rebuilt from backup 2026-10-14; holds the ZZB test brokerage) |
| Vercel team / project | `terrence-finchum` / `the-agency-dashboard` (`prj_G2rswKgPZ9mKxLWt7yt9A5LWFj09`) |
| Production domains on that project | the-agency-listings.vercel.app, www.terrencefinchum.com (terrencefinchum.com redirects to it), denitahenryhomes.com (www redirects to it), theagency.latchpointstudios.com, emailsignature.latchpointstudios.com |
| Branch to ship | `multi-tenant-phase1` (merge = fast-forward) |
| SQL parts (apply in this order) | `supabase/multi-tenant-1a` ... `1g` |
| SQL tests (all roll back) | `supabase/tests/cross-tenant-leak-test.sql`, `domain-registry-test.sql`, `brand-choices-test.sql`, `idx-settings-test.sql` |
| Undo for rules/functions | `latchpoint-backups/2026-10-14-the-agency-listings/rollback-policies-and-functions.sql` |
| Backup tools | `latchpoint-backups/tools/cutover/backup-data.mjs`, `prod-smoke.mjs` |
| Staging suites (re-run before the day) | `latchpoint-backups/tools/multi-tenant-checks/`: `mt-dashboard.js` 33, `mt-public.js` 12, `mt-hosts-ui.js` 7, `mt-pickers.js` 16, `mt-login-link.js` 11, `test-agents-api.mjs` 8, `mt-middleware.mjs` 11, `test-idx-api.mjs` 13 (needs the dev server on :5175 against staging, see its README) |
| Rehearsal result | Staging rebuilt from the Oct 14 backup, parts A to G applied from these files with no errors, leak suite 109/109, all suites green |
| Baseline before the change | `latchpoint-backups/cutover-baseline-2026-10-14.json` (19 public addresses) |

### Known limits at cutover (by design, not bugs)
- Marketing pages stay Agency-branded (they are The Agency's showcase).
- A brokerage's own dashboard domain is not installable as an app yet (needs its own icon and manifest).
- `app.latchpointstudios.com` and per-organization login links beyond The Agency come after the cutover (section 6).
- The per-organization IDX key is unused until an organization other than The Agency has one.
