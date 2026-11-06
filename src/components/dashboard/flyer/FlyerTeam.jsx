// The agent block of a flyer when the listing's agent is on a team: the team's name over each person side by side, in the same footer space the
// single agent uses. `tone` is "light" (dark text, for the white footers) or "dark" (white text, for the dark flyer).
export default function FlyerTeam({ team, tone = "light" }) {
  const dark = tone === "dark";
  const strong = dark ? "text-white" : "text-[#1c1a17]";
  const soft = dark ? "text-white/80" : "text-[#1c1a17]/70";
  const faint = dark ? "text-white/45" : "text-[#1c1a17]/45";
  return (
    <div className="min-w-0">
      <p className={`mb-1.5 text-[9px] font-semibold uppercase tracking-[0.2em] ${faint}`}>{team.name}</p>
      <div className="flex items-start gap-5">
        {team.members.map((m) => (
          <div key={m.id || m.email} className="flex min-w-0 items-center gap-2.5">
            {m.photo && <img src={m.photo} alt="" className={`h-[0.7in] w-[0.7in] shrink-0 rounded-full object-cover ${dark ? "bg-white/10" : "bg-black/5"}`} />}
            <div className="min-w-0">
              <p className={`font-display text-[15px] font-semibold leading-tight ${strong}`}>{m.name}</p>
              <p className={`mt-0.5 text-[11px] ${soft}`}>{m.phone}</p>
              <p className={`text-[11px] ${soft}`}>{m.email}</p>
              {m.license && <p className={`mt-0.5 text-[9px] ${faint}`}>{m.license}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
