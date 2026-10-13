import { useState } from "react";

// "Start a project" form for theagency.latchpointstudios.com. Posts to
// Latchpoint Studios' own contact endpoint (the studio site's /api/contact),
// which saves each inquiry to Latchpoint HQ and emails it to the studio. It's
// cross-origin because this app's serverless functions are at Vercel's
// Hobby-plan cap (see api/admin/agents.js), and the studio site already owns
// that pipeline; the endpoint allows this origin explicitly.
// Rendered by MarketingFooter, on the Latchpoint marketing host only.
const ENDPOINT = "https://latchpointstudios.com/api/contact";

// What the visitor is after, mapped onto the endpoint's project types so the
// notification email still reads correctly.
const NEEDS = {
  dashboard: { label: "The dashboard for my office", projectType: "dashboard" },
  agent: { label: "An agent website", projectType: "website" },
  brokerage: { label: "A brokerage website", projectType: "website" },
  property: { label: "Property websites for my listings", projectType: "website" },
  unsure: { label: "Not sure yet", projectType: "other" },
};

const input =
  "w-full rounded-[10px] border border-(--lp-border-strong) bg-transparent px-4 py-3 text-[15px] text-(--lp-text) placeholder:text-(--lp-text-faint) outline-none transition-all duration-300 focus:border-(--lp-ember) focus:ring-4 focus:ring-[#e8623f]/10";
const label = "text-sm font-medium text-(--lp-text)";
const option = "bg-white text-[#16171a] dark:bg-[#161616] dark:text-[#f5f5f4]";

export default function StartProjectSection() {
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    const need = NEEDS[data.need] ?? NEEDS.unsure;

    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          company: data.company,
          projectType: need.projectType,
          source: "theagency.latchpointstudios.com",
          message: `${need.label}\n\n${data.message}`,
          hp: data.website, // honeypot, hidden from real visitors
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      setStatus("success");
      form.reset();
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof TypeError
          ? "We couldn't reach the server. Please email terrence@latchpointstudios.com directly."
          : err.message,
      );
    }
  }

  return (
    <section id="start" className="scroll-mt-28 border-t border-black/5 px-6 py-24 font-geist dark:border-white/10 lg:px-10 lg:py-32">
      <div className="mx-auto max-w-2xl">
        <p className="font-geist-mono text-[11px] uppercase tracking-[0.14em] text-(--lp-text-faint)">Start a project</p>
        <h2 className="mt-3 text-3xl font-medium leading-tight tracking-tight text-(--lp-text) sm:text-4xl">
          Want this for your office?
        </h2>
        <p className="mt-4 text-[15.5px] leading-relaxed text-(--lp-text-muted)">
          Tell us how you work today. We&rsquo;ll reply within a business day with what we&rsquo;d build and what it would
          cost.
        </p>

        {status === "success" ? (
          <div role="status" className="mt-10 flex flex-col items-start gap-3 rounded-[20px] border border-(--lp-border-strong) p-8">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" fill="#e8623f" />
              <path d="M7.5 12.5l3 3 6-6.5" stroke="#08090b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <h3 className="text-lg font-medium text-(--lp-text)">Message received</h3>
            <p className="text-sm leading-relaxed text-(--lp-text-muted)">
              Thanks for reaching out. We&rsquo;ll reply within a business day at the email address you gave us.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="sp-name" className={label}>
                  Name
                </label>
                <input id="sp-name" name="name" type="text" required autoComplete="name" className={input} placeholder="Jordan Reyes" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="sp-email" className={label}>
                  Email
                </label>
                <input id="sp-email" name="email" type="email" required autoComplete="email" className={input} placeholder="jordan@brokerage.com" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <label htmlFor="sp-company" className={label}>
                  Brokerage or team <span className="font-normal text-(--lp-text-faint)">(optional)</span>
                </label>
                <input id="sp-company" name="company" type="text" autoComplete="organization" className={input} placeholder="Reyes Realty Group" />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="sp-need" className={label}>
                  What are you after?
                </label>
                <select id="sp-need" name="need" defaultValue="dashboard" className={input}>
                  {Object.entries(NEEDS).map(([value, n]) => (
                    <option key={value} value={value} className={option}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="sp-message" className={label}>
                Tell us how you work today
              </label>
              <textarea
                id="sp-message"
                name="message"
                required
                rows={5}
                className={`${input} resize-none`}
                placeholder="Where your leads come from, what you track (and where), what your current setup is missing."
              />
            </div>

            {/* Honeypot: off-screen and skipped by keyboards and screen readers. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label htmlFor="sp-website">Website</label>
              <input id="sp-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
            </div>

            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#e8623f] px-6 py-3 text-[15px] font-medium leading-none text-[#08090b] transition-all duration-300 hover:bg-[#f0714f] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {status === "submitting" ? "Sending..." : "Send message"}
              </button>
              {status === "error" && (
                <p role="alert" className="text-sm text-[#c4472a] dark:text-[#f0714f]">
                  {errorMessage}
                </p>
              )}
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
