import { useState } from "react";
import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Contact() {
  const { site, siteId } = useAgentSiteContext();
  const { agent } = site;
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  // "idle" | "sending" | "sent" | "fallback" | "error"
  const [status, setStatus] = useState("idle");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openMailtoFallback = () => {
    const body = [`Name: ${form.name}`, `Email: ${form.email}`, `Phone: ${form.phone}`, "", form.message].join(
      "\n",
    );
    window.location.href = `mailto:${agent.email}?subject=${encodeURIComponent(
      `Inquiry from ${form.name}`,
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/agent-site-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, agentSiteId: siteId }),
      });
      if (!res.ok) throw new Error("Contact API returned an error");
      setStatus("sent");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      console.error(err);
      openMailtoFallback();
      setStatus("fallback");
    }
  };

  const inputClass =
    "w-full border border-[var(--as-text)]/15 px-3.5 py-2.5 text-sm bg-[var(--as-bg-alt)] text-[var(--as-text)] focus:outline-none focus:border-[var(--as-accent)] focus:ring-2 focus:ring-[var(--as-accent)]/25 transition";

  return (
    <section id="contact" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">
            Let&rsquo;s Connect
          </p>
          <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-6 text-[var(--as-text)]">
            Get In Touch
          </h2>
          <p className="text-[var(--as-text)]/70 leading-relaxed mb-8 max-w-md text-[15.5px]">
            Whether you&rsquo;re buying, selling, or just curious about the market, reach out anytime.
          </p>

          <div className="flex items-center gap-4 bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-5">
            {agent.photo && (
              <img
                src={agent.photo}
                alt={agent.name}
                className="h-16 w-16 object-cover bg-[var(--as-surface)]"
              />
            )}
            <div>
              <p className="font-semibold text-[var(--as-text)]">{agent.name}</p>
              <p className="text-sm text-[var(--as-text)]/60">{agent.title}</p>
              <p className="text-sm text-[var(--as-text)]/60">
                {site.brokerage.name}
                {agent.license ? ` — ${agent.license}` : ""}
              </p>
              <div className="flex flex-col gap-0.5 mt-1 text-sm">
                {agent.phone && (
                  <a href={`tel:${agent.phone}`} className="text-[var(--as-accent)] hover:underline">
                    {agent.phone}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="text-[var(--as-accent)] hover:underline">
                    {agent.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 p-8 space-y-5">
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium tracked uppercase text-[var(--as-text)]/60 mb-1.5">
                Name
              </label>
              <input required value={form.name} onChange={update("name")} className={inputClass} />
            </div>
            <div>
              <label className="block text-xs font-medium tracked uppercase text-[var(--as-text)]/60 mb-1.5">
                Phone
              </label>
              <input value={form.phone} onChange={update("phone")} className={inputClass} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium tracked uppercase text-[var(--as-text)]/60 mb-1.5">
              Email
            </label>
            <input required type="email" value={form.email} onChange={update("email")} className={inputClass} />
          </div>
          <div>
            <label className="block text-xs font-medium tracked uppercase text-[var(--as-text)]/60 mb-1.5">
              Message
            </label>
            <textarea rows={4} value={form.message} onChange={update("message")} className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full bg-[var(--as-accent)] text-white text-xs font-medium tracked-wide uppercase py-4 transition duration-150 hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100"
          >
            {status === "sending" ? "Sending…" : "Send Message"}
          </button>
          {status === "sent" && (
            <p className="text-xs text-center text-emerald-600">
              Thanks! Your message has been sent — we&rsquo;ll be in touch shortly.
            </p>
          )}
          {status === "fallback" && (
            <p className="text-xs text-center text-[var(--as-text)]/50">
              Opening your email app to send this message…
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
