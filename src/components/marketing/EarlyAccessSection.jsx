import { useState } from "react";
import { Reveal } from "./motion";
import { isMarketingHost } from "../../lib/appHosts";
import { contactMailto } from "../../lib/marketingContact";

// "Request early access" form, the last section of the landing page on theagency.latchpointstudios.com. Posts to
// Latchpoint Studios' own contact endpoint (the studio site's /api/contact), which saves each request to Latchpoint HQ
// and emails it to the studio, and sends the visitor a confirmation. It is cross-origin because the studio site already
// owns that pipeline; the endpoint allows this origin explicitly. On any other host (the endpoint would refuse it) the
// section is an email link instead.
const ENDPOINT = "https://latchpointstudios.com/api/contact";

const ROLES = ["Agent at The Agency", "Team lead", "Office owner or manager", "Something else"];
const SIZES = ["Just me", "2 to 5 agents", "6 to 20 agents", "21 to 50 agents", "More than 50"];

const input =
  "w-full rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1b1b1b] px-4 py-3 text-[15px] text-[#1c1a17] dark:text-[#faf9f7] placeholder:text-[#1c1a17]/35 dark:placeholder:text-[#faf9f7]/35 outline-none transition-all focus:border-[#ed2127] focus:ring-4 focus:ring-[#ed2127]/10";
const label = "text-sm font-medium text-[#1c1a17] dark:text-[#faf9f7]";

export default function EarlyAccessSection() {
  const live = isMarketingHost(window.location.hostname);
  const [status, setStatus] = useState("idle"); // idle | submitting | success | error
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("submitting");
    setErrorMessage("");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    try {
      const res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          company: data.company,
          projectType: "early-access",
          source: "theagency.latchpointstudios.com/early-access",
          hp: data.website, // honeypot, hidden from real visitors
          message: [`Role: ${data.role}`, `Size: ${data.size}`, data.tools && `Uses today: ${data.tools}`, data.notes && `Wants most: ${data.notes}`]
            .filter(Boolean)
            .join("\n"),
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
        err instanceof TypeError ? "We couldn't reach the server. Please email terrence@latchpointstudios.com directly." : err.message,
      );
    }
  }

  return (
    <section id="early-access" className="scroll-mt-28 px-6 pb-24 lg:px-10">
      <Reveal>
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl border border-black/5 bg-white px-6 py-14 shadow-xl shadow-black/5 dark:border-white/10 dark:bg-[#161616] sm:px-14 sm:py-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ed2127]/10 blur-[100px]" />
          <div className="relative grid grid-cols-1 gap-12 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider-plus text-[#ed2127]">Early access</p>
              <h2 className="mt-3 text-3xl font-display font-semibold leading-tight sm:text-4xl">Get on the list.</h2>
              <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-[#1c1a17]/70 dark:text-[#faf9f7]/70">
                We&rsquo;re bringing Agency agents and offices in a few at a time. Tell us who you are and we&rsquo;ll reach out to
                set up a short call. Asking costs nothing.
              </p>
              <p className="mt-6 text-sm text-[#1c1a17]/70 dark:text-[#faf9f7]/70">
                Prefer to ask directly?{" "}
                <a href="mailto:terrence@latchpointstudios.com" className="font-medium text-[#1c1a17] underline decoration-[#ed2127]/40 underline-offset-4 hover:decoration-[#ed2127] dark:text-[#faf9f7]">
                  terrence@latchpointstudios.com
                </a>
              </p>
            </div>

            <div className="lg:col-span-7">
              {!live ? (
                <a
                  href={contactMailto("Interested in the dashboard")}
                  className="inline-flex rounded-full bg-[#ed2127] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#d41b21]"
                >
                  Email us to get started
                </a>
              ) : status === "success" ? (
                <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-black/10 p-8 dark:border-white/15">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" fill="#ed2127" />
                    <path d="M7.5 12.5l3 3 6-6.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <h3 className="text-lg font-display font-semibold">You&rsquo;re on the list</h3>
                  <p className="text-sm leading-relaxed text-[#1c1a17]/70 dark:text-[#faf9f7]/70">
                    Thanks. We&rsquo;re inviting people in a few at a time, by hand. We&rsquo;ll email you to set up a short call when
                    there&rsquo;s a spot, and you&rsquo;ll get a confirmation at the address you gave us now.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 text-left">
                  <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                    <label htmlFor="ea-website">Website</label>
                    <input id="ea-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-name" className={label}>Name</label>
                      <input id="ea-name" name="name" type="text" required autoComplete="name" className={input} placeholder="Jordan Reyes" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-email" className={label}>Email</label>
                      <input id="ea-email" name="email" type="email" required autoComplete="email" className={input} placeholder="jordan@theagencyre.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-role" className={label}>I&rsquo;m an</label>
                      <select id="ea-role" name="role" defaultValue={ROLES[0]} className={input}>
                        {ROLES.map((r) => (<option key={r} value={r}>{r}</option>))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-size" className={label}>Agents, including you</label>
                      <select id="ea-size" name="size" defaultValue={SIZES[0]} className={input}>
                        {SIZES.map((s) => (<option key={s} value={s}>{s}</option>))}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-company" className={label}>
                        Office or team <span className="font-normal text-[#1c1a17]/40 dark:text-[#faf9f7]/40">(optional)</span>
                      </label>
                      <input id="ea-company" name="company" type="text" autoComplete="organization" className={input} placeholder="Your office" />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="ea-tools" className={label}>
                        What do you use today? <span className="font-normal text-[#1c1a17]/40 dark:text-[#faf9f7]/40">(optional)</span>
                      </label>
                      <input id="ea-tools" name="tools" type="text" className={input} placeholder="A site, a CRM, spreadsheets..." />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="ea-notes" className={label}>
                      What would you want it to do for you? <span className="font-normal text-[#1c1a17]/40 dark:text-[#faf9f7]/40">(optional)</span>
                    </label>
                    <textarea id="ea-notes" name="notes" rows={3} className={`${input} resize-none`} />
                  </div>
                  <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <button
                      type="submit"
                      disabled={status === "submitting"}
                      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full bg-[#ed2127] px-7 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#d41b21] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {status === "submitting" ? "Sending..." : "Request early access"}
                    </button>
                    {status === "error" && (
                      <p role="alert" className="text-sm text-[#c4272b]">{errorMessage}</p>
                    )}
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
