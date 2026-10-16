import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserFrame } from "../components/marketing/DeviceFrames";
import { Reveal, variants, easeOut } from "../components/marketing/motion";
import { isMarketingHost } from "../lib/appHosts";
import { contactMailto } from "../lib/marketingContact";
import brokerage from "../lib/brokerage";

/*
THESIS: The Agency's agents get one dashboard that runs both halves of their
  business, the website and the back office, on The Agency's own brand.
OWN-WORLD: The Agency's existing system: red mark, Playfair Display headings,
  Inter body, cream/black/brand-red palette, pill buttons, rounded-2xl cards.
STORY: An Agency agent lands, sees the real dashboard (their day on one page),
  learns the two halves, sees each feature proven with a real screen, and
  requests early access. The flow mirrors realestate.latchpointstudios.com,
  the same product's general page.
FIRST VIEWPORT: Eyebrow with the Agency mark, headline, one sentence, Request
  early access, and the real dashboard in a browser frame with a phone.
*/

const SAMPLE = "Sample data. Every name, number, and address on these screens is invented.";

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="2" className="mt-1 shrink-0">
      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Bullets({ items }) {
  return (
    <ul className="space-y-3 mt-6">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 text-[15px] leading-relaxed text-[#1c1a17]/75 dark:text-[#faf9f7]/75">
          <Check />
          {item}
        </li>
      ))}
    </ul>
  );
}

function Eyebrow({ children }) {
  return <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">{children}</p>;
}

/** Copy on one side, a visual on the other; `flip` swaps them on large screens. */
function Feature({ eyebrow, title, body, bullets, visual, caption, flip = false }) {
  return (
    <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
      <Reveal variant={flip ? "fromRight" : "fromLeft"} className={flip ? "lg:order-2" : ""}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="text-3xl sm:text-4xl font-display font-semibold leading-tight mb-5">{title}</h3>
        <p className="text-[15.5px] text-[#1c1a17]/70 dark:text-[#faf9f7]/70 leading-relaxed max-w-md">{body}</p>
        <Bullets items={bullets} />
      </Reveal>
      <Reveal variant={flip ? "fromLeft" : "fromRight"} delay={0.1} className={`min-w-0 ${flip ? "lg:order-1" : ""}`}>
        {visual}
        {caption && <p className="text-[11px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-3 text-center">{caption}</p>}
      </Reveal>
    </div>
  );
}

function GroupHeader({ id, title, body }) {
  return (
    <Reveal className="max-w-2xl">
      <div id={id} className="scroll-mt-28" />
      <Eyebrow>{title}</Eyebrow>
      <h2 className="text-3xl sm:text-5xl font-display font-semibold leading-tight">{body}</h2>
    </Reveal>
  );
}

const FAQ = [
  ["When can I get in?", "We're inviting people in a few at a time, by hand. Request early access and we'll email you to set up a short call when there's a spot."],
  ["Will it look like The Agency?", "Yes. The Agency's logo and brand colors are built in, so your website, your property sites and your dashboard all stay on brand."],
  ["Do I need to be technical?", "No. Editing a listing, writing a post, or updating a lead is a form. If you can use your email, you can run this."],
  ["Does it work with Google Calendar?", "Yes. Connect your Google account, choose the calendars to show, and your schedule appears on the dashboard. Add or edit an appointment there and it updates in Google Calendar, and changes in Google show up in the dashboard. You can disconnect at any time."],
  ["I already have a website and a blog. Can you move them?", "Yes. Posts can be imported from your current site, and old URLs are redirected to the new ones with permanent redirects, so links and search rankings carry over."],
  ["Does it work on my phone?", "Yes. Your site is built phone-first, and the dashboard installs to your home screen like an app, so checking a lead between showings takes a tap."],
  ["Can people on my team see different things?", "Yes. Each person can have full website access, blog-only access, or none, and the leads, pipeline, and transactions tools are switched on per agent."],
];

export default function LandingPage() {
  const onMarketingHost = isMarketingHost(window.location.hostname);
  const cta = onMarketingHost ? "#early-access" : contactMailto("Interested in the dashboard");

  return (
    <div className="min-h-screen bg-[#faf9f7] dark:bg-[#0d0d0d] text-[#1c1a17] dark:text-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <div className="flex items-center gap-3 mb-6">
              <img src={brokerage.logos.red} alt="The Agency" className="h-11 w-auto dark:hidden" />
              <img src={brokerage.logos.white} alt="The Agency" className="h-11 w-auto hidden dark:block" />
              <span className="h-7 w-px bg-black/15 dark:bg-white/20" />
              <span className="text-[11px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/55 dark:text-[#faf9f7]/55">For Agency agents</span>
            </div>
            <h1 className="text-5xl sm:text-[3.4rem] font-display font-semibold leading-[1.08] mb-6">
              Your Agency website and back office,{" "}
              <span className="italic text-[#ed2127]">in one place.</span>
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 dark:text-[#faf9f7]/70 leading-relaxed mb-8 max-w-md">
              Your site, leads, pipeline, transactions, and calendar in one dashboard, already running at The Agency Oklahoma.
              We build it, move you over, and keep it running.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <a
                href={cta}
                className="text-sm font-semibold px-7 py-3.5 rounded-full bg-[#ed2127] text-white hover:bg-[#d41b21] transition-colors"
              >
                Request early access
              </a>
              <a
                href="#home"
                className="text-sm font-semibold px-7 py-3.5 rounded-full border border-black/15 dark:border-white/20 hover:border-[#ed2127] hover:text-[#ed2127] transition-colors"
              >
                See how it works
              </a>
            </div>
          </motion.div>

          <div className="relative min-w-0 pb-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
            >
              <BrowserFrame src="/images/landing/dash-home.jpg" alt="The dashboard home page: today's schedule, shortcuts, and tasks" />
            </motion.div>
            <motion.figure
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.9, ease: easeOut, delay: 0.35 }}
              className="absolute -bottom-2 right-2 w-[92px] sm:w-[120px] lg:-right-4 lg:w-[140px] overflow-hidden rounded-[1.4rem] border-[4px] border-[#1c1a17] bg-[#1c1a17] shadow-xl shadow-black/25"
            >
              <div className="h-3.5 bg-white flex items-center justify-center"><span className="h-1 w-8 rounded-full bg-[#1c1a17]" /></div>
              <img src="/images/landing/dash-home-mobile.jpg" alt="The dashboard on a phone" className="block w-full h-auto" />
            </motion.figure>
            <p className="text-[11px] text-[#1c1a17]/40 dark:text-[#faf9f7]/40 mt-3 max-w-[60%]">{SAMPLE}</p>
          </div>
        </div>
      </section>

      {/* Running at The Agency */}
      <section className="border-y border-black/5 dark:border-white/10 bg-white dark:bg-[#161616]">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8">
          <Reveal>
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Running at The Agency today</p>
              <ul className="grid grid-cols-1 sm:grid-cols-3 gap-x-10 gap-y-4">
                {[
                  ["Terrence Finchum", "Agent website", "https://terrencefinchum.com"],
                  ["The Agency Oklahoma", "Brokerage website", "https://the-agency-oklahoma.vercel.app"],
                  ["The dashboard", "In daily use", "https://app.latchpointstudios.com"],
                ].map(([name, note, href]) => (
                  <li key={name}>
                    <a href={href} target="_blank" rel="noopener noreferrer" className="group block">
                      <span className="block text-sm font-semibold group-hover:text-[#ed2127] transition-colors">{name} ↗</span>
                      <span className="block text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{note}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Two halves */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <Eyebrow>The system</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-display font-semibold leading-tight mb-5">Two halves, one login.</h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 dark:text-[#faf9f7]/70 leading-relaxed">
              Most agents run a website in one place, leads in a second, and transactions in a spreadsheet. Here it&rsquo;s one
              dashboard, and what you do in it shows up on your site.
            </p>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-2 gap-6">
            {[
              ["The website", ["Your own agent site on The Agency's brand, on your own domain", "A property site for every listing, from a form", "A blog with a post calendar, a publish checklist, and a formatting menu right on your text", "Areas, bios, and testimonials you edit yourself"]],
              ["The back office", ["A home page for your day: schedule, new inquiries, tasks, and your goal", "Leads and a pipeline, tagged buyer, seller, or both", "Transactions with key dates, checklists, and progress rings", "Open houses, flyers, and upcoming listings"]],
            ].map(([title, items], i) => (
              <Reveal key={title} variant="scaleIn" delay={i * 0.1} className="rounded-2xl bg-white dark:bg-[#161616] border border-black/5 dark:border-white/10 shadow-xl shadow-black/5 p-8">
                <h3 className="text-xl font-display font-semibold">{title}</h3>
                <Bullets items={items} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Your day */}
      <section className="px-6 lg:px-10 pb-24 lg:pb-32">
        <div className="mx-auto max-w-6xl">
          <GroupHeader id="home" title="Your day" body="Open one page and know what today looks like." />
          <div className="mt-16">
            <Feature
              eyebrow="Home"
              title="Your schedule, in sync with Google Calendar."
              body="Connect your Google account and your calendars show up on the dashboard, in day, week, and month views. Add or change an appointment here and it changes in Google Calendar, and the other way around."
              bullets={[
                "Pick which calendars to show; calendars you can only view stay view-only",
                "Your deal dates and tasks appear on the same schedule",
                "New website inquiries are waiting right below, with call, text, and email buttons",
                "Repeating tasks and a scorecard that tracks your year against your goal",
              ]}
              visual={
                <div className="relative pb-6 sm:pr-24">
                  <BrowserFrame src="/images/landing/dash-calendar.jpg" alt="The schedule with a connected Google account and the calendars shown on the dashboard" />
                  <img
                    src="/images/landing/dash-event.jpg"
                    alt="Adding an appointment to Google Calendar from the dashboard"
                    className="hidden sm:block absolute bottom-0 right-0 w-[200px] lg:w-[230px] rounded-xl border border-black/10 bg-white shadow-2xl shadow-black/25"
                  />
                </div>
              }
              caption={SAMPLE}
            />
          </div>
        </div>
      </section>

      {/* The website */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white dark:bg-[#161616] border-y border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-6xl">
          <GroupHeader id="website" title="The website" body="A site that looks like you, and keeps itself current." />
          <div className="mt-16 flex flex-col gap-24">
            <Feature
              eyebrow="Listings"
              title="A property site for every listing."
              body="Fill out a form and the listing has its own site: hero photo, gallery, features, map, and a tour request. No new repo, no redeploy, no waiting on a developer."
              bullets={["Change a listing's status and the live site updates the moment you do", "Open houses appear as a banner on the listing", "Printable flyers generated from the same listing"]}
              visual={<BrowserFrame src="/images/landing/listing-home-fresh.jpg" alt="A listing's property website with hero photo, price, and key stats" />}
            />
            <Feature
              flip
              eyebrow="Agent sites"
              title="Your own site, on The Agency's brand."
              body="A bio, your areas of expertise, testimonials, your listings, and a blog, in a look you pick, with The Agency's logo and colors built in. It's built phone-first, because that's where your clients are."
              bullets={["Six looks to start from, then your photos and square or rounded buttons", "Your own domain, with old URLs redirected so you keep your search rankings", "Inquiry forms that filter spam, confirm to the visitor, and land straight in your leads"]}
              visual={
                <div className="relative pb-6 sm:pr-16">
                  <BrowserFrame src="/images/landing/agent-site-home.jpg" alt="An Agency agent's website home page" />
                  <img
                    src="/images/landing/agent-site-mobile.jpg"
                    alt="The same agent website on a phone"
                    className="hidden sm:block absolute -bottom-2 right-0 w-[124px] rounded-[1.4rem] border-[4px] border-[#1c1a17] shadow-xl shadow-black/25"
                  />
                </div>
              }
            />
            <Feature
              eyebrow="Blog"
              title="A blog you'll actually keep up."
              body="Neighborhood guides, local features, and market notes are how an agent gets found. The editor, the calendar, and the checklist are built to make a weekly post the easy thing to do."
              bullets={["Select text and the formatting menu appears right above it", "Schedule posts ahead, with a calendar that shows the gaps", "A publish checklist: title, category, excerpt, cover photo, and a real length", "Post views, all-time and last 30 days, with your top post", "Moving over from another site? Your old posts can be imported"]}
              visual={<BrowserFrame src="/images/landing/dash-blog-editor.jpg" alt="The blog editor with the formatting menu floating above selected text" />}
              caption={SAMPLE}
            />
          </div>
        </div>
      </section>

      {/* The back office */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <GroupHeader id="back-office" title="The back office" body="Leads, pipeline, and transactions, laid out the way agents think." />
          <div className="mt-16 flex flex-col gap-24">
            <Feature
              eyebrow="Overview"
              title="Your whole book at a glance."
              body="Leads, pipeline, and deals by stage, the key dates coming up in the next two weeks, and the follow-ups due today, on one page."
              bullets={["Open deals, expected commission, and closed volume for the year", "Inspections, appraisals, and closings in date order", "Open anyone from a follow-up and call, text, or email in one tap"]}
              visual={<BrowserFrame src="/images/landing/dash-overview.jpg" alt="The People overview with counts by stage, key dates, and follow-ups" />}
              caption={SAMPLE}
            />
            <Feature
              flip
              eyebrow="Leads"
              title="Every lead has a next step."
              body="Website inquiries, open house sign-ins, and referrals land on a board. Each card carries a follow-up date, and anything overdue turns red, so the person you meant to call doesn't slip."
              bullets={["Tag each person as a buyer, a seller, or both", "Call, text, or email from inside the card", "A second inquiry from the same person joins their existing card", "Columns you can rename, reorder, and add"]}
              visual={<BrowserFrame src="/images/landing/dash-leads.jpg" alt="The Leads board with buyer and seller tags and follow-up dates" />}
              caption={SAMPLE}
            />
            <Feature
              eyebrow="Pipeline"
              title="A pipeline that looks past this month."
              body="Your sphere, your someday-buyers, and the sellers who'll list in spring, all in one place and sorted by how soon they're likely to move. The same board, the same follow-up dates, a longer horizon."
              bullets={["Stages from 12+ months out to active, or whatever fits how you work", "Everyone you're nurturing, visible at a glance", "Move a card as the timeline changes"]}
              visual={<BrowserFrame src="/images/landing/dash-pipeline.jpg" alt="The Pipeline board, from 12 months out to active" />}
              caption={SAMPLE}
            />
            <Feature
              flip
              eyebrow="Transactions"
              title="Under contract, nothing forgotten."
              body="Each deal gets its key dates, the numbers, the title and lender, and buyer or seller checklists for tasks and documents, with deadlines counted from the contract date. Progress rings show how far along every deal is."
              bullets={["Contract, inspection, appraisal, financing, and closing dates", "A task checklist and a document list, with seller and buyer versions you can edit", "Open deals, expected commission, and closed volume on your Overview"]}
              visual={
                <div className="relative pb-20 sm:pb-24">
                  <BrowserFrame src="/images/landing/dash-transactions.jpg" alt="The Transactions board with task and document progress rings on every deal" />
                  <img
                    src="/images/landing/dash-checklists.jpg"
                    alt="A deal's task and document checklists with progress rings"
                    className="absolute -bottom-2 right-3 w-[62%] sm:w-[54%] rounded-xl border border-black/10 bg-white shadow-2xl shadow-black/25"
                  />
                </div>
              }
              caption={SAMPLE}
            />
            <Feature
              eyebrow="Listings"
              title="One place to manage every listing."
              body="Status, price, photos, and open houses live in a single dashboard, and the whole office can see coming-soon listings and what buyers want before anything is public."
              bullets={["Add photos, pick the hero shot, and schedule open houses", "Upcoming listings and buyer needs tracked before they hit the market", "A brokerage-wide view when you manage more than one agent"]}
              visual={<BrowserFrame src="/images/landing/dashboard-overview.jpg" alt="The Listings dashboard" />}
            />
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white dark:bg-[#161616] border-y border-black/5 dark:border-white/10">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <Eyebrow>Who it&rsquo;s for</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-display font-semibold leading-tight">Built for one agent, or a whole office.</h2>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-3 gap-6">
            {[
              ["Agents", "Your own site and blog, plus a lead and pipeline board you'll actually open. Everything an independent agent needs, with nothing you don't."],
              ["Teams", "Give each person the access that fits: full website editing, blog only, or none, and switch the leads and pipeline tools on per agent."],
              ["Offices", "A brokerage site with an agent roster, areas, and a blog, and a dashboard for every listing and every agent. Each office gets its own location and look."],
            ].map(([title, body], i) => (
              <Reveal key={title} variant="scaleIn" delay={i * 0.1} className="rounded-2xl bg-[#faf9f7] dark:bg-[#0d0d0d] p-8">
                <h3 className="text-lg font-display font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-display font-semibold leading-tight">We build it around how you already work.</h2>
          </Reveal>
          <div className="mt-12 grid md:grid-cols-3 gap-10">
            {[
              ["01", "We talk through your day", "Where leads come from, what stages your pipeline has, what happens between contract and closing. The back office gets shaped to that, not the other way around."],
              ["02", "We build and move you over", "Your site, your dashboard, and your old blog posts. Old URLs are redirected to the new ones so the search ranking you've earned comes with you."],
              ["03", "You run it, we keep it healthy", "Edits are forms, not code. And when you want something added later, you have a studio to call instead of a ticket queue."],
            ].map(([n, title, body], i) => (
              <Reveal key={n} delay={i * 0.1}>
                <p className="font-display italic text-2xl text-[#ed2127]">{n}</p>
                <h3 className="mt-2 text-lg font-display font-semibold">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 lg:px-10 pb-24 lg:pb-32">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <Eyebrow>Questions</Eyebrow>
            <h2 className="text-3xl sm:text-5xl font-display font-semibold leading-tight">Things agents ask first.</h2>
          </Reveal>
          <Reveal delay={0.1} className="mt-10 divide-y divide-black/10 dark:divide-white/10 border-y border-black/10 dark:border-white/10">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-left text-base font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-black/20 dark:border-white/25 transition-transform duration-300 group-open:rotate-45">
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M5 1v8M1 5h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{a}</p>
              </details>
            ))}
          </Reveal>
          <p className="mt-8 text-xs text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
            <Link to="/agent-websites" className="hover:text-[#ed2127]">Agent websites</Link>
            {" · "}
            <Link to="/brokerage-website" className="hover:text-[#ed2127]">Brokerage site</Link>
            {" · "}
            <Link to="/property-websites" className="hover:text-[#ed2127]">Property sites</Link>
            {" · "}
            <Link to="/people" className="hover:text-[#ed2127]">People</Link>
            {" · "}
            <Link to="/upcoming" className="hover:text-[#ed2127]">Upcoming</Link>
          </p>
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}
