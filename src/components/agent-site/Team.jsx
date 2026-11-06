import { useAgentSiteContext } from "../../context/AgentSiteContext";

// "Meet the team": everyone on the agent's team (supabase/agent-teams.sql), shown as a row of portrait cards. Nothing at all for an agent who isn't
// on a team, so it is safe to leave in the home sections. Add it from the site editor's Home sections list.
export default function Team() {
  const { site } = useAgentSiteContext();
  const team = site.team;
  if (!team || team.members.length < 2) return null;

  return (
    <section id="team" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)]">
      <div className="mx-auto max-w-5xl">
        <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] mb-3 text-center">Meet the team</p>
        <h2 className="text-3xl sm:text-4xl font-display font-semibold mb-12 text-center text-[var(--as-text)]">{team.name}</h2>

        <div className={`grid gap-8 justify-center ${team.members.length === 2 ? "sm:grid-cols-2 max-w-3xl mx-auto" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {team.members.map((m) => (
            <div key={m.id || m.email} className="text-center">
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[4/5] mb-5">
                {m.photo && <img src={m.photo} alt={m.name} className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <p className="text-xl font-display font-semibold text-[var(--as-text)]">{m.name}</p>
              <p className="mt-1 text-sm text-[var(--as-text)]/60">{m.title}</p>
              {m.license && <p className="text-xs text-[var(--as-text)]/45">{m.license}</p>}
              <div className="mt-3 flex flex-col gap-0.5 text-sm">
                {m.phone && (
                  <a href={`tel:${m.phone}`} className="text-[var(--as-accent)] hover:underline">
                    {m.phone}
                  </a>
                )}
                {m.email && (
                  <a href={`mailto:${m.email}`} className="text-[var(--as-accent)] hover:underline break-all">
                    {m.email}
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
