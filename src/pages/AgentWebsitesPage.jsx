import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame, PhoneFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";
import { contactMailto } from "../lib/marketingContact";

/*
THESIS: Every agent gets their own site on the same trusted brand — the
  deep-dive proves range (six templates, six font pairings) without ever
  leaving The Agency's actual brand colors.
OWN-WORLD: Inherits the landing page's world exactly — same palette,
  type, browser-frame proof device, Reveal motion language.
STORY: A visitor who clicked through from the home page's Agent Websites
  highlight sees a real live site (Terrence's), understands how much of
  it is theirs to shape, and reaches out, since sign-up is invite-only.
FIRST VIEWPORT: A dedicated hero: headline, subhead, a "Get in touch" CTA
  plus a link to the real live site, browser-framed screenshot alongside.
FORM: New surface inside the established world — content extension, not
  a concept tournament (precisely specified structure: hero, personal
  brand, real customization data, built-in blog/contact, mobile, CTA).
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

// The six real templates and their actual production accent/neutral
// tokens (src/index.css) — not mockup colors. Accent is always the
// brand red (or its brighter dark-background variant); templates only
// ever vary neutrals. See DESIGN.md "Brand compliance."
const THEMES = [
  { label: "Classic", swatches: ["#f7f4ee", "#14130f", "#ed2127"] },
  { label: "Light", swatches: ["#ffffff", "#14130f", "#ed2127"] },
  { label: "Dark", swatches: ["#14130f", "#26241d", "#f2454b"] },
  { label: "Sand", swatches: ["#f0e9df", "#211a12", "#ed2127"] },
  { label: "Midnight", swatches: ["#0d1420", "#1f2937", "#f2454b"] },
  { label: "Ivory", swatches: ["#fefefe", "#1a1a1a", "#ed2127"] },
];

// The six real font pairings (src/index.css [data-font] blocks) — live
// browser-rendered previews, not images, using the fonts already loaded
// for the agent-site world.
const FONT_PAIRINGS = [
  { label: "Playfair Display + Lato", tag: "The Agency's pairing", display: "'Playfair Display', Georgia, serif", body: "'Lato', sans-serif" },
  { label: "Fraunces + Inter", display: "'Fraunces', Georgia, serif", body: "'Inter', sans-serif" },
  { label: "Cormorant Garamond + Work Sans", display: "'Cormorant Garamond', Georgia, serif", body: "'Work Sans', sans-serif" },
  { label: "Libre Baskerville + Karla", display: "'Libre Baskerville', Georgia, serif", body: "'Karla', sans-serif" },
  { label: "Bodoni Moda + Manrope", display: "'Bodoni Moda', Georgia, serif", body: "'Manrope', sans-serif" },
  { label: "DM Serif Display + DM Sans", display: "'DM Serif Display', Georgia, serif", body: "'DM Sans', sans-serif" },
];

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const chip = {
  hidden: { opacity: 0, y: 14, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: easeOut } },
};

export default function AgentWebsitesPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              Every agent's own site, on the same trusted brand.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              A personal bio, testimonials, listings, and a blog — styled the way you want it,
              built on The Agency's actual brand. Live in minutes, not weeks.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={contactMailto("Interested in an Agent Website")}
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Get in Touch
              </a>
              <a
                href="/sites/terrence-finchum"
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
              <BrowserFrame src="/images/landing/agent-site-home.jpg" alt="Terrence Finchum's agent website" />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Personal brand */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Your bio, your story, your track record.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Fill in your own bio, stats, and testimonials from your own site editor — the same
              self-serve form pattern as the listings dashboard. No developer touches your page,
              ever.
            </p>
            <ul className="space-y-3">
              {["Your own photo, bio, and stats", "Real client testimonials", "Service areas you actually work"].map(
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
            <BrowserFrame src="/images/landing/agent-site-about.jpg" alt="About page on an agent website" />
          </Reveal>
        </div>
      </section>

      {/* Customization — real production tokens, not mockups */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Make it yours — without ever going off-brand.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed">
              Six templates, six font pairings, and an accent color locked to The Agency's own
              red — every combination still reads as unmistakably The Agency, automatically.
            </p>
          </Reveal>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10"
          >
            {THEMES.map((t) => (
              <motion.div key={t.label} variants={chip} className="bg-white rounded-2xl shadow-xl shadow-black/5 p-4">
                <div className="flex gap-1.5 mb-3">
                  {t.swatches.map((c, i) => (
                    <span key={i} className="h-5 w-5 rounded-full border border-black/10" style={{ background: c }} />
                  ))}
                </div>
                <p className="text-sm font-semibold">{t.label}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            variants={stagger}
            className="grid sm:grid-cols-3 gap-4"
          >
            {FONT_PAIRINGS.map((f) => (
              <motion.div key={f.label} variants={chip} className="bg-white rounded-2xl shadow-xl shadow-black/5 p-5">
                {f.tag && (
                  <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-2">{f.tag}</p>
                )}
                <p className="text-2xl leading-none mb-2.5" style={{ fontFamily: f.display }}>
                  Aa
                </p>
                <p className="text-xs font-medium text-[#1c1a17]/70" style={{ fontFamily: f.body }}>
                  {f.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Blog + contact */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              A built-in blog, and leads that land in your inbox.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed max-w-md">
              Publish market updates and neighborhood guides without a separate tool. The contact
              form on every agent site emails you directly — the same reliable pattern every
              listing site already uses.
            </p>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="grid grid-cols-2 gap-4">
            <BrowserFrame src="/images/landing/agent-site-blog.jpg" alt="Blog page on an agent website" />
            <BrowserFrame src="/images/landing/agent-site-contact.jpg" alt="Contact form on an agent website" />
          </Reveal>
        </div>
      </section>

      {/* Mobile proof */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <PhoneFrame src="/images/landing/agent-site-mobile.jpg" alt="Agent website on mobile" />
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              The site clients actually see, on the device they actually use.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed max-w-md">
              Fully responsive from the same single build a client meets you with in person —
              no separate mobile version to keep in sync.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="px-6 lg:px-10 py-28 lg:py-36">
        <Reveal className="mx-auto max-w-2xl text-center" variant="scaleIn">
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
            Ready for a site that's actually yours?
          </h2>
          <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-8">
            Sign-up is invite-only — reach out and we'll get you set up.
          </p>
          <a
            href={contactMailto("Interested in an Agent Website")}
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
