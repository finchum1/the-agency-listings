import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";

/*
THESIS: Two more tools live inside the same dashboard every agent
  already has — this page is a feature tour for an existing user, not a
  pitch to a prospective one.
OWN-WORLD: Inherits the landing page's world exactly — same palette,
  type, browser-frame proof device, Reveal motion language.
STORY: An agent who saw the two-card teaser on the home page clicks
  through, sees each tool in a real screenshot (sample data — neither
  has a public page of its own to screenshot for real), and signs in to
  go use it.
FIRST VIEWPORT: A dedicated hero for this pair of tools: headline,
  subhead, Sign In CTA (not "Get in Touch" — no invite needed, it's
  already in the dashboard).
FORM: Same structure as the two product deep-dives, scaled to two
  lighter features instead of one large product: hero, then a section
  per tool, then a capability recap, then a closing CTA.
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

export default function UpcomingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              Know what's coming before it's public.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              Track a coming-soon listing and see what your buyers actually want — both live in
              the same dashboard, visible to the whole office.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Sign In
              </Link>
            </div>
          </motion.div>

          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
            >
              <BrowserFrame
                src="/images/landing/upcoming-listings-table.jpg"
                alt="Upcoming Listings dashboard module (sample data)"
              />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Upcoming Listings */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              A coming-soon property, tracked before it's ever public.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Beds, baths, an estimated price, notes on the seller's timeline — logged the moment
              you hear about it, visible to the whole office. No slug, no public page, no SEO to
              worry about — just a shared, living list.
            </p>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserFrame
              src="/images/landing/upcoming-listings-table.jpg"
              alt="Upcoming Listings dashboard module (sample data)"
            />
          </Reveal>
        </div>
      </section>

      {/* Buyer Needs */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserFrame
              src="/images/landing/buyer-needs-table.jpg"
              alt="Buyer Needs dashboard module (sample data)"
            />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              What your buyers want, in one shared list.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Budget range, beds and baths, the areas they're considering — logged once, checked
              by anyone in the office. When a colleague's off-market lead matches, everyone
              already knows.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Capability strip */}
      <section className="px-6 lg:px-10 py-24 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold leading-tight">
              Built to make a match, not just take notes.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ["Filter to find a match", "Price range, beds, baths, agent — narrow either list down in seconds."],
              ["Office-wide, always", "Every agent sees every entry. No separate silos, no missed leads."],
              ["Status that means it", "Coming Soon to Now Listed, or Actively Looking to Matched — always current."],
              ["Notes for context", "The seller's timeline, a buyer's must-haves — whatever's worth remembering."],
              ["Realtime updates", "A colleague's new entry shows up instantly, no refresh needed."],
              ["Nothing public", "Both lists live entirely inside the dashboard — no public page, no SEO surface."],
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
            Already in your dashboard.
          </h2>
          <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-8">
            Sign in and you'll find both tabs waiting — Upcoming and Buyer Needs.
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
