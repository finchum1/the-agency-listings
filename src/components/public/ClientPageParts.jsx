import { telHref } from "../../lib/vendors";

// Shared pieces of the pages we send to clients (the vendor list and the seller activity report): a header with a properly sized
// logo, and a footer with the agent's headshot and details like the flyers have. Light page, dark footer.
export function ClientHeader({ brand }) {
  return (
    <header className="bg-white border-b border-black/5">
      <div className="mx-auto max-w-5xl px-5 py-5 sm:py-6 flex items-center">
        {brand.logo ? <img src={brand.logo} alt={brand.name} className="h-12 sm:h-14 w-auto" /> : <span className="font-display text-2xl font-semibold">{brand.name}</span>}
      </div>
    </header>
  );
}

export function AgentFooter({ agent, brand, note }) {
  const address = [brand.address?.line1, brand.address?.city, brand.address?.state, brand.address?.zip].filter(Boolean);
  return (
    <footer className="mt-14 bg-[#1c1a17] text-[#f7f4ee]">
      <div className="mx-auto max-w-5xl px-5 py-9">
        {note && <p className="text-xs tracking-[0.22em] uppercase text-white/50 mb-5">{note}</p>}
        {agent && (
          <div className="flex items-center gap-5">
            {agent.photo_url && <img src={agent.photo_url} alt="" className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover bg-white/10 shrink-0" />}
            <div className="min-w-0">
              <p className="font-display text-2xl sm:text-3xl font-semibold leading-tight">{agent.full_name}</p>
              {agent.title && <p className="text-sm text-white/60 mt-0.5">{[agent.title, brand.name].filter(Boolean).join(" · ")}</p>}
              <div className="mt-2 flex flex-col sm:flex-row sm:flex-wrap sm:gap-x-6 text-[15px]">
                {agent.phone && (
                  <a href={telHref(agent.phone)} className="text-white hover:underline">
                    {agent.phone}
                  </a>
                )}
                {agent.email && (
                  <a href={`mailto:${agent.email}`} className="text-white hover:underline break-all">
                    {agent.email}
                  </a>
                )}
              </div>
              {agent.license && <p className="mt-1 text-xs text-white/45">{agent.license}</p>}
            </div>
          </div>
        )}
        <div className="mt-8 pt-5 border-t border-white/15 text-[11px] leading-relaxed text-white/45">
          {address.length > 0 && <p>{address.join(", ")}</p>}
          {brand.disclaimer && <p className="mt-1">{brand.disclaimer}</p>}
        </div>
      </div>
    </footer>
  );
}
