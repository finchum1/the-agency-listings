import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import { HoneypotField } from "../../../lib/spamGuard";
import SiteLink from "../SiteLink";
import SoldHomes from "../SoldHomes";
import { Chips, Eyebrow, Field, Heading, Section, inputClass, primaryButton } from "./Parts";
import { useLandingSubmit } from "./useLandingSubmit";
import { CONDITIONS, SELL_TIMELINES } from "./content";

const HOW = [
  { title: "You tell me about your home", body: "Just the address to start. A few details help me get closer." },
  { title: "I pull the comparables", body: "Recent sales of homes like yours, adjusted for what makes yours different." },
  { title: "We talk it through", body: "You get your number and an honest plan: sell now, prep first, or wait." },
];

// /home-value: a lead capture. A short three-step form (address, a few details and contact info, thank-you) that goes to the agent, who pulls
// the comparables and follows up. The promise on the page ("within one business day") is the agent's, so keep it in step with the confirmation
// email in api/agent-site-contact.js.
export default function HomeValuePage() {
  const { site } = useAgentSiteContext();
  const first = (site.agent.name || "").split(" ")[0] || "Your agent";
  const quote = site.testimonials[0];

  return (
    <>
      <section className="relative overflow-hidden bg-[var(--as-dark)] text-[var(--as-on-dark)]">
        <img src="/landing/kitchen.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--as-dark)] via-[var(--as-dark)]/85 to-[var(--as-dark)]/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-6xl px-6 lg:px-10 py-20 sm:py-28 grid lg:grid-cols-[1fr_460px] gap-12 items-center">
          <div>
            <Eyebrow onDark>Free home valuation</Eyebrow>
            <Heading as="h1" className="!text-4xl sm:!text-6xl">
              What&rsquo;s your home worth?
            </Heading>
            <p className="mt-5 text-lg sm:text-xl leading-relaxed opacity-80 max-w-xl">
              Tell me about your home and I&rsquo;ll pull real comparable sales and send you a custom valuation within one business day. A person, not a robot estimate.
            </p>
            <div className="mt-8 flex items-center gap-4">
              {site.agent.photo && <img src={site.agent.photo} alt="" className="h-16 w-16 rounded-full object-cover bg-[var(--as-surface)]" />}
              <p className="text-[15px] leading-snug">
                {site.agent.name}
                <span className="block opacity-65">{[site.brokerage.name, site.agent.phone].filter(Boolean).join(" · ")}</span>
              </p>
            </div>
          </div>
          <ValueForm />
        </div>
      </section>

      <Section id="how">
        <div className="text-center max-w-xl mx-auto">
          <Eyebrow>How it works</Eyebrow>
          <Heading>A real person, a real answer</Heading>
        </div>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {HOW.map((h, i) => (
            <div key={h.title} className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-8">
              <p className="font-display text-5xl font-semibold text-[var(--as-accent)]">{i + 1}</p>
              <p className="mt-2 font-display text-2xl font-semibold">{h.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed opacity-75">{h.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {site.sales.length > 0 && <SoldHomes limit={3} />}

      {quote && (
        <Section tone="alt" id="quote">
          <div className="max-w-3xl mx-auto text-center">
            <div className="font-display text-2xl sm:text-3xl leading-snug italic">
              &ldquo;
              <span className="rich-text [&>*]:inline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(quote.quote) }} />
              &rdquo;
            </div>
            <p className="mt-4 text-xs tracked-wide uppercase opacity-55">{quote.author}</p>
          </div>
        </Section>
      )}

      <Section tone="dark" id="privacy">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <p className="max-w-xl text-[15px] leading-relaxed opacity-75">
            Your information goes to {first} and no one else. This is a request for a valuation, not an appraisal.
          </p>
          <SiteLink slug={site.slug} path="/sellers" className="text-sm underline underline-offset-4 opacity-85 hover:opacity-100">
            Thinking of selling? Read the seller&rsquo;s guide
          </SiteLink>
        </div>
      </Section>
    </>
  );
}

function ValueForm() {
  const { site } = useAgentSiteContext();
  const { status, error, submit, guard } = useLandingSubmit("home_value");
  // An address typed on the home page card arrives in the address bar and skips the first step.
  const [params] = useSearchParams();
  const fromCard = (params.get("address") || "").slice(0, 200);
  const [step, setStep] = useState(fromCard ? 2 : 1);
  const [f, setF] = useState({ address: fromCard, beds: "", baths: "", sqft: "", condition: "", timeline: "", name: "", email: "", phone: "" });
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const first = (site.agent.name || "").split(" ")[0] || "Your agent";

  const send = async (e) => {
    e.preventDefault();
    const { name, email, phone, address, ...details } = f;
    if (await submit({ name, email, phone, address, details })) setStep(3);
  };
  const bar = (n) => <div className={`h-1 flex-1 ${step >= n ? "bg-[var(--as-accent)]" : "bg-[var(--as-text)]/15"}`} />;

  return (
    <div className="bg-[var(--as-bg)] text-[var(--as-text)] p-7 sm:p-9 shadow-2xl">
      <div className="flex items-center gap-2 mb-6">
        {bar(1)}
        {bar(2)}
        {bar(3)}
        <span className="ml-2 text-xs tracked-wide uppercase opacity-55 whitespace-nowrap">Step {step} of 3</span>
      </div>

      {step === 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (f.address.trim()) setStep(2);
          }}
          className="space-y-5"
        >
          <p className="font-display text-3xl font-semibold">Where&rsquo;s the home?</p>
          <Field label="Property address">
            <input required autoFocus value={f.address} onChange={set("address")} autoComplete="street-address" placeholder="123 Main Street, Edmond" className={`${inputClass} !text-base !py-4`} />
          </Field>
          <button type="submit" className={`${primaryButton} w-full`}>
            Continue
          </button>
          <p className="text-center text-sm opacity-55">Takes about a minute. No obligation.</p>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={send} className="relative space-y-4">
          <HoneypotField guard={guard} />
          <div>
            <p className="font-display text-3xl font-semibold">A little about it</p>
            <p className="mt-1 text-sm opacity-60">{f.address}</p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Beds">
              <input inputMode="numeric" value={f.beds} onChange={set("beds")} className={inputClass} />
            </Field>
            <Field label="Baths">
              <input inputMode="decimal" value={f.baths} onChange={set("baths")} className={inputClass} />
            </Field>
            <Field label="Sq ft">
              <input inputMode="numeric" value={f.sqft} onChange={set("sqft")} className={inputClass} />
            </Field>
          </div>
          <div>
            <span className="block text-xs font-medium tracked-wide uppercase mb-2 opacity-65">Condition</span>
            <Chips label="Condition" options={CONDITIONS} value={f.condition} onChange={(v) => setF((cur) => ({ ...cur, condition: v }))} />
          </div>
          <div>
            <span className="block text-xs font-medium tracked-wide uppercase mb-2 opacity-65">Thinking of selling…</span>
            <Chips label="When are you thinking of selling" options={SELL_TIMELINES} value={f.timeline} onChange={(v) => setF((cur) => ({ ...cur, timeline: v }))} />
          </div>
          <Field label="Your name">
            <input required value={f.name} onChange={set("name")} autoComplete="name" className={inputClass} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Email">
              <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Phone (optional)">
              <input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" className={inputClass} />
            </Field>
          </div>
          {status === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {error} You can also call or email {site.agent.name || "your agent"} directly.
            </p>
          )}
          <button type="submit" disabled={status === "sending"} className={`${primaryButton} w-full disabled:opacity-60`}>
            {status === "sending" ? "Sending…" : "Get my valuation"}
          </button>
          <button type="button" onClick={() => setStep(1)} className="w-full text-sm opacity-60 hover:opacity-100">
            ← Back
          </button>
        </form>
      )}

      {step === 3 && (
        <div role="status" className="text-center py-4">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-[#2f7d4f] text-white text-3xl" aria-hidden="true">
            ✓
          </div>
          <p className="mt-5 font-display text-3xl font-semibold">Got it. Thank you!</p>
          <p className="mt-3 text-[16px] leading-relaxed opacity-75">
            {first} will pull comparables for {f.address} and be in touch within one business day.
          </p>
          <p className="mt-6 text-sm opacity-60">While you wait, here&rsquo;s how selling works:</p>
          <SiteLink slug={site.slug} path="/sellers" className="mt-3 inline-block border border-current px-6 py-3 text-xs font-medium tracked-wide uppercase">
            Read the seller&rsquo;s guide
          </SiteLink>
        </div>
      )}
    </div>
  );
}
