import { useListingContext } from "../../context/ListingContext";

export default function Footer() {
  const { listing } = useListingContext();
  const { agent, brand, brokerage } = listing;
  const year = new Date().getFullYear();

  return (
    <footer className="bg-[#1c1a17] text-white/70 px-6 lg:px-10 py-14">
      <div className="mx-auto max-w-6xl">
        <div className="grid sm:grid-cols-3 gap-10 text-sm items-start">
          <div>
            <img
              src={brokerage.logo}
              alt={brokerage.name}
              className="h-14 sm:h-16 w-auto mb-3"
            />
            <p>{brokerage.address.line1}</p>
            <p>
              {brokerage.address.city}, {brokerage.address.state}{" "}
              {brokerage.address.zip}
            </p>
          </div>

          <div>
            <p className="text-white/90 font-medium mb-2">Listing Agent</p>
            <p>{agent.name}</p>
            <p>
              {brokerage.name} — {agent.license}
            </p>
            <p>{agent.phone}</p>
            <p>{agent.email}</p>
          </div>

          <div className="sm:text-right flex sm:flex-col sm:items-end justify-between">
            <div className="flex items-center gap-2 text-white/60">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">Equal Housing Opportunity</span>
            </div>
            <p className="text-xs text-white/40 mt-3 max-w-xs">
              © {year} {brand.tagline}. All information deemed reliable but not
              guaranteed.
            </p>
          </div>
        </div>

        <p className="mt-10 pt-6 border-t border-white/10 text-xs text-white/40">
          {brokerage.name} — {brokerage.disclaimer}
        </p>
      </div>
    </footer>
  );
}
