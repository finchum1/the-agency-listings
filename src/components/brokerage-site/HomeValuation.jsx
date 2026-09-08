import { useState } from "react";
import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

// "What's my home worth?" lead-capture form — collects the property
// address and contact info, and routes it to the brokerage's own inbox
// (see api/contact.js's type:"valuation" branch) for an agent to follow
// up with a real comparative market analysis. Deliberately not an
// instant automated estimate: Repliers' AI-estimate capability is a paid
// add-on not included on the current plan (confirmed against their
// pricing tiers), so a live number isn't something this can honestly
// show yet. This is the same "we'll reach out" pattern most brokerage
// sites actually use for a "home valuation" tool, not a compromise.
export default function HomeValuation({ isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  const [form, setForm] = useState({ address: "", name: "", email: "", phone: "", message: "" });
  // "idle" | "sending" | "sent" | "fallback" | "error"
  const [status, setStatus] = useState("idle");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openMailtoFallback = () => {
    const subject = `Home valuation request: ${form.address}`;
    const body = [
      `Property address: ${form.address}`,
      "",
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      "",
      form.message,
    ].join("\n");
    window.location.href = `mailto:${site.contact.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, type: "valuation" }),
      });
      if (!res.ok) throw new Error("Contact API returned an error");
      setStatus("sent");
      setForm({ address: "", name: "", email: "", phone: "", message: "" });
    } catch (err) {
      console.error(err);
      if (site.contact.email) {
        openMailtoFallback();
        setStatus("fallback");
      } else {
        setStatus("error");
      }
    }
  };

  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
          Home Valuation
        </p>
        <Heading className="text-3xl sm:text-4xl font-display font-semibold mb-4 text-[var(--as-text)]">
          What's Your Home Worth?
        </Heading>
        <p className="text-[var(--as-text)]/70 leading-relaxed mb-10">
          Share your address and we'll put together a real market analysis — no automated guess, an
          actual look at what's selling nearby — and get back to you personally.
        </p>

        <form onSubmit={handleSubmit} className="text-left space-y-4 border border-[var(--as-text)]/10 bg-[var(--as-bg-alt)] p-8 rounded-2xl">
          <div>
            <label className="block text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/50 mb-1.5">
              Property Address
            </label>
            <input
              required
              value={form.address}
              onChange={update("address")}
              placeholder="123 Main St, Edmond, OK 73034"
              className="w-full border border-[var(--as-text)]/10 bg-[var(--as-bg)] px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-lg"
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/50 mb-1.5">
                Name
              </label>
              <input
                required
                value={form.name}
                onChange={update("name")}
                placeholder="Jane Doe"
                className="w-full border border-[var(--as-text)]/10 bg-[var(--as-bg)] px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/50 mb-1.5">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={update("phone")}
                placeholder="(555) 555-5555"
                className="w-full border border-[var(--as-text)]/10 bg-[var(--as-bg)] px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-lg"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/50 mb-1.5">
              Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={update("email")}
              placeholder="jane@email.com"
              className="w-full border border-[var(--as-text)]/10 bg-[var(--as-bg)] px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-medium tracked-wide uppercase text-[var(--as-text)]/50 mb-1.5">
              Anything else? (optional)
            </label>
            <textarea
              rows={3}
              value={form.message}
              onChange={update("message")}
              placeholder="Thinking of selling in the next few months, just curious, etc."
              className="w-full border border-[var(--as-text)]/10 bg-[var(--as-bg)] px-4 py-3 text-sm text-[var(--as-text)] placeholder:text-[var(--as-text)]/40 outline-none rounded-lg"
            />
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full bg-[var(--as-accent)] text-white text-sm font-medium tracked-wide uppercase py-3.5 rounded-full hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Get My Free Valuation"}
          </button>
          {status === "sent" && (
            <p className="text-xs text-center text-[var(--as-accent)]">
              Thanks! We'll be in touch shortly with your home's valuation.
            </p>
          )}
          {status === "fallback" && (
            <p className="text-xs text-center text-[var(--as-text)]/50">
              Opening your email app to send this request…
            </p>
          )}
          {status === "error" && (
            <p className="text-xs text-center text-[var(--as-accent)]">
              Something went wrong — please call {site.contact.phone || "us"} instead.
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
