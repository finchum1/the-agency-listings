import { useAgentSiteContext } from "../../context/AgentSiteContext";

export default function Testimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;

  return (
    <section className="bg-[#1c1a17] text-white px-6 lg:px-10 py-24">
      <div className="mx-auto max-w-6xl">
        <p className="text-xs font-semibold tracking-wider-plus uppercase text-[#8a7a5c] mb-10 text-center">
          Testimonials
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {site.testimonials.map((t) => (
            <div key={t.id}>
              <p className="font-display text-lg leading-snug text-white/90">&ldquo;{t.quote}&rdquo;</p>
              <p className="text-xs tracking-wider-plus uppercase text-white/50 mt-4">— {t.author}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
