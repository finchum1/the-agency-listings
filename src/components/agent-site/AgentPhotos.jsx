// The agent's portrait, or the whole team's side by side, filling the box it sits in. A team with at least two photos gets a row of portraits and a
// wider box (teamAspect), so each person keeps a tall crop; everyone else gets the one photo as before.
const photosOf = (site) => (site.team?.members || []).filter((m) => m.photo);

// The box shape for a team portrait row, or "" for a single portrait (the layout then uses its own shape).
export function teamAspect(site) {
  const n = photosOf(site).length;
  if (n >= 3) return "aspect-[3/2]";
  if (n === 2) return "aspect-[5/4]";
  return "";
}

export default function AgentPhotos({ site, className = "h-full w-full object-cover", fallback = "" }) {
  const people = photosOf(site);
  if (people.length >= 2) {
    return (
      <div className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${Math.min(people.length, 4)}, minmax(0, 1fr))` }}>
        {people.map((m) => (
          <img key={m.id || m.email} src={m.photo} alt={m.name} className="h-full w-full min-h-0 object-cover object-top" loading="lazy" />
        ))}
      </div>
    );
  }
  const src = site.agent.photo || fallback;
  return src ? <img src={src} alt={site.agent.name} className={className} /> : null;
}
