# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Real estate agents and admin/office staff at **The Agency** (a single real
estate brokerage, Edmond OK — not a multi-tenant product for other
brokerages). Admin (the broker/office manager) invites agents, sees and can
edit every listing, and manages agent accounts. Agents manage the listings
assigned to them: creating new property sites, editing details, uploading
photos, scheduling open houses, and updating status as a deal progresses.

## Product Purpose

A multi-user listings management app: agents log in, create and edit
single-property listing sites without touching code, see every listing the
brokerage has in play at a glance, and update status (Coming Soon / For
Sale / Pending / Closed / Off Market) and open houses instantly — no
redeploy, no waiting on a developer.

## Positioning

Replaces the brokerage's prior workflow, where every new listing meant
hand-building and separately deploying a one-off static site
(`property-site-template` + a dedicated GitHub repo/Vercel project per
property). A listing is now a database row, not a repo: creating one is
filling out a form, editing is live immediately, and every listing is
visible in one shared dashboard instead of scattered across individual
deployments.

## Operating Context

Invite-only: there is no public sign-up. The admin invites each agent by
email from inside the app; the agent receives an email link to set their
password. Public listing sites are reachable at `/listings/:slug`, or at a
listing's own attached custom domain (e.g. `1645SaratogaWay.com`) once
purchased and pointed at the project. Each public listing page has a
contact form that emails the assigned agent directly (with a `mailto:`
fallback if delivery fails, so no lead is ever silently lost).

## Capabilities and Constraints

- Role-based permissions: admin sees/edits every listing; an agent edits
  only listings assigned to them (enforced by Postgres RLS, not just UI).
- Listing editor covers address, price, beds/baths/sqft, description,
  categorized features, a photo gallery (upload/reorder/delete/set-hero),
  an optional hero video, and an optional custom domain.
- Open house scheduling, shown as a banner on the public listing page when
  a date is upcoming.
- Status is a single field driving both the dashboard pill and what's
  publicly visible (`draft` = unpublished).
- Self-service "My Profile" so an agent's own name/title/license/phone/
  photo shown on their listings is always current.
- No in-app video upload/compression (paste a link to an already-hosted
  file) and no drag-and-drop photo reordering (simple up/down controls) —
  known, deliberate v1 scope limits, not gaps to imply are coming.

## Brand Commitments

**The Agency** — red mark + wordmark logo (`public/images/brokerage-logo.png`).
Playfair Display for headings, Inter for body text. Cream background
(`#faf9f7`), near-black text (`#1c1a17`), warm gold-brown accent
(`#8a7a5c`). Pill-shaped buttons, `rounded-2xl` cards. This palette and
type pairing is consistent across the dashboard and every public listing
site already shipped — the landing page should read as unmistakably the
same product, not a separate marketing skin.

## Evidence on Hand

One real, live listing: **1645 Saratoga Way**, Edmond OK, $1,395,000,
4 bed / 7 bath / 6,886 sqft, gated Saratoga Farms community — real photos
and a real hero video, live at `/listings/1645-saratoga-way`. Real
dashboard screens exist and can be screenshotted: the listings table
(status pills, filters), the listing editor, the agent-invite flow, "My
Profile." No second or third real listing exists yet — the user approved
using 1–2 clearly-fictional placeholder/mockup listings alongside the real
one for visual variety in list-style shots, on the condition they are
never presented as real addresses or real data. Do not fabricate
testimonials, user counts, or metrics ("used by X agents," "Y listings
created") — none exist yet.

## Product Principles

1. Centralize what used to be scattered — one dashboard shows every
   listing the brokerage has, instead of a repo per property.
2. No code, no redeploys — creating or editing a listing is filling out a
   form, not a developer task.
3. Status is always current — pending/closed/open-house changes are live
   the instant they're saved, not after a deploy.
4. Built for The Agency's own workflow specifically — invite-only,
   single-brokerage, not generic multi-tenant real-estate SaaS.
5. Every public listing site carries the same premium, consistent Agency
   brand, regardless of which agent built it.
