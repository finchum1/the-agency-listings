import { useState } from "react";
import UpcomingListingsSection from "./UpcomingListingsSection";
import BuyerNeedsSection from "./BuyerNeedsSection";

const VIEWS = [
  { value: "all", label: "Show All" },
  { value: "listings", label: "Listings" },
  { value: "buyers", label: "Buyers" },
];

// One combined dashboard module for the two related office tools —
// previously two separate nav tabs/routes, now one "Upcoming" tab with a
// Show All/Listings/Buyers toggle. Each section (UpcomingListingsSection,
// BuyerNeedsSection) still owns its own data, form, and filter state
// entirely independently — this component only controls which section(s)
// are mounted, nothing about how either one works internally.
export default function UpcomingModule() {
  const [view, setView] = useState("all");

  return (
    <div>
      <div className="mb-2">
        <h1 className="text-2xl font-display font-semibold">Upcoming</h1>
        <p className="text-sm text-[#1c1a17]/60 mt-1">
          Coming-soon listings and what buyers are looking for — all in one place.
        </p>
      </div>

      <div className="flex items-center gap-2 my-5">
        {VIEWS.map((v) => (
          <button
            key={v.value}
            type="button"
            onClick={() => setView(v.value)}
            className={`text-xs font-semibold rounded-full px-4 py-2 transition-colors ${
              view === v.value ? "bg-[#1c1a17] text-white" : "bg-black/5 text-[#1c1a17]/70 hover:bg-black/10"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {(view === "all" || view === "listings") && <UpcomingListingsSection />}

      {view === "all" && <div className="border-t border-black/5 my-12" />}

      {(view === "all" || view === "buyers") && <BuyerNeedsSection />}
    </div>
  );
}
