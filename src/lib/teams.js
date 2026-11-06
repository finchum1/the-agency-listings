// Agent teams (supabase/agent-teams.sql): agents who share a team name, e.g. "Petry Signature Team". Each keeps their own profile and
// listings; a team just means the listing's property site, flyer, social post and inquiry emails show everyone on it.

// Added to a profile select so one query brings back the agent's team and everyone on it: `agent:profiles(*, ${TEAM_EMBED})`.
export const TEAM_EMBED = "team:teams(id, name, members:profiles(id, full_name, title, license, phone, email, photo_url))";

const person = (p) => ({
  id: p.id || "",
  name: p.full_name || "",
  title: p.title || "Real Estate Agent",
  license: p.license || "",
  phone: p.phone || "",
  email: p.email || "",
  photo: p.photo_url || "",
});

// The ids of everyone whose listings a team site shows: the site owner and the rest of their team (just the owner when they aren't on one).
export function teamAgentIds(agent, fallbackId) {
  const ids = (agent?.team?.members || []).map((m) => m.id).filter(Boolean);
  const own = agent?.id || fallbackId;
  return [...new Set([own, ...ids].filter(Boolean))];
}

// The team a profile row (loaded with TEAM_EMBED) belongs to, as { name, members }, the row's own person first and the others by name.
// Null when they aren't on a team, or `show` is false (a listing set to show only its own agent).
export function adaptTeam(agent, show = true) {
  const team = agent?.team;
  if (!show || !team?.name) return null;
  const members = (team.members || []).map(person);
  const mine = members.filter((m) => m.id === agent.id);
  const others = members.filter((m) => m.id !== agent.id).sort((a, b) => a.name.localeCompare(b.name));
  // The agent's own row is always included, even if the member list somehow came back without it.
  const list = [...(mine.length ? mine : [person(agent)]), ...others];
  return { name: team.name, members: list };
}
