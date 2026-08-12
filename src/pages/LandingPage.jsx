import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import brokerage from "../lib/brokerage";

/*
THESIS: One shared dashboard replaces one repo per listing — the mechanism
  is the pitch, not a feature list.
OWN-WORLD: The Agency's existing system — red mark, Playfair Display
  headings, Inter body, cream/black/gold-brown palette, pill buttons,
  rounded-2xl cards — identical to the dashboard and every public listing
  site this page is pitching.
STORY: An agent who hasn't logged in yet sees the real dashboard and a
  real live listing, understands creating/managing a listing is now
  instant and centralized instead of a repo-per-property, trusts it
  because the proof is real, and signs in.
FIRST VIEWPORT: A large, elevated, browser-framed screenshot of the real
  Listings dashboard as the hero's visual centerpiece, headline + subhead
  + primary CTA to its left, Sign In pill top-right, animated status
  toasts drifting in around the frame (stacked below the frame on mobile).
FORM: Dashboard-first hero, candidate 6 of 7 grounded structural
  candidates, seed key 1c654562.
FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

const easeOut = [0.16, 1, 0.3, 1];

// One authored entrance per section — not the same fade-up repeated down
// the page.
const variants = {
  rise: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  fromLeft: {
    hidden: { opacity: 0, x: -36 },
    show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  fromRight: {
    hidden: { opacity: 0, x: 36 },
    show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: easeOut } },
  },
  scaleIn: {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1, transition: { duration: 0.6, ease: easeOut } },
  },
};

function Reveal({ children, className, delay = 0, variant = "rise" }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={variants[variant]}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

function BrowserFrame({ src, alt, className }) {
  return (
    <div className={`rounded-xl overflow-hidden border border-black/10 bg-white shadow-2xl shadow-black/20 ${className || ""}`}>
      <div className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#f1efe9] border-b border-black/5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e4574c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e8b23d]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#3fae5c]" />
      </div>
      <img src={src} alt={alt} className="w-full h-auto block" />
    </div>
  );
}

const toasts = [
  { label: "Status: For Sale", delay: 1.0, desktopClass: "-top-5 -left-6 lg:-left-16" },
  { label: "Open house added", delay: 1.3, desktopClass: "-bottom-5 -right-4 lg:-right-14" },
  { label: "Listing published", delay: 1.6, desktopClass: "top-1/2 -translate-y-1/2 -right-6 lg:-right-20" },
];

function StatusToast({ label, delay, desktopClass }) {
  return (
    <motion.div
      className={`flex lg:absolute ${desktopClass} items-center gap-2 bg-white rounded-full shadow-lg shadow-black/10 border border-black/5 px-4 py-2 text-xs font-semibold text-[#1c1a17] w-fit`}
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: easeOut }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#3fae5c] shrink-0" />
      {label}
    </motion.div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      {/* Nav */}
      <header className="sticky top-0 z-40 bg-[#faf9f7]/90 backdrop-blur border-b border-black/5">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 h-20 flex items-center justify-between">
          <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
          <Link
            to="/login"
            className="text-sm font-semibold px-5 py-2.5 rounded-full border border-[#1c1a17] text-[#1c1a17] hover:bg-[#1c1a17] hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero — dashboard-first */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-36">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-4xl sm:text-5xl font-display font-semibold leading-[1.08] mb-6">
              Every listing.
              <br />
              One dashboard.
              <br />
              No developer.
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              Create a property site by filling out a form. Update status the moment a deal
              changes. Add an open house in seconds. What used to take a repo and a deploy is
              now a save button.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/login"
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#1c1a17] text-white hover:bg-[#1c1a17]/90 transition-colors"
              >
                Sign In to Get Started
              </Link>
              <a
                href="#see-it-work"
                className="text-sm font-semibold text-[#1c1a17]/70 hover:text-[#1c1a17] transition-colors"
              >
                See how it works ↓
              </a>
            </div>
          </motion.div>

          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
            >
              <BrowserFrame src="/images/landing/dashboard-table.png" alt="The Agency Listings dashboard" />
            </motion.div>

            {/* Two-column layout (lg+): float outside the frame's corners. Below that: stack below it. */}
            <div className="hidden lg:block">
              {toasts.map((t) => (
                <StatusToast key={t.label} {...t} />
              ))}
            </div>
            <div className="lg:hidden flex flex-col items-start gap-2 mt-4">
              {toasts.map((t) => (
                <StatusToast key={t.label} {...t} desktopClass="" />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Positioning strip */}
      <section className="border-y border-black/5 bg-white">
        <div className="mx-auto max-w-6xl px-6 lg:px-10 py-12 grid sm:grid-cols-3 gap-8 text-center">
          {[
            ["Before", "a new repo and a deploy for every listing."],
            ["Now", "a form. Saved instantly, live immediately."],
            ["Always", "one dashboard shows everything in play."],
          ].map(([word, copy], i) => (
            <Reveal key={word} delay={i * 0.1} variant="scaleIn">
              <p className="text-lg leading-snug">
                <span className="font-display italic text-[#8a7a5c]">{word}</span>{" "}
                <span className="text-[#1c1a17]/80">{copy}</span>
              </p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Editor showcase */}
      <section id="see-it-work" className="px-6 lg:px-10 py-24 lg:py-32">
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
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a7a5c" strokeWidth="2">
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
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
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
      <section className="px-6 lg:px-10 py-24 lg:py-32">
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

      {/* Footer */}
      <footer className="bg-[#1c1a17] text-white/60 px-6 lg:px-10 py-10">
        <div className="mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-4">
          <img src={brokerage.logo} alt={brokerage.name} className="h-8 w-auto" />
          <p className="text-xs">
            {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
            {brokerage.address.zip}
          </p>
        </div>
      </footer>
    </div>
  );
}
