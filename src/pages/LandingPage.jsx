import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";

/*
THESIS: One shared platform runs both halves of an agent's online
  presence — the mechanism is the pitch, not a feature list.
OWN-WORLD: The Agency's existing system — red mark, Playfair Display
  headings, Inter body, cream/black/brand-red palette, pill buttons,
  rounded-2xl cards — identical to the dashboard and every public site
  this page is pitching.
STORY: A visitor (agent or office leadership) lands on the dashboard's
  own pitch, sees the real dashboard first (still the daily tool), then
  meets both products it powers — property sites and agent sites — each
  proven with a real, live screenshot, and clicks through to whichever
  one they came to learn about.
FIRST VIEWPORT: The existing dashboard-first hero, unchanged — headline +
  subhead + Sign In CTA to its left, browser-framed Listings dashboard
  screenshot to its right.
FORM: Extension of the existing landing page (not a redesign) — two new
  peer highlight sections replace the property-only deep content that
  used to live here, which moved to its own page.
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero — dashboard-first */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-36">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              Everything the office runs on.
              <br />
              One dashboard.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              Property sites, agent sites, coming-soon listings, and what your buyers
              want — all live the moment you save, all in the same place.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Sign In to Get Started
              </Link>
              <a
                href="#products"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1c1a17]/70 hover:text-[#1c1a17] transition-colors"
              >
                See how it works
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M6 13l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
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
                src="/images/landing/dashboard-overview.jpg"
                alt="The Agency Listings dashboard — Listings, Agent Sites, Upcoming Listings, and Buyer Needs"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Positioning strip — three capabilities, plain language, each
          linking to its own deep-dive page. Replaced an earlier
          "Before/Now/Always" version that leaned on "repo" and "deploy" —
          jargon most visitors wouldn't recognize, and besides, this page
          isn't about the old workflow anymore, it's about what the
          dashboard does today. */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-center">
          {[
            ["Agent Websites", "Every agent's own site — bio, listings, blog — on the same trusted brand.", "/agent-websites"],
            ["Property Sites", "Every listing gets its own site automatically, live the moment you hit save.", "/property-websites"],
            ["Brokerage Site", "The office's own front door — full MLS search, draw-a-boundary, and more.", "/brokerage-website"],
            ["Upcoming", "Track a coming-soon listing, or what a buyer wants, before it's ever public.", "/upcoming"],
          ].map(([word, copy, path], i) => (
            <Reveal key={word} delay={i * 0.1} variant="scaleIn">
              <Link to={path} className="group block">
                <p className="text-lg leading-snug">
                  <span className="font-display italic text-[#ed2127] group-hover:underline">{word}</span>{" "}
                  <span className="text-[#1c1a17]/80">{copy}</span>
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Two products — peer highlights, each linking to its own deep-dive
          page. Agent Websites leads (matches MarketingNav.jsx's own link
          order) since that's the story this page opens with now. */}
      <section id="products" className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Every agent's own site, on the same trusted brand.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Your own bio, your own listings, your own blog — styled the way you want it, built
              on The Agency's brand. This one is live right now, and it took minutes to set up.
            </p>
            <Link
              to="/agent-websites"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#ed2127] transition-colors"
            >
              See how it works
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserFrame src="/images/landing/agent-site-home.jpg" alt="Terrence Finchum's agent website" />
          </Reveal>
        </div>
      </section>

      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserFrame
              src="/images/landing/listing-home-fresh.jpg"
              alt="1645 Saratoga Way public listing site"
            />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              A premium site for every listing — instantly.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Fill out a form and a full property site goes live: gallery, hero video, open
              houses, a contact form that reaches you directly. Update status the moment a deal
              changes — no redeploy, ever.
            </p>
            <Link
              to="/property-websites"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#ed2127] transition-colors"
            >
              See how it works
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* Third product — same peer treatment as Agent/Property Websites
          above. Home Search is the headline capability (draw-a-boundary
          map search), so it leads the screenshot even though Our Listings
          and Home Valuation are part of the same deep-dive. */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              The office's own front door — searching the whole market.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              A real IDX home search across the whole board, draw-a-boundary map search, the
              office's own listings, and an honest lead-capture valuation form — all one site.
            </p>
            <Link
              to="/brokerage-website"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#ed2127] transition-colors"
            >
              See how it works
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserFrame
              src="/images/landing/brokerage-home-search.jpg"
              alt="Home Search — full MLS map and list search on the brokerage site"
            />
          </Reveal>
        </div>
      </section>

      {/* Dashboard experience — dark mode + installable app. Lighter
          treatment (no browser-frame device pair, just one screenshot):
          this is a quality-of-life improvement to the existing dashboard,
          not a new product with its own deep-dive page. */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserFrame src="/images/landing/dashboard-dark-mode.jpg" alt="The dashboard in dark mode" />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Dark mode, and an app you can actually install.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Switch the dashboard to light, dark, or match your device — set it once in Settings.
              And it installs straight to your home screen like a real app, no App Store required.
            </p>
            <ul className="space-y-3">
              {["Light, dark, or system — your call", "Installs to your home screen", "The same dashboard, just yours"].map(
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
        </div>
      </section>

      {/* Two more tools, same dashboard — lighter treatment than the
          products above (no browser-frame screenshot: neither has a public
          page to show, both live inside the dashboard itself), styled off
          AgentWebsitesPage.jsx's chip-grid pattern instead. */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl mb-10">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Built for the whole office, not just one listing.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6">
              Two more tools live in the same dashboard, used quietly every day.
            </p>
            <Link
              to="/upcoming"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#1c1a17] hover:text-[#ed2127] transition-colors"
            >
              See how it works
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6">
            <Reveal variant="scaleIn" className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8">
              <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">
                Upcoming Listings
              </p>
              <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed">
                Track a coming-soon property before it's ever public — beds, baths, an estimated
                price, notes on the seller's timeline. The whole office sees it, not just the one
                agent.
              </p>
            </Reveal>
            <Reveal variant="scaleIn" delay={0.1} className="bg-white rounded-2xl shadow-xl shadow-black/5 p-8">
              <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">
                Buyer Needs
              </p>
              <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed">
                List exactly what a buyer wants — budget, beds, baths, the areas they're
                considering. When a colleague's off-market lead matches, everyone already knows.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 lg:px-10 py-28 lg:py-36">
        <Reveal className="mx-auto max-w-2xl text-center" variant="scaleIn">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
            Your next listing is a form away.
          </h2>
          <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-8">
            Sign in with the account your admin set up for you.
          </p>
          <Link
            to="/login"
            className="inline-block text-sm font-semibold px-8 py-4 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
          >
            Sign In
          </Link>
        </Reveal>
      </section>

      <MarketingFooter />
    </div>
  );
}
