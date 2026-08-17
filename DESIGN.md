---
name: The Agency Listings
description: A shared multi-agent listings dashboard and premium public listing sites for The Agency (Edmond, OK).
colors:
  cream-bg: "#faf9f7"
  ink: "#1c1a17"
  brand-red: "#ed2127"
  white: "#ffffff"
  hairline-black: "rgba(0,0,0,0.05)"
  status-positive: "#3fae5c"
  status-warning: "#e8b23d"
  status-alert: "#e4574c"
typography:
  display:
    fontFamily: "Playfair Display, Georgia, serif"
    fontWeight: 600
    lineHeight: 1.08
  headline:
    fontFamily: "Playfair Display, Georgia, serif"
    fontSize: "clamp(1.875rem, 3vw, 2.25rem)"
    fontWeight: 600
    lineHeight: 1.2
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15.5px"
    lineHeight: 1.6
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.18em"
rounded:
  pill: "9999px"
  card: "16px"
  frame: "12px"
spacing:
  section-y: "6rem"
  section-y-lg: "9rem"
  container-px: "1.5rem"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 20px"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.card}"
    padding: "24px"
---

# Design System: The Agency Listings

## Overview

**Creative North Star: "The Broker's Own Dashboard"**

This is one product wearing one skin: the internal dashboard where agents manage listings, and the public listing sites those listings generate, share a single visual language down to the pixel. The system reads as a warm, editorial real-estate brand rather than generic SaaS chrome — cream paper, near-black ink, The Agency's own brand red used sparingly as the one accent, Playfair Display headlines over plain Inter body copy. Nothing about it performs "software"; it performs "brokerage," because the public-facing artifact (the listing site) is the product's real storefront and the dashboard simply manages it.

The landing page (the newest surface) inherited this world rather than introducing one: same cream/ink/brand-red palette, same Playfair/Inter pairing, same pill buttons and rounded-2xl cards as the dashboard and every listing site it screenshots. Its one addition — the browser-chrome "device frame" around dashboard/listing screenshots — is a proof device for an already-live product, not a new material language, and is documented below as a signature component.

**Key Characteristics:**
- Cream-and-ink editorial base with a single warm accent, not a multi-color UI palette.
- Playfair Display reserved for headings only; Inter carries everything else, including labels.
- Pills and soft-rounded cards throughout; no sharp rectangles, no hard-offset shadows.
- Status is always color-coded via a shared status-color map, never by icon or shape alone.
- Motion is a light, single-direction reveal per section — not a decorative layer.

## Colors

A restrained editorial palette: warm neutral ground, near-black ink for text and primary actions, one brand accent used at low frequency, plus a small fixed status vocabulary for listing state.

### Primary
- **Ink** (`#1c1a17`): body text, primary buttons, active nav state, footer background. Functions as both the "dark neutral" and the primary call-to-action color — there is no separate brand-hue primary button color.

### Secondary
- **Brand Red** (`#ed2127`): the one accent color — The Agency's actual corporate red (theagencyre.com's own `--primary-color-500`, confirmed by inspecting their site directly). Used at low frequency — the "ADMIN" tag, the `::selection` and `:focus-visible` treatment, italic emphasis words in the landing page's positioning strip, checkmark icon strokes. Never used as a large fill. This corrected an earlier, long-standing mistake: the system used a muted gold-brown (`#8a7a5c`) here for most of this app's life, which was never actually part of The Agency's brand — it was an invented color nobody had checked against corporate. Don't reintroduce gold-brown, muted, or off-brand accent hues anywhere in this system; if a task ever calls for "the dashboard's accent color," it means this red.

### Neutral
- **Cream** (`#faf9f7`): page background across dashboard, public sites, and the landing page. The system's paper.
- **White** (`#ffffff`): card and panel surfaces sitting on top of cream; browser-frame chrome; sticky-nav blur base.
- **Hairline Black** (`rgba(0,0,0,0.05)`–`rgba(0,0,0,0.10)`): all borders and dividers are black at very low opacity, never a distinct gray token.

### Status Vocabulary
- **Status Positive** (`#3fae5c`): live/published/success signal (toast dots, "For Sale"-class states).
- **Status Warning** (`#e8b23d`): pending/in-progress signal.
- **Status Alert** (`#e4574c`): closed/off-market/attention signal.
These three, plus the shared `STATUS_COLORS` map, are applied identically wherever status appears (dashboard pills, `StatusSelect`, hero status badge on public listing sites) — never redefined locally.

### Named Rules
**The Low-Opacity Border Rule.** Every divider, hairline, and card edge is `black` at 5–10% opacity, not a separate gray token. This keeps the whole system tied to two colors (ink, cream) instead of accumulating a gray scale.

**The One Accent Rule.** Gold-brown appears as text, a thin selection tint, or a small dot — never as a button fill or large surface. Its rarity is what makes it read as premium rather than decorative.

## Typography

**Display Font:** Playfair Display (with Georgia, serif fallback)
**Body Font:** Inter (with ui-sans-serif, system-ui, sans-serif fallback)

**Character:** A confident, understated serif/sans pairing — Playfair Display gives headlines editorial weight without ornament (no italics-as-default, no display-face body text), Inter stays completely neutral so the serif does all the personality work.

### Hierarchy
- **Display** (600, `text-4xl`–`text-6xl` / clamp, 1.08 line-height): hero addresses and landing-page hero headline; the only place type gets genuinely large.
- **Headline** (600, `text-3xl`–`text-4xl`, tight line-height): section headings across the landing page and listing sites ("Status, photos, and open houses — updated live.").
- **Title** (600, `text-lg`–`text-xl`, Playfair): card and capability-strip titles; a smaller step of the same display face, not a separate typeface.
- **Body** (400, 15–17px, 1.6 line-height, Inter): all paragraph copy; consistently rendered at ink 65–85% opacity rather than a separate lighter color token.
- **Label** (600, 12px, 0.18em tracking, uppercase Inter): status badges, MLS number, "ADMIN" tag — always uppercase with the shared `tracking-wider-plus` utility, never lowercase-with-icon.

### Named Rules
**The Serif-Only-For-Headings Rule.** Playfair Display never appears in body copy, labels, or UI chrome — only h1–h4. Inter carries every functional and small-scale text role, including uppercase labels.

## Layout

Centered container model: `max-w-6xl`/`max-w-7xl` mx-auto with `px-6 lg:px-10` gutters, consistent across dashboard, listing sites, and the landing page. Landing-page sections alternate cream and white backgrounds separated by hairline borders (`border-y border-black/5`) to create rhythm without shadows or hard section breaks. Vertical rhythm is generous: `py-24`–`py-32` between major sections on desktop, tightening on mobile. The landing hero uses an asymmetric two-column grid (`0.85fr` copy / `1.15fr` visual) that collapses to a single stacked column below `lg`; the visual (browser-framed screenshot) leads on mobile, copy first. Sticky header is `h-20`, cream at 90% opacity with backdrop blur.

## Elevation & Depth

Flat-by-default with elevation reserved for two things: floating cards/toasts on the landing page, and the browser-frame proof device. No hard-offset shadows anywhere in the system — every shadow is soft, diffuse, and black-based at low opacity.

### Shadow Vocabulary
- **Frame Shadow** (`shadow-2xl shadow-black/20`): the browser-framed screenshots in the hero and showcase sections — the heaviest shadow in the system, reserved for the single most important visual per section.
- **Toast Shadow** (`shadow-lg shadow-black/10`): floating status toasts and capability cards — a lighter lift for secondary floating elements.

### Named Rules
**The Soft-Shadow-Only Rule.** All shadows are diffuse black at low opacity (`shadow-black/10`–`/20`); no hard offset, no colored shadow, no neobrutalist drop-shadow. Depth signals importance (frame > card > flat), not decoration.

## Shapes

Two radius steps cover the whole system: full pill (`rounded-full`, buttons, badges, status selects, nav links) and large rounded rectangle (`rounded-2xl` / `rounded-xl`, cards and the browser-frame device). Nothing in the shipped system uses a sharp 0px corner or a small 4–8px "chip" radius — the two-step scale is deliberate and consistently applied from dashboard buttons to public-site CTAs to landing-page cards.

## Components

### Buttons
- **Shape:** full pill (`rounded-full`) — no exceptions observed anywhere in the system.
- **Primary:** ink background (`#1c1a17`), white text, `px-7 py-3.5`–`px-8 py-4` depending on prominence, semibold 14px label.
- **Hover:** primary darkens to `ink/90`; ghost/outline buttons invert to solid ink with white text on hover. Both use a plain `transition-colors`, no scale or shadow change.
- **Ghost/Outline:** transparent fill, `border border-ink` or `border-white` (on dark hero backgrounds), same pill radius and padding scale as primary.

### Cards / Containers
- **Corner Style:** `rounded-2xl` (16px).
- **Background:** white on cream page background.
- **Shadow Strategy:** soft `shadow-xl shadow-black/5` at rest — see Elevation & Depth; no hover-lift shadow change observed.
- **Border:** none; separation is by shadow and background contrast, not stroke.
- **Internal Padding:** `p-6` (24px) standard.

### Status Pills / Select
- **Style:** background is the status color at ~10% opacity (`{color}1a` hex-alpha), text is the full-opacity status color, no border, `rounded-full`, `px-3 py-1.5`, 12px semibold. Applied identically as a `<select>` in the dashboard table and as a static badge on the public listing hero — same visual token, different interactivity.

### Navigation
- Dashboard: text links, active state gets a translucent `bg-ink/10 text-ink` pill (`rounded-full`); inactive is `ink/70` with a subtle `hover:bg-black/5`. No underline, no icon-led nav items. Each tab's active state is its own `activeWhen(pathname)` check (see `DashboardLayout.jsx`'s `NAV_ITEMS`), not a generic string-prefix match — Listings' path (`/dashboard`) is a literal prefix of every other tab's path, so a naive prefix check kept it permanently highlighted.
- Marketing pages (`MarketingNav.jsx`, shared by the home page and both product deep-dives): logo left, "Agent Websites" / "Property Sites" tab links center (same translucent ink/10 active pill as the dashboard nav), "Sign In" pill top-right (outline, filled ink on hover); sticky header is translucent cream with backdrop blur over a hairline border. Nav links collapse below `sm` on mobile — logo and Sign In stay, the two tabs are reachable via each page's own content links and the footer instead.

### Browser Frame (signature component)
A rounded, bordered, white-chrome container with three colored traffic-light dots (`#e4574c` / `#e8b23d` / `#3fae5c`) over any full-bleed screenshot — the landing page's device for proving the dashboard and listing sites are real, not mockups. `rounded-xl overflow-hidden border border-black/10 shadow-2xl shadow-black/20`. This is a landing-page-specific proof device, not a general content container; don't reuse it to frame arbitrary images elsewhere in the product.

**Phone Frame** (`src/components/marketing/DeviceFrames.jsx`, sibling of Browser Frame): the same proof-device family sized for a mobile screenshot instead of a desktop one — dark rounded device chrome with a notch, same soft-shadow language, used wherever a marketing page proves "this works on mobile too." Same rule applies: a marketing-proof device, not a general image container.

### Marketing pages (`src/pages/LandingPage.jsx`, `AgentWebsitesPage.jsx`, `PropertyWebsitesPage.jsx`)
Three pages sharing one set of chrome components (`src/components/marketing/`: `MarketingNav.jsx`, `MarketingFooter.jsx`, `DeviceFrames.jsx`, `motion.jsx` — the `Reveal`/`variants`/`easeOut` entrance language, moved out of `LandingPage.jsx` so all three pages reuse the exact same motion): the home page gives a short highlight of each product (Agent Websites, Property Websites) with a link to that product's own deep-dive page, which carries the full pitch — hero, capability sections, a mobile-device proof, and a closing CTA. Sign-up is invite-only (see PRODUCT.md), so the two deep-dive pages' CTAs are a `mailto:` ("Get in Touch," via `src/lib/marketingContact.js`) rather than "Sign In" — "Sign In" stays reserved for the home page's own CTAs, aimed at agents who already have an account.

## Do's and Don'ts

### Do:
- **Do** use `rounded-full` for every button, badge, and status indicator; `rounded-2xl`/`rounded-xl` for every card and framed panel. No other radius steps.
- **Do** keep brand red (`#ed2127`) rare — text accents, selection tint, focus ring, small dots — never a large fill.
- **Do** use soft black-opacity shadows only (`shadow-black/5` to `/20`); scale intensity with importance, not with hover states.
- **Do** reserve Playfair Display for h1–h4; keep Inter everywhere else, including uppercase labels.
- **Do** drive status color from the single shared `STATUS_COLORS`/`STATUS_LABELS` map so dashboard and public sites never drift.

### Don't:
- **Don't** introduce hard-offset or colored drop-shadows; this is a soft-shadow, editorial world, not a neobrutalist one.
- **Don't** add kicker/eyebrow labels above headings — the shipped system uses none; headings stand alone with no small-caps label sitting above them.
- **Don't** introduce a second accent color or expand the palette beyond ink/cream/brand-red/status-three; a new UI need should be solved with opacity or scale of the existing tokens, not a new hue.
- **Don't** reuse the browser-frame device outside proof/screenshot contexts — it is a landing-page device, not a general image container.

## Agent Sites (distinct world — intentional exception)

The public agent-site pages (`/sites/:slug` and `/sites/:slug/blog/:postSlug`, i.e. `src/components/agent-site/*` and `src/pages/AgentSitePage.jsx` / `PublicAgentPostPage.jsx`) are a **deliberate second visual world**, not a drift from the system above. Per the site owner's explicit request, they're styled to match his personal site (terrence-finchum-realty.vercel.app) instead of "The Broker's Own Dashboard" skin, and — per later requests — each agent can further customize their own site's template, font pairing, accent color, and which Home page sections appear (and in what order). This section documents that exception so it isn't "fixed" back to the main system by mistake.

**Do not apply this world to the dashboard or to public listing sites (`/listings/:slug`)** — those stay on the cream/ink/brand-red system above.

- **Shape:** sharp corners throughout — no `rounded-full`, no `rounded-2xl`. Buttons are rectangles (solid accent fill, white text, uppercase tracked-wide label); cards and photo frames have zero border-radius. This is constant across every template.
- **Labels:** small uppercase accent-colored eyebrow labels above every section heading — unlike the main system's explicit "no eyebrow labels" rule, this world uses them everywhere, matching terrence-finchum-realty. Uses the `.tracked` (0.14em) / `.tracked-wide` (0.22em) utilities instead of `.tracking-wider-plus`.

### Brand compliance (corporate = theagencyre.com)

Everything in this customization system is bounded by what's actually on brand for The Agency corporate (`theagencyre.com`), inspected directly (computed styles + CSS custom properties) rather than guessed:
- **Brand red**: `#ed2127` (their own `--primary-color-500`). This is the *only* accent color the system offers — see below.
- **Fonts**: `Playfair Display` (display/headings) + `Lato` (body) — corporate's actual pairing, confirmed via computed `font-family` on their own `h1`/nav.
- **Secondary/neutral**: black (`--secondary-color-500: rgb(0,0,0)`), used for the Black logo/accent option.

Templates and font-pairing *variety* (below) are still offered for agent personality, but color and logo are deliberately narrower than that — see each subsection.

### Per-agent customization (`agent_sites.theme` / `.font_pairing` / `.accent_color` / `.logo_variant` / `.home_sections` / `.secondary_logo_url`)

Each agent picks their own **template**, **font pairing**, **accent color**, **logo color**, and **Home section** selection/order in their site editor (`SiteForm.jsx`, under "My Site"); an admin can do the same for any agent from **Dashboard → Sites**. Template and font pairing are driven entirely by CSS custom properties set on the page's root element via `data-theme="…"` / `data-font="…"` attributes (see `src/index.css`) — every component reads colors as `bg-[var(--as-bg)]`, `text-[var(--as-accent)]`, etc., never a literal hex, so adding a template or font pairing never means touching component code.

**Templates** (`theme` column, six options, all sharing the exact same layout/components — neutrals only, accent is always brand red, see below):
| Token | Classic (default) | Light | Dark | Sand | Midnight | Ivory |
|---|---|---|---|---|---|---|
| `--as-bg` (page bg) | `#f7f4ee` cream | `#ffffff` white | `#14130f` ink | `#f0e9df` taupe | `#0d1420` navy-black | `#fefefe` near-white |
| `--as-bg-alt` (bordered/alt sections) | `#ffffff` white | `#f7f4ee` cream | `#1c1a15` | `#ffffff` | `#16202f` | `#f7f7f5` |
| `--as-dark` (hero overlay, testimonials, footer) | `#14130f` | `#14130f` | `#0b0a08` | `#211a12` | `#070b12` | `#1a1a1a` |
| `--as-on-dark` (text on `--as-dark`) | `#f7f4ee` | `#f7f4ee` | `#f7f4ee` | `#f5efe4` | `#f1f5f9` | `#fafafa` |
| `--as-surface` (card/photo placeholder) | `#e7e2d6` stone | `#efece4` | `#26241d` | `#e0d3bd` | `#1f2937` | `#ececea` |
| `--as-text` (text on `--as-bg`) | `#14130f` | `#14130f` | `#f7f4ee` | `#2a2118` | `#f1f5f9` | `#1a1a1a` |
| `--as-accent` | `#ed2127` brand red | `#ed2127` | `#f2454b` (brighter, for contrast on dark) | `#ed2127` | `#f2454b` | `#ed2127` |

**Accent color** (`accent_color` column, optional): a per-agent override of just `--as-accent`, via an inline `style={{"--as-accent": accent_color}}` on the same root element that carries `data-theme`/`data-font` (`AgentSitePage.jsx`, `PublicAgentPostPage.jsx`) — inline style wins over the `[data-theme]` CSS rule for that one token, every other token still comes from the template. `null`/empty means "use the template's own accent" (brand red, per the table above). **Restricted to two values — brand red `#ed2127` or black `#000000`** (`SiteForm.jsx`'s `ACCENT_OPTIONS`; enforced again at the DB level by `agent_sites_accent_color_check`) — this is deliberately *not* a free-color picker, so an agent can't drift off corporate brand.

**Logo** (`logo_variant` column — `red` (default) / `white` / `black`): which of three official-color versions of the same mark (`public/images/brokerage-logo{,-white,-black}.png`, pixel-identical shape, recolored via alpha-preserving PIL, not redrawn) shows in `Navbar.jsx`/`Footer.jsx`. Resolved in `adaptAgentSite.js` (`brokerage.logos[site.logo_variant]`); every other context (dashboard, login, listing sites, flyers) always uses the plain red default from `brokerage.js` — only the agent-site header/footer offer a choice.

(A fourth "square" variant — mark stacked above the wordmark on a solid red tile — was tried and removed; it read as a heavy, illegible block at nav/footer size next to the thin-line secondary logo. Don't reintroduce it in that composition if this comes up again — a mark-only badge, no wordmark, would be the thing worth trying instead.)

**Font pairings** (`font_pairing` column, six options — display font overrides the app-wide `--font-display` var, but only within the agent-site page's DOM subtree; body font is `--as-font-sans`, read by the `.font-agent-sans` utility):
- `playfair-jost` (default): **Playfair Display + Lato — The Agency's own pairing**, straight off theagencyre.com (kept under its original `playfair-jost` key so existing picks weren't moved when the body font was corrected from a Jost placeholder to the real corporate font — only what the value *renders as* changed).
- `fraunces-inter`: Fraunces + Inter — warmer serif alternate.
- `cormorant-worksans`: Cormorant Garamond + Work Sans — airy/luxury alternate.
- `libre-karla`: Libre Baskerville + Karla.
- `bodoni-manrope`: Bodoni Moda + Manrope.
- `dmserif-dmsans`: DM Serif Display + DM Sans.

**Home sections** (`home_sections` column, `text[]`, default `{bio,testimonials,listings,areas,blog}`): controls which sections render on the site's Home page (`/sites/:slug`) and in what order — rendered by `HomeSections.jsx`, which always wraps the list with `Hero` first and `Contact` last (those two are never optional or reorderable). `Navbar.jsx` and `Footer.jsx` each filter their own link lists (`PAGES` / `EXPLORE_LINKS`, both carrying a matching `sectionKey`) against `home_sections` too, so a disabled section isn't advertised in nav or footer either — **but the standalone page route itself (`/about`, `/listings`, `/areas`, `/blog`) still works if linked to directly**; turning a section "off" only affects Home composition and nav/footer advertising, not route-level access. `SiteForm.jsx`'s section editor is a simple checkbox + ↑/↓ reorder list, not drag-and-drop — deliberately, since the list is short (5 toggleable entries).

**Secondary logo** (`secondary_logo_url`): an optional per-agent logo shown next to the brokerage logo (a thin vertical divider between them) in both `Navbar.jsx` and `Footer.jsx`. Omitted entirely when not set — agents without one just show the brokerage logo alone.

If a new agent-site component is added, match this world (sharp corners, eyebrow labels, `--as-*` var-driven colors, `.font-agent-sans`) rather than the dashboard's cream/ink/brand-red system — and never hardcode a hex color where a `--as-*` token exists, or it'll only render correctly in one template.
