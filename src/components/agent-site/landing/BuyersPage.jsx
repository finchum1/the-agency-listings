import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { HoneypotField } from "../../../lib/spamGuard";
import { AgentCard, Chips, ContactLink, Disclaimer, Eyebrow, Field, Heading, Journey, Lead, PageHero, Pillars, Section, inputClass, outlineButton, primaryButton } from "./Parts";
import { useLandingSubmit } from "./useLandingSubmit";
import { BUYER_STEPS, CLOSING_STEPS, LENDER_REVIEWS, LOAN_DONTS, OFFER_STEPS, PILLARS, WISH_LOCATIONS, WISH_STYLES, WISH_TYPES } from "./content";

const NEIGHBORHOODS = ["Carlton Landing", "Bricktown", "Downtown Edmond", "Norman", "Arcadia"];

// /buyers: the buyer's guide as a page (condensed from The Agency's Buyer's Guide), with its worksheet turned into a wish list that goes to
// the agent as a lead.
export default function BuyersPage() {
  const { site } = useAgentSiteContext();
  const first = (site.agent.name || "").split(" ")[0] || "your agent";
  const isAgency = /the agency/i.test(site.brokerage.name);
  const oklahoma = /oklahoma/i.test(site.brokerage.locationLabel || "");

  return (
    <>
      <PageHero
        eyebrow="The buyer's guide"
        title="Let's go shopping."
        lead={
          oklahoma
            ? "OKC is where Capital City style meets country charm. We'll roll out the red carpet and be with you every step of the way, from the first conversation to the keys in your hand."
            : "We'll roll out the red carpet and be with you every step of the way, from the first conversation to the keys in your hand."
        }
        photo={oklahoma ? "/landing/okc-skyline.jpg" : "/landing/buyers-family.jpg"}
        below={
          oklahoma ? (
            <div>
              <div className="grid sm:grid-cols-3 gap-3 max-w-3xl">
                <div className="border border-[var(--as-on-dark)]/25 p-5">
                  <p className="font-display text-4xl font-semibold">260+</p>
                  <p className="text-sm opacity-70">scenic parks</p>
                </div>
                <div className="border border-[var(--as-on-dark)]/25 p-5">
                  <p className="font-display text-4xl font-semibold">80+ mi</p>
                  <p className="text-sm opacity-70">of multi-use trails</p>
                </div>
                <div className="border border-[var(--as-on-dark)]/25 p-5">
                  <p className="font-display text-xl font-semibold leading-snug">Dynamic food, art and sports scenes</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="text-xs tracked-wide uppercase opacity-60 mr-1">Popular neighborhoods</span>
                {NEIGHBORHOODS.map((n) => (
                  <span key={n} className="rounded-full border border-[var(--as-on-dark)]/30 px-4 py-1.5 text-sm">
                    {n}
                  </span>
                ))}
              </div>
            </div>
          ) : null
        }
      >
        <a href="#wishlist" className={primaryButton}>
          Start my wish list
        </a>
        <ContactLink className={`${outlineButton} text-[var(--as-on-dark)]`}>Talk to {first}</ContactLink>
      </PageHero>

      <Section id="journey">
        <Eyebrow>The homebuying journey</Eyebrow>
        <Heading>Eight steps to your keys</Heading>
        <Lead>The process can seem daunting. Your agent and brokerage have your back. Tap a step to see what happens.</Lead>
        <Journey steps={BUYER_STEPS} />
      </Section>

      <Section tone="alt" id="financing">
        <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-end">
          <div>
            <Eyebrow>Financing</Eyebrow>
            <Heading>When it comes to real estate, money talks.</Heading>
            <Lead>
              Get pre-approved before you search. I connect you with a mortgage broker who tells you how much a bank will lend, explains your financing options and your down payment, and puts you in a better negotiating position in the seller&rsquo;s eyes.
            </Lead>
          </div>
          <img src="/landing/tablet.jpg" alt="" loading="lazy" className="hidden lg:block h-56 w-full object-cover" />
        </div>

        <div className="mt-10 grid md:grid-cols-2 gap-5">
          <div className="bg-[var(--as-bg)] border border-[var(--as-text)]/12 p-7 opacity-85">
            <p className="text-xs font-semibold tracked-wide uppercase opacity-55">Pre-qualified</p>
            <p className="mt-2 font-display text-2xl font-semibold">An opinion letter</p>
            <p className="mt-2 text-[15px] leading-relaxed opacity-75">A lender&rsquo;s educated guess. Helpful, but not the same thing.</p>
          </div>
          <div className="bg-[var(--as-dark)] text-[var(--as-on-dark)] p-7 border-t-4 border-[var(--as-accent)]">
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/70">Pre-approved</p>
            <p className="mt-2 font-display text-2xl font-semibold">A full loan approval</p>
            <p className="mt-2 text-[15px] leading-relaxed opacity-80">Sets your price range and makes your offer stronger. This is the one you want.</p>
          </div>
        </div>

        <p className="mt-14 font-display text-2xl sm:text-3xl font-semibold">What do lenders review?</p>
        <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {LENDER_REVIEWS.map((c) => (
            <div key={c.title} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-6">
              <p className="font-display text-lg font-semibold">{c.title}</p>
              <p className="mt-2 text-sm leading-relaxed opacity-75">{c.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[15px] opacity-70">Don&rsquo;t worry if you don&rsquo;t meet every guideline. Lenders work through a variety of circumstances, and I&rsquo;m here to help.</p>

        <p className="mt-14 font-display text-2xl sm:text-3xl font-semibold">Before you apply for a loan, please don&rsquo;t&hellip;</p>
        <div className="mt-6 grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {LOAN_DONTS.map((c) => (
            <div key={c.title} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-5 flex gap-4">
              <span className="text-xl font-bold text-[#b3261e]" aria-hidden="true">
                ✕
              </span>
              <div>
                <p className="font-semibold">{c.title}</p>
                <p className="mt-1 text-sm leading-relaxed opacity-70">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <WishList />

      <Section tone="alt" id="offer">
        <Eyebrow>Making the offer</Eyebrow>
        <Heading>Not too high. Not too low. Just right.</Heading>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {OFFER_STEPS.map((c, i) => (
            <div key={c.title} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-7">
              <p className="font-display text-4xl font-semibold text-[var(--as-accent)]">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 font-display text-xl font-semibold">{c.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-75">{c.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 bg-[var(--as-dark)] text-[var(--as-on-dark)] p-8 grid md:grid-cols-[260px_1fr] gap-6">
          <div>
            <p className="text-xs font-semibold tracked-wide uppercase text-[var(--as-on-dark)]/70">Escrow, in plain English</p>
            <p className="mt-2 font-display text-2xl font-semibold">So what is it?</p>
          </div>
          <p className="leading-relaxed opacity-85">
            Escrow is when everyone in the transaction deposits documents and funds with a neutral third party, the escrow agent. They are held in trust until the conditions in everyone&rsquo;s written instructions are met, then released. Think of it as a clearinghouse that moves the money and paperwork needed to transfer the home. Don&rsquo;t worry, I&rsquo;ll walk you through it.
          </p>
        </div>
      </Section>

      <Section id="closing">
        <Eyebrow>The closing</Eyebrow>
        <Heading>Looks like we made it.</Heading>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {CLOSING_STEPS.map((c, i) => {
            const last = i === CLOSING_STEPS.length - 1;
            return (
              <div key={c.title} className={`p-6 border-t-4 ${last ? "bg-[var(--as-dark)] text-[var(--as-on-dark)] border-[var(--as-accent)]" : "bg-[var(--as-bg-alt)] border-[var(--as-text)]"}`}>
                <p className={`text-xs font-semibold tracked-wide uppercase ${last ? "text-[var(--as-on-dark)]/70" : "opacity-50"}`}>Step {i + 1}</p>
                <p className="mt-1.5 font-display text-xl font-semibold">{c.title}</p>
                <p className={`mt-1.5 text-[15px] leading-relaxed ${last ? "opacity-80" : "opacity-70"}`}>{c.body}</p>
              </div>
            );
          })}
        </div>
        <p className="mt-6 text-[16px] opacity-70">And we&rsquo;ve only just begun: contractors, designers, painters, plumbers, house-sitting.</p>
      </Section>

      {isAgency && (
        <Section tone="alt" id="different">
          <Eyebrow>Buying with {site.brokerage.name}</Eyebrow>
          <Heading>So, what do we do differently?</Heading>
          <Pillars items={PILLARS} />
        </Section>
      )}

      {/* The last band is light (the footer under it is dark); it takes whichever light tone the section above it is not. */}
      <Section tone={isAgency ? "bg" : "alt"} id="start" className={isAgency ? "border-t border-[var(--as-text)]/10" : ""}>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <Eyebrow>Ready to find your dream home?</Eyebrow>
            <Heading>We can take you there.</Heading>
          </div>
          <AgentCard onDark={false} />
        </div>
        <Disclaimer>
          {site.brokerage.name} makes no guarantees regarding the subject property or your ability to purchase it. Information from the seller or their agent may contain errors or omissions and should be independently verified. This guide is for information only and is not legal, tax or real estate advice; consult a qualified real estate attorney or CPA. Your agent may act as a dual agent if another agent at the brokerage represents the seller.
        </Disclaimer>
      </Section>
    </>
  );
}

function WishList() {
  const { site } = useAgentSiteContext();
  const { status, error, submit, guard } = useLandingSubmit("buyers");
  const [f, setF] = useState({ name: "", email: "", phone: "", locations: [], types: [], styles: [], must_haves: "", would_love: "", deal_breakers: "", close_by: "" });
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const put = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));
  const onSubmit = (e) => {
    e.preventDefault();
    const { name, email, phone, ...details } = f;
    submit({ name, email, phone, details });
  };
  const first = (site.agent.name || "").split(" ")[0] || "your agent";
  const group = "text-xl sm:text-2xl font-display font-semibold";

  return (
    <Section id="wishlist">
      <Eyebrow>Your wish list</Eyebrow>
      <Heading>Enough about us. Let&rsquo;s talk about you.</Heading>
      <Lead>Get your thoughts down as you start thinking about exactly what you want from your new home. Send it to {first} and the search begins.</Lead>
      {status === "sent" ? (
        <div role="status" className="mt-10 bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-10 text-center">
          <p className="font-display text-3xl font-semibold">Got your wish list. Thank you!</p>
          <p className="mt-3 text-[16px] opacity-75">{first} will be in touch shortly to start the search.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative mt-10 bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-6 sm:p-10 space-y-9">
          <HoneypotField guard={guard} />
          <div>
            <p className={group}>What&rsquo;s your ideal location?</p>
            <p className="mt-1 mb-4 text-sm opacity-60">What would you like within moments from home?</p>
            <Chips multiple label="Ideal location" options={WISH_LOCATIONS} value={f.locations} onChange={put("locations")} />
          </div>
          <div>
            <p className={`${group} mb-4`}>What kind of home?</p>
            <Chips multiple label="Kind of home" options={WISH_TYPES} value={f.types} onChange={put("types")} />
          </div>
          <div>
            <p className={group}>What&rsquo;s your style?</p>
            <p className="mt-1 mb-4 text-sm opacity-60">There&rsquo;s no wrong answer.</p>
            <Chips multiple label="Style" options={WISH_STYLES} value={f.styles} onChange={put("styles")} />
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <Field label="Must-haves">
              <textarea rows={3} value={f.must_haves} onChange={set("must_haves")} placeholder="Bedrooms, an office, a garage…" className={inputClass} />
            </Field>
            <Field label="Would love to have">
              <textarea rows={3} value={f.would_love} onChange={set("would_love")} placeholder="A pool, theater, yard, wine room… dream big." className={inputClass} />
            </Field>
            <Field label="Deal breakers">
              <textarea rows={3} value={f.deal_breakers} onChange={set("deal_breakers")} placeholder="If we see these, we won't schedule the showing." className={inputClass} />
            </Field>
          </div>
          <div className="grid md:grid-cols-4 gap-4 items-end">
            <Field label="Your name">
              <input required value={f.name} onChange={set("name")} autoComplete="name" className={inputClass} />
            </Field>
            <Field label="Email">
              <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Phone (optional)">
              <input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" className={inputClass} />
            </Field>
            <Field label="When do you need to close?">
              <input value={f.close_by} onChange={set("close_by")} placeholder="Before the school year" className={inputClass} />
            </Field>
          </div>
          {status === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {error} You can also call or email {site.agent.name || "your agent"} directly.
            </p>
          )}
          <button type="submit" disabled={status === "sending"} className={`${primaryButton} disabled:opacity-60`}>
            {status === "sending" ? "Sending…" : `Send my wish list to ${first}`}
          </button>
        </form>
      )}
    </Section>
  );
}
