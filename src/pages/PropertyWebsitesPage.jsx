import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame, PhoneFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";
import { contactMailto } from "../lib/marketingContact";

/*
THESIS: A property site is a database row, not a repo — the deep-dive
  proves it with the real 1645 Saratoga Way listing end to end.
OWN-WORLD: Inherits the landing page's world exactly — same palette,
  type, browser-frame proof device, Reveal motion language.
STORY: A visitor who clicked through from the home page's Property
  Websites highlight sees the full mechanism — the editor, the live
  site, the gallery, mobile — and reaches out, since sign-up is
  invite-only.
FIRST VIEWPORT: A dedicated hero for this product: headline, subhead,
  a "Get in touch" CTA (invite-only, no self-serve signup) plus a link to
  the real live listing, browser-framed screenshot alongside.
FORM: New surface inside the established world — content extension, not
  a concept tournament (precisely specified, single evidently-correct
  structure: hero, then the property-specific sections moved off the
  home page, then a mobile proof and capability recap, then a CTA).
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

export default function PropertyWebsitesPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              A property site your buyers actually want to look at.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              Real photos, a real hero video, live status, and a contact form that reaches the
              right agent immediately — all from one form, no developer required.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={contactMailto("Interested in Property Websites")}
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Get in Touch
              </a>
              <a
                href="/listings/1645-saratoga-way"
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
              <BrowserFrame src="/images/landing/listing-home-fresh.jpg" alt="1645 Saratoga Way public listing site" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Editor showcase */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Status, photos, and open houses — updated live.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Move a listing from Coming Soon to For Sale to Pending with one click. Upload,
              reorder, and set the hero photo. Schedule an open house — it shows up on the public
              site automatically. Every change is live the second you save it.
            </p>
            <ul className="space-y-3">
              {["No code changes, ever", "No redeploys, ever", "Changes visible to visitors instantly"].map(
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
            <BrowserFrame src="/images/landing/editor.png" alt="Editing a listing" />
          </Reveal>
        </div>
      </section>

      {/* Real listing showcase */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl mb-12">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              This is 1645 Saratoga Way — live right now.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed">
              Same premium design on every listing, regardless of which agent built it. Real
              photos, a real hero video, a real contact form that emails the assigned agent
              directly. This one took minutes to set up.
            </p>
          </Reveal>
          <Reveal delay={0.1} variant="rise">
            <BrowserFrame
              src="/images/landing/listing-hero.jpg"
              alt="1645 Saratoga Way public listing site"
              className="max-w-5xl mx-auto"
            />
          </Reveal>
        </div>
      </section>

      {/* Gallery detail */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserFrame src="/images/landing/listing-gallery.jpg" alt="Listing photo gallery" />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Upload once. It looks this good everywhere.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed max-w-md">
              A full gallery with lightbox viewing, built in from the first photo you upload —
              no extra setup, no separate tool.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Mobile proof */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Looks this good on the phone in a buyer's hand, too.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed max-w-md">
              Most buyers see a listing on their phone first. Every property site is fully
              responsive from the same single build — no separate mobile version to maintain.
            </p>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <PhoneFrame src="/images/landing/listing-mobile.jpg" alt="1645 Saratoga Way on mobile" />
          </Reveal>
        </div>
      </section>

      {/* Capability strip */}
      <section className="px-6 lg:px-10 py-24 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold leading-tight">
              Everything a listing needs, nothing it doesn't.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ["Status that means it", "Coming Soon, For Sale, Pending, Closed, Off Market — one field, always current."],
              ["Open houses, public automatically", "Add a date, it shows as a banner on the live site — no extra step."],
              ["Your own domain, optional", "Point a purchased domain at a listing and it serves right at the root."],
              ["Invite-only access", "Agents don't sign themselves up — you invite who's on the team."],
              ["Every listing, on-brand", "The Agency's design on every property site, automatically, every time."],
              ["Leads land in your inbox", "The contact form emails the assigned agent directly — no manual routing."],
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
            Ready to put your next listing on this?
          </h2>
          <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-8">
            Sign-up is invite-only — reach out and we'll get you set up.
          </p>
          <a
            href={contactMailto("Interested in Property Websites")}
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
