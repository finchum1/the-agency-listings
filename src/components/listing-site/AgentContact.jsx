import { useState } from "react";
import { useListingContext } from "../../context/ListingContext";

export default function AgentContact() {
  const { listing, listingId } = useListingContext();
  const { agent, address, brokerage } = listing;
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  // "idle" | "sending" | "sent" | "fallback" | "error"
  const [status, setStatus] = useState("idle");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const openMailtoFallback = () => {
    const subject = `Inquiry about ${address.line1}`;
    const body = [
      `Name: ${form.name}`,
      `Email: ${form.email}`,
      `Phone: ${form.phone}`,
      "",
      form.message,
    ].join("\n");
    window.location.href = `mailto:${agent.email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      // listingId (not a client-supplied email) is what the API uses to look
      // up who to notify server-side — see api/contact.js.
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, listingId }),
      });
      if (!res.ok) throw new Error("Contact API returned an error");
      setStatus("sent");
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err) {
      // Backend isn't configured yet (or the request failed) — fall back to
      // opening a pre-filled email so the lead isn't lost.
      console.error(err);
      openMailtoFallback();
      setStatus("fallback");
    }
  };

  return (
    <section id="contact" className="px-6 lg:px-10 py-24">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-2 gap-14 items-start">
        <div>
          <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#8a7a5c] mb-3">
            Contact
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold mb-6">
            Interested in {address.line1}?
          </h2>
          <p className="text-[#1c1a17]/70 leading-relaxed mb-8 max-w-md text-[15.5px]">
            Reach out to schedule a private showing or ask any questions about
            the property — we're happy to help.
          </p>

          <div className="flex items-center gap-4 bg-white border border-black/5 rounded-2xl p-5">
            <img
              src={agent.photo}
              alt={agent.name}
              className="h-16 w-16 rounded-full object-cover bg-black/5"
            />
            <div>
              <p className="font-semibold">{agent.name}</p>
              <p className="text-sm text-[#1c1a17]/60">{agent.title}</p>
              <p className="text-sm text-[#1c1a17]/60">
                {brokerage.name} — {agent.license}
              </p>
              <div className="flex flex-col gap-0.5 mt-1 text-sm">
                <a href={`tel:${agent.phone}`} className="text-[#8a7a5c] hover:underline">
                  {agent.phone}
                </a>
                <a href={`mailto:${agent.email}`} className="text-[#8a7a5c] hover:underline">
                  {agent.email}
                </a>
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white border border-black/5 rounded-2xl p-8 space-y-5"
        >
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                Name
              </label>
              <input
                required
                value={form.name}
                onChange={update("name")}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
                Phone
              </label>
              <input
                value={form.phone}
                onChange={update("phone")}
                className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
                placeholder="(555) 555-5555"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
              Email
            </label>
            <input
              required
              type="email"
              value={form.email}
              onChange={update("email")}
              className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
              placeholder="jane@email.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#1c1a17]/60 mb-1.5">
              Message
            </label>
            <textarea
              rows={4}
              value={form.message}
              onChange={update("message")}
              className="w-full rounded-lg border border-black/10 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#8a7a5c]/40"
              placeholder={`I'd like to schedule a tour of ${address.line1}...`}
            />
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded-full bg-[#1c1a17] text-white text-sm font-semibold py-3 hover:bg-[#1c1a17]/90 transition-colors disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Send Inquiry"}
          </button>
          {status === "sent" && (
            <p className="text-xs text-center text-emerald-700">
              Thanks! Your message has been sent — we'll be in touch shortly.
            </p>
          )}
          {status === "fallback" && (
            <p className="text-xs text-center text-[#1c1a17]/50">
              Opening your email app to send this message…
            </p>
          )}
        </form>
      </div>
    </section>
  );
}
