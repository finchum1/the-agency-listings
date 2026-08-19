import ListingsDataTable from "../../components/dashboard/ListingsDataTable";
import brokerage from "../../lib/brokerage";

// Clearly fictional sample row, alongside the real 1645 Saratoga Way
// listing (already public, already used elsewhere on this marketing
// site) — same "Maya Coleman" placeholder established in the previous
// hero screenshot and the /upcoming page's sample data.
const SAMPLE_LISTINGS = [
  {
    id: "real-1",
    address_line1: "1645 Saratoga Way",
    city: "Edmond",
    state: "OK",
    zip: "73003",
    agent: { full_name: "Terrence Finchum" },
    price: 1395000,
    status: "for_sale",
    updated_at: "2026-08-15T00:00:00Z",
    slug: "1645-saratoga-way",
  },
  {
    id: "sample-1",
    address_line1: "412 Winding Creek Rd",
    city: "Nichols Hills",
    state: "OK",
    zip: "73116",
    agent: { full_name: "Maya Coleman" },
    price: 685000,
    status: "pending",
    updated_at: "2026-08-10T00:00:00Z",
    slug: "sample",
  },
];

// TEMPORARY — a screenshot-capture route for the landing page's main
// hero image: the real dashboard header/nav (hand-matched to
// DashboardLayout.jsx's exact markup/classes, not imported directly,
// since that component calls useAuth() and expects a real session) over
// a real ListingsDataTable. The nav bar itself is what does the "all the
// modules" work here — My Site, Listings, Upcoming, Admin — rather than
// cramming four separate tiny panels into one image, which either forced
// illegible text or a hero shaped nothing like the rest of the page's
// wide-landscape screenshots. Not linked from anywhere. Delete this file
// + its App.jsx route once the screenshot is captured and saved.
export default function ModulePreview() {
  const noop = () => {};
  return (
    <div className="min-h-screen bg-[#faf9f7] p-8">
      <div id="dashboard-overview-shot" className="inline-block bg-white rounded-2xl border border-black/10 overflow-hidden" style={{ width: "1200px" }}>
        <header className="border-b border-black/5 bg-white">
          <div className="px-6 py-4 flex items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src={brokerage.logo} alt={brokerage.name} className="h-9 w-auto" />
              <span className="h-6 w-px bg-black/10" />
              <span className="text-xs font-semibold tracking-wider-plus uppercase text-[#1c1a17]/50">Oklahoma</span>
              <nav className="flex items-center gap-1 ml-4">
                <span className="text-sm font-medium px-4 py-2 rounded-full text-[#1c1a17]/70">My Site</span>
                <span className="text-sm font-medium px-4 py-2 rounded-full bg-[#1c1a17]/10 text-[#1c1a17]">Listings</span>
                <span className="text-sm font-medium px-4 py-2 rounded-full text-[#1c1a17]/70">Upcoming</span>
                <span className="flex items-center gap-1 text-sm font-medium px-4 py-2 rounded-full text-[#1c1a17]/70">
                  Admin
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </nav>
            </div>
            <div className="flex items-center gap-2.5 text-sm text-[#1c1a17]/60">
              Terrence Finchum
              <span className="text-xs font-semibold text-[#ed2127]">ADMIN</span>
            </div>
          </div>
        </header>
        <div className="p-6">
          <h1 className="text-2xl font-display font-semibold mb-1">Listings</h1>
          <p className="text-sm text-[#1c1a17]/60 mb-5">2 listings</p>
          <ListingsDataTable rows={SAMPLE_LISTINGS} onStatusChange={noop} />
        </div>
      </div>
    </div>
  );
}
