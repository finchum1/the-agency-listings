import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { HoneypotField } from "../../../lib/spamGuard";
import SiteLink from "../SiteLink";
import { AgentCard, Chips, ContactLink, Disclaimer, Eyebrow, Field, Heading, Journey, Lead, PageHero, Pillars, Section, aboveFooter, inputClass, outlineButton, primaryButton } from "./Parts";
import { useLandingSubmit } from "./useLandingSubmit";
import { CLOSING_CHECKLIST, OFFER_OPTIONS, PILLARS, SELLER_COSTS, SELLER_PREP, SELLER_STEPS, SELL_TIMELINES } from "./content";

// /sellers: the seller's guide as a page (condensed from The Agency's Seller's Guide), ending in a request for a listing consultation.
export default function SellersPage() {
  const { site } = useAgentSiteContext();
  const first = (site.agent.name || "").split(" ")[0] || "your agent";
  const isAgency = /the agency/i.test(site.brokerage.name);

  return (
    <>
      <PageHero
        eyebrow="The seller's guide"
        title="Your next chapter starts here."
        lead="So you're ready to make your move? The red carpet treatment is just our style. Your agent and brokerage have your back, every step of the way."
        photo="/landing/seller-backyard.jpg"
      >
        <SiteLink slug={site.slug} path="/home-value" className={primaryButton}>
          What&rsquo;s my home worth?
        </SiteLink>
        <ContactLink className={`${outlineButton} text-[var(--as-on-dark)]`}>Talk to {first}</ContactLink>
      </PageHero>

      <Section id="journey">
        <Eyebrow>The home selling journey</Eyebrow>
        <Heading>Eight steps, start to finish</Heading>
        <Lead>While selling can seem daunting, we are with you at every step. Tap a step to see what happens.</Lead>
        <Journey steps={SELLER_STEPS} />
      </Section>

      <Section tone="alt" id="prepare">
        <div className="grid lg:grid-cols-[1fr_340px] gap-10 items-end">
          <div>
            <Eyebrow>Get it ready</Eyebrow>
            <Heading>What improvements are a must?</Heading>
            <Lead>
              First impressions matter. I recommend updates and repairs for your property type, price point and neighborhood, and connect you with trusted contractors. The goal: the best outcome with the least financial effort on your part.
            </Lead>
          </div>
          <img src="/landing/staging.jpg" alt="" loading="lazy" className="hidden lg:block h-56 w-full object-cover" />
        </div>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {SELLER_PREP.map((c, i) => (
            <div key={c.title} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-7">
              <p className="font-display text-4xl font-semibold text-[var(--as-accent)]">{String(i + 1).padStart(2, "0")}</p>
              <p className="mt-2 font-display text-xl font-semibold">{c.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-75">{c.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section tone="dark" id="pricing">
        <Eyebrow onDark>Pricing strategy</Eyebrow>
        <Heading className="max-w-3xl">We go beyond selling four walls and focus on selling a lifestyle.</Heading>
        <div className="mt-10 grid md:grid-cols-2 gap-6">
          <div className="border border-[var(--as-on-dark)]/20 p-8">
            <p className="font-display text-2xl font-semibold">Pricing is an art and a science</p>
            <p className="mt-3 leading-relaxed opacity-80">
              We understand market conditions locally and nationally, but the method goes beyond bedroom counts and square footage. It is the intangibles that are the specialty: the architectural details, the nuances of a floor plan, and what they mean for the overall value of your home.
            </p>
          </div>
          <div className="border border-[var(--as-on-dark)]/20 p-8">
            <p className="font-display text-2xl font-semibold">Not your first rodeo?</p>
            <p className="mt-3 leading-relaxed opacity-80">
              For a home that has been sitting, we create urgency and justify the price, which may mean lowering it or raising it. Each property is unique. The mission is to make your home the king or queen of its category.
            </p>
          </div>
        </div>
        <p className="mt-10 font-display italic text-2xl text-[var(--as-on-dark)]/90">The price must be right. Don&rsquo;t worry, we&rsquo;ve got you covered.</p>
      </Section>

      <Section id="offers">
        <div className="grid lg:grid-cols-[1fr_380px] gap-10 items-end">
          <div>
            <Eyebrow>Here come the buyers</Eyebrow>
            <Heading>An offer is in. Your three options.</Heading>
            <Lead>
              Offers include the price, what stays and goes, the buyer&rsquo;s deposit, move-in dates, contingencies and the date the offer expires. We walk through every one, and negotiating starts before the first offer arrives.
            </Lead>
          </div>
          <img src="/landing/offer-table.jpg" alt="" loading="lazy" className="hidden lg:block h-52 w-full object-cover" />
        </div>
        <div className="mt-10 grid md:grid-cols-3 gap-5">
          {OFFER_OPTIONS.map((o) => (
            <div key={o.title} className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-7" style={{ borderTop: `4px solid ${o.color}` }}>
              <p className="text-xs font-semibold tracked-wide uppercase" style={{ color: o.color }}>
                {o.label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold">{o.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-75">{o.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-6 grid md:grid-cols-2 gap-5">
          <div className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-7">
            <p className="font-display text-xl font-semibold">What are my financial parameters?</p>
            <p className="mt-2 text-sm opacity-70">Closing costs can include:</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[15px]">
              {SELLER_COSTS.map((c) => (
                <li key={c}>• {c}</li>
              ))}
            </ul>
            <p className="mt-4 text-sm opacity-60">I will refer you to a CPA or financial advisor to pin down your number.</p>
          </div>
          <div className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-7">
            <p className="font-display text-xl font-semibold">Multiple offers?</p>
            <p className="mt-2 text-[15px] leading-relaxed opacity-75">
              In a high-demand, low-inventory area you may get several. We weigh the strength and limits of each, negotiate to maximize your value and protect your legal interests.
            </p>
            <p className="mt-3 text-[15px] leading-relaxed opacity-75">
              <strong>Good to know:</strong> a buyer can withdraw an offer until you accept it in writing, so time is of the essence.
            </p>
          </div>
        </div>
      </Section>

      <Section tone="alt" id="closing">
        <Eyebrow>The push to closing</Eyebrow>
        <Heading>Buttoning up the details</Heading>
        <div className="mt-10 grid lg:grid-cols-2 gap-6">
          <div className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-8">
            <p className="text-xs font-semibold tracked-wide uppercase opacity-55">The checklist</p>
            <ul className="mt-4 space-y-3">
              {CLOSING_CHECKLIST.map((c) => (
                <li key={c} className="flex gap-3 text-[15.5px]">
                  <span className="text-[var(--as-accent)]" aria-hidden="true">
                    ✓
                  </span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-5">
            {[
              ["Inspection and repairs", "The buyer may have days or weeks to investigate. Their findings can lead to repair requests, credits or price changes. We keep you on track with your obligations."],
              ["Getting ready to move", "I recommend moving companies and cleaners so your home is ready for closing day."],
            ].map(([t, b]) => (
              <div key={t} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-6">
                <p className="font-display text-xl font-semibold">{t}</p>
                <p className="mt-2 text-[15px] leading-relaxed opacity-75">{b}</p>
              </div>
            ))}
            <div className="bg-[var(--as-dark)] text-[var(--as-on-dark)] p-6">
              <p className="font-display text-xl font-semibold">Closing day. Drumroll, please.</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-80">Legal ownership transfers to the buyer. Funds pay off your mortgage, commissions and closing costs, and the rest comes to you by bank check or wire.</p>
            </div>
            <div className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-6">
              <p className="font-display text-xl font-semibold">Possession day. Saying farewell.</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-75">Often the same day as closing, though you may have negotiated extra days. We prepare everything for a seamless handoff.</p>
            </div>
          </div>
        </div>
      </Section>

      {isAgency && (
        <Section id="different">
          <Eyebrow>Selling with {site.brokerage.name}</Eyebrow>
          <Heading>So, what do we do differently?</Heading>
          <Pillars items={PILLARS} />
        </Section>
      )}

      <SellerCta />
    </>
  );
}

function SellerCta() {
  const { site } = useAgentSiteContext();
  const { status, error, submit, guard } = useLandingSubmit("sellers");
  const [f, setF] = useState({ name: "", email: "", phone: "", address: "", timeline: "" });
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const onSubmit = (e) => {
    e.preventDefault();
    submit({ name: f.name, email: f.email, phone: f.phone, address: f.address, details: { timeline: f.timeline } });
  };
  return (
    <Section tone="alt" id="start" className={aboveFooter(site)}>
      <div className="grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <Eyebrow>Ready to sell your home?</Eyebrow>
          <Heading>We can take you there.</Heading>
          <div className="mt-8">
            <AgentCard onDark={false} />
          </div>
        </div>
        <div className="bg-[var(--as-bg)] text-[var(--as-text)] border border-[var(--as-text)]/10 p-7 sm:p-9">
          {status === "sent" ? (
            <div role="status" className="py-6 text-center">
              <p className="font-display text-2xl font-semibold">Got it. Thank you!</p>
              <p className="mt-3 text-[15px] opacity-75">{(site.agent.name || "Your agent").split(" ")[0]} will be in touch shortly to talk about your home.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="relative space-y-4">
              <HoneypotField guard={guard} />
              <p className="font-display text-2xl font-semibold">Request a listing consultation</p>
              <Field label="Your name">
                <input required value={f.name} onChange={set("name")} autoComplete="name" className={inputClass} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Email">
                  <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={inputClass} />
                </Field>
                <Field label="Phone (optional)">
                  <input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" className={inputClass} />
                </Field>
              </div>
              <Field label="Property address (optional)">
                <input value={f.address} onChange={set("address")} autoComplete="street-address" className={inputClass} />
              </Field>
              <div>
                <span className="block text-xs font-medium tracked-wide uppercase mb-2 opacity-65">Thinking of selling…</span>
                <Chips label="When are you thinking of selling" options={SELL_TIMELINES} value={f.timeline} onChange={(v) => setF((cur) => ({ ...cur, timeline: v }))} />
              </div>
              {status === "error" && (
                <p role="alert" className="text-sm text-red-600">
                  {error} You can also call or email {site.agent.name || "your agent"} directly.
                </p>
              )}
              <button type="submit" disabled={status === "sending"} className={`${primaryButton} w-full disabled:opacity-60`}>
                {status === "sending" ? "Sending…" : "Send"}
              </button>
            </form>
          )}
        </div>
      </div>
      <Disclaimer>
        {site.brokerage.name} makes no guarantees regarding the subject property, your ability to sell it, or that any particular sales price will be obtained. This guide is for information only and is not legal, tax or real estate advice; consult a qualified real estate attorney or CPA.
      </Disclaimer>
    </Section>
  );
}
