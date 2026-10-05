import { motion } from "framer-motion";
import MarketingNav from "../components/marketing/MarketingNav";
import MarketingFooter from "../components/marketing/MarketingFooter";
import { BrowserWindow } from "../components/marketing/DeviceFrames";
import { BoardMock, LEAD_COLUMNS, PIPELINE_COLUMNS, TransactionMock, OverviewMock } from "../components/marketing/PeopleMocks";
import { Reveal, variants, easeOut } from "../components/marketing/motion";

/*
THESIS: The people an agent works with deserve the same care as the
  listings they sell — a lead should never be lost between "inquiry" and
  "closing".
OWN-WORLD: Inherits the landing page's world exactly (cream/black/brand
  red, Playfair headings, Inter body, browser-frame proof device, Reveal
  motion).
STORY: An agent sees how a stranger on their website becomes a lead, a
  pipeline contact, a transaction with a checklist, and a closed deal —
  all on boards in the dashboard they already use.
PROOF: The People module is private and sits behind a login, so the
  screens here are drawn from the real layouts with invented sample data
  (labeled as such), not screenshots of anyone's contacts.
*/

const SAMPLE = "Sample data";

export default function PeoplePage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] overflow-x-clip">
      <MarketingNav />

      {/* Hero */}
      <section className="relative px-6 lg:px-10 pt-16 pb-16 lg:pt-24 lg:pb-32">
        <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-16 items-center">
          <motion.div initial="hidden" animate="show" variants={variants.rise}>
            <h1 className="text-5xl sm:text-6xl font-display font-semibold leading-[1.08] mb-6">
              Every lead. Every deal.
              <br />
              <span className="italic text-[#ed2127]">Nothing slips.</span>
            </h1>
            <p className="text-[17px] text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md">
              Leads, pipeline and transactions on simple boards — with one-tap calling and texting,
              follow-up reminders, notes, and a checklist for every closing.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.9, ease: easeOut, delay: 0.15 }}
          >
            <BrowserWindow>
              <BoardMock title="Leads" columns={LEAD_COLUMNS} />
            </BrowserWindow>
            <p className="text-[11px] text-[#1c1a17]/40 mt-3 text-center">{SAMPLE}</p>
          </motion.div>
        </div>
      </section>

      {/* Leads */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft">
            <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">Leads</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              A website inquiry becomes a lead the moment it's sent.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              When someone fills out the contact form on your agent site or a listing page, they
              land on your Leads board automatically — with their message saved as the first note.
              No retyping, no forgotten email.
            </p>
            <ul className="space-y-3">
              {[
                "Call, text or email from any card in one tap",
                "A next follow-up date on everyone — overdue ones show red",
                "Drag people between stages, and rename the stages to fit how you work",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-[#1c1a17]/75">
                  <svg className="mt-0.5 shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserWindow>
              <BoardMock title="Leads" columns={LEAD_COLUMNS.slice(0, 3)} />
            </BrowserWindow>
            <p className="text-[11px] text-[#1c1a17]/40 mt-3 text-center">{SAMPLE}</p>
          </Reveal>
        </div>
      </section>

      {/* Pipeline */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">
          <Reveal variant="fromLeft" className="order-2 lg:order-1">
            <BrowserWindow>
              <BoardMock title="Pipeline" columns={PIPELINE_COLUMNS.slice(1)} />
            </BrowserWindow>
            <p className="text-[11px] text-[#1c1a17]/40 mt-3 text-center">{SAMPLE}</p>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1} className="order-1 lg:order-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">Pipeline</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Know who's ready in a year, and who's ready this week.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed mb-6 max-w-md">
              Sort the people you're working with by when they'll actually move — 12+ months out
              down to Active — and keep every conversation on record with timestamped notes. When
              they're ready, one button moves them to Transactions.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Transactions */}
      <section className="px-6 lg:px-10 py-24 lg:py-32 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-2xl mb-12">
            <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">Transactions</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Contract to closing, with a checklist that builds itself.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed">
              Every deal tracks the property, price and commission, the other agent, title company
              and lender, and the dates that matter — contract, inspection, appraisal, financing and
              closing. Pick buyer or seller and your checklist is added automatically, with due dates
              worked out from the deal's own dates.
            </p>
          </Reveal>
          <Reveal delay={0.1} variant="rise">
            <BrowserWindow className="max-w-4xl mx-auto">
              <TransactionMock />
            </BrowserWindow>
            <p className="text-[11px] text-[#1c1a17]/40 mt-3 text-center">{SAMPLE}</p>
          </Reveal>
        </div>
      </section>

      {/* Overview */}
      <section className="px-6 lg:px-10 py-24 lg:py-32">
        <div className="mx-auto max-w-6xl grid grid-cols-1 lg:grid-cols-[0.85fr_1.15fr] gap-14 items-center">
          <Reveal variant="fromLeft">
            <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127] mb-3">Overview</p>
            <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-5 leading-tight">
              Open it in the morning. Know your day.
            </h2>
            <p className="text-[15.5px] text-[#1c1a17]/70 leading-relaxed max-w-md">
              One page shows how many people sit in each stage, what's coming up this week —
              inspections, appraisals, closings — who's due a follow-up, which checklist tasks are
              overdue, and what your open deals are worth.
            </p>
          </Reveal>
          <Reveal variant="fromRight" delay={0.1}>
            <BrowserWindow>
              <OverviewMock />
            </BrowserWindow>
            <p className="text-[11px] text-[#1c1a17]/40 mt-3 text-center">{SAMPLE}</p>
          </Reveal>
        </div>
      </section>

      {/* Capability strip */}
      <section className="px-6 lg:px-10 py-24 bg-white border-y border-black/5">
        <div className="mx-auto max-w-6xl">
          <Reveal className="max-w-xl mb-14">
            <h2 className="text-3xl sm:text-4xl font-display font-semibold leading-tight">
              Built around how agents actually work.
            </h2>
          </Reveal>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              ["Private to you", "Each agent sees only their own people. Not even an admin can open another agent's contacts."],
              ["On when you want it", "People is its own module, switched on per agent — separate from the website tools."],
              ["Your stages, your words", "Rename any column to match your process. Everyone in it moves along automatically."],
              ["Your checklists", "Buyer and seller templates you edit once and reuse on every deal, with due dates you can override."],
              ["Archive, don't lose", "Mark a lead lost with a reason, and bring them back if they return."],
              ["Works on your phone", "Install the dashboard to your home screen and work your boards anywhere."],
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

      <MarketingFooter />
    </div>
  );
}
