import { useBrokerageSiteContext } from "../../context/BrokerageSiteContext";

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Grid of the full roster — same shape as the-agency-oklahoma's
// /agents page (dark header band, initials-or-photo card, specialty
// tags, license #), which is the reference this whole module was built
// against. `preview` caps the list and adds a "Meet the team" link, for
// use on Home; the standalone /brokerage/agents page shows everyone.
export default function AgentRoster({ preview = false, isStandalonePage = false }) {
  const { site } = useBrokerageSiteContext();
  const agents = preview ? site.agents.slice(0, 6) : site.agents;
  if (agents.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";

  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <div className="text-center mb-14">
          <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3">Our Team</p>
          <Heading className="text-3xl sm:text-4xl font-display font-semibold text-[var(--as-text)]">
            Meet The Agents
          </Heading>
          <p className="mx-auto mt-4 max-w-xl text-[var(--as-text)]/60">
            {site.agents.length} licensed agent{site.agents.length === 1 ? "" : "s"} serving Oklahoma City,
            Edmond, and the surrounding metro.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="group border border-[var(--as-text)]/10 p-6 bg-[var(--as-bg)]">
              <div className="flex aspect-square w-20 items-center justify-center overflow-hidden bg-[var(--as-dark)] font-display text-2xl text-[var(--as-on-dark)]">
                {agent.photo_url ? (
                  <img src={agent.photo_url} alt={agent.name} className="h-full w-full object-cover" />
                ) : (
                  initials(agent.name)
                )}
              </div>
              <div className="mt-5">
                <h3 className="font-display text-xl text-[var(--as-text)]">{agent.name}</h3>
                {agent.title && (
                  <p className="mt-1 text-xs uppercase tracked text-[var(--as-text)]/60">{agent.title}</p>
                )}
                {agent.bio && <p className="mt-3 text-sm leading-relaxed text-[var(--as-text)]/70">{agent.bio}</p>}
                {agent.specialties?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agent.specialties.map((tag) => (
                      <span key={tag} className="border border-[var(--as-text)]/10 px-2 py-1 text-[10px] uppercase tracked text-[var(--as-text)]/60">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {agent.license && (
                  <p className="mt-4 text-[11px] uppercase tracked text-[var(--as-text)]/40">OK License #{agent.license}</p>
                )}
                {(agent.phone || agent.email) && (
                  <a
                    href={agent.phone ? `tel:${agent.phone}` : `mailto:${agent.email}`}
                    className="mt-2 inline-block text-xs font-medium uppercase tracked text-[var(--as-accent)] hover:underline"
                  >
                    Contact {agent.name.split(" ")[0]} &rarr;
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {preview && site.agents.length > agents.length && (
          <div className="mt-14 flex justify-center">
            <a
              href="/brokerage/agents"
              className="border border-[var(--as-text)]/20 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
            >
              Meet The Full Team
            </a>
          </div>
        )}
      </div>
    </section>
  );
}
