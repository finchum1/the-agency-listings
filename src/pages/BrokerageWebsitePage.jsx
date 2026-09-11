import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";
import { contactMailto } from "../lib/marketingContact";

/*
THESIS: The office's own front door searches the whole market, not just
  its own listings — the deep-dive proves it with the real, live
  /brokerage site end to end.
OWN-WORLD: Inherits the landing page's world exactly — same palette,
  type, browser-frame proof device, Reveal motion language.
STORY: A visitor who clicked through from the home page's Brokerage Site
  highlight sees the full mechanism — draw-a-boundary map search, the
  office's own listings, an honest valuation lead form — and reaches
  out, since sign-up is invite-only.
FIRST VIEWPORT: A dedicated hero: headline, subhead, a "Get in touch" CTA
  plus a link to the real live site, browser-framed screenshot alongside.
FORM: Same structure as the other two product deep-dives — hero, then a
  section per capability moved off the home page, then a capability
  recap, then a closing CTA.
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

export default function BrokerageWebsitePage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              One office site. The whole market, searchable.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              A real IDX home search — every listing on the board, a live map, draw-your-own
              search area — plus the office's own listings, roster, and a real lead-capture
              valuation form. All one site, live right now.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={contactMailto("Interested in a Brokerage Site")}
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Get in Touch
              </a>
              <a
                href="/brokerage"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1c1a17]/70 hover:text-[#1c1a17] transition-colors"
              >
                View a live example
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 17L17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
            </div>
          </motion.div>

          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
            >
              <BrowserFrame
                src="/images/landing/brokerage-home-search.jpg"
                alt="Home Search — full MLS map and list search on the brokerage site"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Home Search — the headline capability */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Search every home for sale, not just this office's.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              A real reciprocal IDX search — the whole board, live. Draw a boundary right on the
              map and the list updates instantly. Sort, filter by beds/baths/price, switch between
              a full-width list or a split map view.
            </p>
            <ul className="space-y-3">
              {["Draw-a-boundary map search", "Full board, not a curated slice", "List and map, side by side"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-[#1c1a17]/75">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                )
              )}
            </ul>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserFrame
              src="/images/landing/brokerage-home-search.jpg"
              alt="Home Search map and list split view, with draw-a-boundary search"
            />
          </Reveal>
        </div>
      </section>

      {/* Our Listings */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserFrame src="/images/landing/brokerage-our-listings.jpg" alt="Our Listings — the office's own inventory" />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              The office's own inventory, front and center too.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Our Listings is the same search experience, scoped to just this office's own
              properties, sorted most-expensive-first — the site's own showcase, kept separate
              from the full-market Home Search.
            </p>
            <a
              href="/brokerage/listings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#ed2127] transition-colors"
            >
              See it live
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          </Reveal>
        </div>
      </section>

      {/* Home Valuation — honest lead capture */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              A real lead, not a fabricated number.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              The Home Valuation form collects an address and contact details and routes straight
              to the office's inbox for a real, agent-built market analysis — deliberately not an
              instant automated estimate the office can't actually stand behind.
            </p>
            <ul className="space-y-3">
              {["Lands directly in the office inbox", "Built for a real follow-up, not a guess", "One more way a visitor becomes a lead"].map(
                (item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-[#1c1a17]/75">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="2">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {item}
                  </li>
                )
              )}
            </ul>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserFrame src="/images/landing/brokerage-home-valuation.jpg" alt="Home Valuation lead-capture form" />
          </Reveal>
        </div>
      </section>

      {/* Capability strip */}
      <section className="px-6 lg:px-10 py-24 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold leading-tight">
              Everything an office's front door needs.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ["Reciprocal IDX, done right", "The full board's listings, live — governed the way MLS display rules actually require."],
              ["Draw-a-boundary search", "No other tool on this platform does this — a buyer draws the exact area they care about."],
              ["Featured listings, curated", "Admins can pin specific listings to the home page, verified live against the MLS on add."],
              ["Agent roster, blog, areas of expertise", "The same customizable sections every agent site offers, for the whole office."],
              ["Six templates, on-brand always", "Same template/font/accent system as every agent and listing site — never off-brand."],
              ["One dashboard, one login", "Managed from the exact same dashboard as agent sites and listings — nothing extra to learn."],
            ].map(([title, copy], i) => (
              <Reveal key={title} delay={(i % 3) * 0.08} variant="scaleIn">
                <div className="bg-white rounded-2xl shadow-xl shadow-black/5 p-6 h-full">
                  <h3 className="font-display text-lg font-semibold mb-2">{title}</h3>
                  <p className="text-sm text-[#1c1a17]/65 leading-relaxed">{copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 lg:px-10 py-28 lg:py-36">
        <Reveal className="mx-auto max-w-2xl text-center" variant="scaleIn">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
            Ready to give your office a front door like this?
          </h2>
          <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-8">
            Sign-up is invite-only — reach out and we'll get you set up.
          </p>
          <a
            href={contactMailto("Interested in a Brokerage Site")}
            className="inline-block text-sm font-semibold px-8 py-4 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
          >
            Get in Touch
          </a>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
