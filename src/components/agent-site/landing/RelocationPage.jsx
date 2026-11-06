import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { HoneypotField } from "../../../lib/spamGuard";
import SiteLink from "../SiteLink";
import { AgentCard, Chips, ContactLink, Disclaimer, Eyebrow, Field, Heading, Journey, Lead, PageHero, Section, aboveFooter, inputClass, outlineButton, primaryButton } from "./Parts";
import { useLandingSubmit } from "./useLandingSubmit";
import { RELOCATION_FAQ, RELOCATION_PRIORITIES, RELOCATION_REASONS, RELOCATION_STEPS, RELOCATION_WHEN } from "./content";

// /relocation: for clients moving to Oklahoma from somewhere else. The way a move from a distance works, the areas the agent serves, answers to the
// usual questions, and a short "tell me about your move" form that goes to the agent as a lead tagged "Website: Relocation page". An agent turns it on
// in Site Details (agent_sites.landing.relocation.on); see src/lib/landingPages.js.
export default function RelocationPage() {
  const { site } = useAgentSiteContext();
  const first = site.agent.first || "your agent";
  const areas = site.areas || [];

  return (
    <>
      <PageHero
        eyebrow="Moving to Oklahoma"
        title="Moving here? Let's make it easy."
        lead={`A move across the country has a lot of moving parts. ${first} handles the home search, the paperwork and the local know-how, so you can focus on everything else.`}
        photo="/landing/okc-skyline.jpg"
      >
        <a href="#move" className={primaryButton}>
          Tell me about your move
        </a>
        <ContactLink className={`${outlineButton} text-[var(--as-on-dark)]`}>Talk to {first}</ContactLink>
      </PageHero>

      <Section id="how">
        <Eyebrow>How a long-distance move works</Eyebrow>
        <Heading>From your first question to your first night</Heading>
        <Lead>You do not have to be here to get started, or even to get to the closing table. Tap a step to see what happens.</Lead>
        <Journey steps={RELOCATION_STEPS} />
      </Section>

      {areas.length > 0 && (
        <Section tone="alt" id="areas">
          <Eyebrow>Where could you live?</Eyebrow>
          <Heading>Areas I can show you</Heading>
          <Lead>Every area has its own feel. Start with a few and I will help you narrow them down.</Lead>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {areas.map((a) => (
              <SiteLink key={a.slug} slug={site.slug} path={`/areas/${a.slug}`} className="group block bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <p className="font-display text-xl font-semibold">{a.name}</p>
                {a.blurb && <p className="mt-2 text-[15px] leading-relaxed opacity-70">{a.blurb}</p>}
                <p className="mt-3 text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">Explore {a.name} →</p>
              </SiteLink>
            ))}
          </div>
        </Section>
      )}

      <Section tone={areas.length > 0 ? "bg" : "alt"} id="faq">
        <Eyebrow>Questions I hear a lot</Eyebrow>
        <Heading>Relocating, answered</Heading>
        <div className="mt-10 max-w-3xl divide-y divide-[var(--as-text)]/12 border-y border-[var(--as-text)]/12">
          {RELOCATION_FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-display text-xl font-semibold">
                {f.q}
                <span aria-hidden="true" className="mt-1 text-[var(--as-accent)] transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[15.5px] leading-relaxed opacity-75">{f.a}</p>
            </details>
          ))}
        </div>
      </Section>

      <MoveForm />

      <Section tone={areas.length > 0 ? "alt" : "bg"} id="start" className={aboveFooter(site)}>
        <div className="flex flex-wrap items-center justify-between gap-8">
          <div>
            <Eyebrow>Ready when you are</Eyebrow>
            <Heading>Let&rsquo;s talk about your move.</Heading>
          </div>
          <AgentCard onDark={false} />
        </div>
        <Disclaimer>
          {site.brokerage.name} makes no guarantees regarding any property or your ability to purchase it. This page is for information only and is not legal, tax or real estate advice; consult a qualified real estate attorney or CPA.
        </Disclaimer>
      </Section>
    </>
  );
}

function MoveForm() {
  const { site } = useAgentSiteContext();
  const first = site.agent.first || "your agent";
  const { status, error, submit, guard } = useLandingSubmit("relocation");
  const areaNames = (site.areas || []).map((a) => a.name);
  const [f, setF] = useState({ name: "", email: "", phone: "", from: "", when: "", reason: "", areas: [], budget: "", has_home: "", priorities: [] });
  const set = (k) => (e) => setF((cur) => ({ ...cur, [k]: e.target.value }));
  const put = (k) => (v) => setF((cur) => ({ ...cur, [k]: v }));
  const onSubmit = (e) => {
    e.preventDefault();
    const { name, email, phone, ...details } = f;
    submit({ name, email, phone, details });
  };
  const group = "text-xl sm:text-2xl font-display font-semibold";

  return (
    <Section id="move" tone="alt">
      <Eyebrow>Your move</Eyebrow>
      <Heading>Tell me about your move.</Heading>
      <Lead>A few quick answers and {first} will reach out within one business day to talk it through. No obligation.</Lead>
      {status === "sent" ? (
        <div role="status" className="mt-10 bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-10 text-center">
          <p className="font-display text-3xl font-semibold">Thank you! Got it.</p>
          <p className="mt-3 text-[16px] opacity-75">{first} will be in touch within one business day to talk about your move.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="relative mt-10 bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-6 sm:p-10 space-y-9">
          <HoneypotField guard={guard} />
          <div className="grid md:grid-cols-3 gap-5">
            <Field label="Your name">
              <input required value={f.name} onChange={set("name")} autoComplete="name" className={inputClass} />
            </Field>
            <Field label="Email">
              <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={inputClass} />
            </Field>
            <Field label="Phone (optional)">
              <input type="tel" value={f.phone} onChange={set("phone")} autoComplete="tel" className={inputClass} />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <Field label="Where are you moving from?">
              <input value={f.from} onChange={set("from")} placeholder="City and state" className={inputClass} />
            </Field>
            <Field label="Roughly how much do you plan to spend? (optional)">
              <input value={f.budget} onChange={set("budget")} placeholder="A range is fine" className={inputClass} />
            </Field>
          </div>
          <div>
            <p className={`${group} mb-4`}>When are you moving?</p>
            <Chips label="When are you moving" options={RELOCATION_WHEN} value={f.when} onChange={put("when")} />
          </div>
          <div>
            <p className={`${group} mb-4`}>What&rsquo;s bringing you to Oklahoma?</p>
            <Chips label="Reason for moving" options={RELOCATION_REASONS} value={f.reason} onChange={put("reason")} />
          </div>
          {areaNames.length > 0 && (
            <div>
              <p className={group}>Any areas on your mind?</p>
              <p className="mt-1 mb-4 text-sm opacity-60">Pick as many as you like, or skip it and I will help you choose.</p>
              <Chips multiple label="Areas of interest" options={areaNames} value={f.areas} onChange={put("areas")} />
            </div>
          )}
          <div>
            <p className={`${group} mb-4`}>What matters most?</p>
            <Chips multiple label="What matters most" options={RELOCATION_PRIORITIES} value={f.priorities} onChange={put("priorities")} />
          </div>
          <div>
            <p className={`${group} mb-4`}>Do you have a home to sell where you live now?</p>
            <Chips label="Home to sell" options={["Yes", "No", "Not sure yet"]} value={f.has_home} onChange={put("has_home")} />
          </div>
          {status === "error" && (
            <p role="alert" className="text-sm text-red-600">
              {error} You can also call or email {site.agent.name || "your agent"} directly.
            </p>
          )}
          <button type="submit" disabled={status === "sending"} className={`${primaryButton} disabled:opacity-60`}>
            {status === "sending" ? "Sending…" : `Send to ${first}`}
          </button>
        </form>
      )}
    </Section>
  );
}
