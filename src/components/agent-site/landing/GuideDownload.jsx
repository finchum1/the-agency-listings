import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { HoneypotField } from "../../../lib/spamGuard";
import { GUIDES } from "../../../lib/guides";
import { Eyebrow, Field, Heading, Lead, Section, inputClass, primaryButton } from "./Parts";
import { useLandingSubmit } from "./useLandingSubmit";

// "Take the guide with you": the page's guide as a real PDF (api/guide-pdf.js). The visitor gives a name and email first; that request goes to the agent
// as an ordinary website inquiry saying which guide (not one of the page-specific kinds: a home value request would promise a valuation and queue a comps
// task), and the download link appears right away. `guide` is a key of GUIDES; `tone` is the band's color.
export default function GuideDownload({ guide, tone = "alt", className = "" }) {
  const { site } = useAgentSiteContext();
  const g = GUIDES[guide];
  const { status, error, submit, guard } = useLandingSubmit(undefined);
  const [f, setF] = useState({ name: "", email: "" });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const first = site.agent.first || "your agent";
  const href = `/api/guide-pdf?site=${encodeURIComponent(site.slug)}&guide=${encodeURIComponent(g.slug)}`;

  const onSubmit = async (e) => {
    e.preventDefault();
    await submit({ name: f.name, email: f.email, message: `Downloaded the ${g.noun} (PDF) from your website.`, guide: g.slug });
  };

  return (
    <Section tone={tone} id="guide" className={className}>
      <div className="grid gap-10 lg:grid-cols-[1fr_minmax(0,28rem)] lg:items-center">
        <div>
          <Eyebrow>Free download</Eyebrow>
          <Heading>Take {g.title.replace(/^The /, "the ").replace("What's Your Home Worth?", "the home value guide")} with you.</Heading>
          <Lead>A printable guide with each step in plain language, from {first}. Read it on your own time, or share it with the people you are moving with.</Lead>
        </div>
        {status === "sent" ? (
          <div role="status" className="border border-[var(--as-text)]/10 bg-[var(--as-bg-alt)] p-8 text-center">
            <p className="font-display text-2xl font-semibold">Here it is. Thank you!</p>
            <a href={href} className={`${primaryButton} mt-5`} download>
              Download the PDF
            </a>
            <p className="mt-4 text-sm opacity-60">We also emailed it to you. {first} has been let know and may follow up.</p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="relative space-y-4 border border-[var(--as-text)]/10 bg-[var(--as-bg-alt)] p-6 sm:p-8">
            <HoneypotField guard={guard} />
            <Field label="Your name">
              <input required value={f.name} onChange={set("name")} autoComplete="name" className={inputClass} />
            </Field>
            <Field label="Email">
              <input required type="email" value={f.email} onChange={set("email")} autoComplete="email" className={inputClass} />
            </Field>
            {status === "error" && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}
            <button type="submit" disabled={status === "sending"} className={`${primaryButton} w-full disabled:opacity-60`}>
              {status === "sending" ? "One moment…" : "Get the free guide"}
            </button>
            <p className="text-xs opacity-55">{first} will receive your name and email and may reach out. No spam.</p>
          </form>
        )}
      </div>
    </Section>
  );
}
