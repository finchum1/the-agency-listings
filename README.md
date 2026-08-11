# The Agency Listings

Multi-user listings management app: agents log in, create and edit property
sites, manage open houses, and set status (Coming Soon / For Sale / Pending
/ Closed / Off Market) — no code changes or redeploys required per listing.
Each listing lives at `/listings/:slug` inside this one app.

Replaces the old one-repo-per-listing approach (`property-site-template/`
+ `1645-saratoga-way/`) — a listing is now a database row, not a git repo.

## Setup

### 1. Create a Supabase project

Free tier is plenty to start. Grab, from **Project Settings → API**:
- Project URL
- `anon` `public` key (safe to expose client-side — access is controlled by
  Row Level Security, not key secrecy)
- `service_role` key (**secret** — server-only, never in client code)

### 2. Run the schema

Supabase dashboard → **SQL Editor** → paste and run, in order:
1. `supabase/schema.sql`
2. `supabase/storage-policies.sql` — but first create the bucket it expects:
   **Storage → New bucket** → name `listing-photos` → **Public bucket: ON**

### 3. Local env

```bash
cp .env.example .env
# fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

### 4. Bootstrap the first admin

There's no public sign-up page (accounts are invite-only). Create your own
account directly:

1. Supabase dashboard → **Authentication → Users → Add user** → your email +
   a password, check **Auto Confirm User**.
2. SQL Editor:
   ```sql
   update profiles set role = 'admin' where email = 'you@example.com';
   ```
3. Sign in at `/login`. From there, invite every other agent yourself via
   **Dashboard → Agents → Invite** — no one else needs steps 1–2.

### 5. Migrate 1645 Saratoga Way (optional, one-time)

Brings the real listing + photos + hero video already sitting in
`../1645-saratoga-way/` into the database as the first row.

```bash
cat >> .env <<EOF
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
MIGRATE_AGENT_EMAIL=terrence.finchum@theagencyre.com
EOF
node --env-file=.env scripts/migrate-saratoga.mjs
```

After confirming `/listings/1645-saratoga-way` looks right, the old
`1645-saratoga-way` repo/Vercel project can be retired (stop pushing to it —
don't delete the repo/project outright without a separate explicit step).

## Deploy

Same pattern as the other listing sites in this workspace — no `gh` CLI/
token available in this environment, so create the GitHub repo yourself via
the web UI, then:

```bash
git init && git add -A && git commit -m "Initial commit"
git remote add origin git@github.com:finchum1/<repo-name>.git
git push -u origin main
npx vercel --yes           # first deploy
npx vercel git connect     # auto-deploy on future pushes
```

In the **Vercel dashboard → Project → Settings → Environment Variables**,
add (these are never set from chat/code):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — same values as your `.env`
- `SUPABASE_SERVICE_ROLE_KEY` — used only by `api/admin/invite-agent.js`
- `RESEND_API_KEY`, optionally `LEAD_FROM_EMAIL` — from resend.com, used by
  `api/contact.js`

Also add your deployed URL's `/accept-invite` path (and `http://localhost:5173/accept-invite`
for local testing) to **Supabase → Authentication → URL Configuration →
Redirect URLs**, or invite emails will land on an error page.

## Structure

- `supabase/schema.sql` — tables + RLS. `supabase/storage-policies.sql` —
  photo bucket RLS. Both hand-run in the SQL Editor, no migration CLI.
- `src/lib/adaptListing.js` — shapes a Supabase listing row into the exact
  object shape the ported site components expect (see below).
- `src/components/listing-site/` — the public property page components,
  ported from `property-site-template/src/components/`. Same JSX/Tailwind,
  just reading from `useListingContext()` instead of a static import.
- `src/components/dashboard/` — the admin/agent app: listings table, the
  create/edit form, photo manager, open-house manager, agent invites.
- `api/contact.js` — "Send Inquiry" form backend (Resend), looks up the
  listing's agent email server-side (never trusts a client-supplied email).
- `api/admin/invite-agent.js` — admin-only agent invites (service role key).

## Out of scope for v1

- Custom domain per listing (schema has a reserved `custom_domain` column;
  wiring it to Vercel's Domains API is a later phase).
- Server-rendered OG/social-preview meta tags (client-side `document.title`
  only for now).
- In-app video upload/compression — `hero_video_url` is a plain URL field;
  compress and host a video externally first (e.g. macOS's built-in
  `avconvert`, same as was done for the Saratoga hero video).
- Drag-and-drop photo reordering (simple up/down buttons for now).
