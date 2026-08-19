import UpcomingListingsTable from "../../components/dashboard/UpcomingListingsTable";
import BuyerNeedsTable from "../../components/dashboard/BuyerNeedsTable";

const UPCOMING_STATUS_LABELS = { active: "Coming Soon", listed: "Now Listed", cancelled: "Cancelled" };
const UPCOMING_STATUS_COLORS = { active: "#b5860b", listed: "#1c7c4d", cancelled: "#9a3b3b" };
const BUYER_STATUS_LABELS = { active: "Actively Looking", matched: "Matched", closed: "Closed" };
const BUYER_STATUS_COLORS = { active: "#1c7c4d", matched: "#b5860b", closed: "#5a5a5a" };

// Clearly fictional — reuses the "Maya Coleman" / "Diego Alvarez" sample
// roster already established in dashboard-table.png (the existing landing
// page hero screenshot), plus one more, so the whole marketing site's
// illustrative data reads as one consistent fictional office rather than
// a different made-up name per screenshot. 555 phone numbers are the
// standard fictional-number convention.
const SAMPLE_UPCOMING = [
  {
    id: "sample-1",
    agent: { full_name: "Maya Coleman" },
    address_line1: "412 Winding Creek Rd",
    city: "Nichols Hills",
    state: "OK",
    zip: "73116",
    beds: 5,
    baths: 4,
    sqft: 4200,
    price_estimate: 1250000,
    status: "active",
    expected_list_date: "2026-10-15",
    notes: "Sellers finishing a kitchen remodel before listing.",
  },
  {
    id: "sample-2",
    agent: { full_name: "Diego Alvarez" },
    address_line1: "88 Preston Ridge Ct",
    city: "Edmond",
    state: "OK",
    zip: "73025",
    beds: 4,
    baths: 3,
    sqft: 3100,
    price_estimate: 685000,
    status: "active",
    expected_list_date: "2026-09-20",
    notes: "Quiet cul-de-sac, great for a move-up buyer.",
  },
  {
    id: "sample-3",
    agent: { full_name: "Priya Natarajan" },
    address_line1: "215 Overbrook Dr",
    city: "Edmond",
    state: "OK",
    zip: "73003",
    beds: 3,
    baths: 2,
    sqft: 2050,
    price_estimate: 415000,
    status: "listed",
    expected_list_date: "2026-08-01",
    notes: "Just went live as a real listing.",
  },
];

const SAMPLE_BUYERS = [
  {
    id: "sample-1",
    agent: { full_name: "Maya Coleman" },
    buyer_name: "The Whitfield Family",
    buyer_contact: "(405) 555-0142",
    min_price: 400000,
    max_price: 600000,
    min_beds: 4,
    min_baths: 3,
    areas: "Edmond, Nichols Hills",
    status: "active",
    notes: "Relocating for work, hoping to close within 60 days.",
  },
  {
    id: "sample-2",
    agent: { full_name: "Diego Alvarez" },
    buyer_name: "J. Reyes",
    buyer_contact: "(405) 555-0198",
    min_price: 250000,
    max_price: 350000,
    min_beds: 3,
    min_baths: 2,
    areas: "Downtown Edmond",
    status: "active",
    notes: "First-time buyers, flexible move-in date.",
  },
  {
    id: "sample-3",
    agent: { full_name: "Priya Natarajan" },
    buyer_name: "The Chens",
    buyer_contact: "(405) 555-0176",
    min_price: 700000,
    max_price: 950000,
    min_beds: 5,
    min_baths: 4,
    areas: "Nichols Hills",
    status: "matched",
    notes: "Found a match on Winding Creek Rd.",
  },
];

// TEMPORARY — a screenshot-capture route for the new /upcoming marketing
// page's two BrowserFrame images. Renders the REAL table components (see
// UpcomingListingsTable.jsx / BuyerNeedsTable.jsx, shared with the actual
// dashboard pages) through the REAL compiled Tailwind build, fed clearly-
// fictional sample rows instead of live Supabase data -- capturing the
// real authenticated dashboard isn't something this process can do.
// Not linked from anywhere. Delete this file + its App.jsx route once
// the screenshots are captured and saved into public/images/landing/.
export default function ModulePreview() {
  const noop = () => {};
  return (
    <div className="min-h-screen bg-[#faf9f7] px-4 sm:px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-16">
        <div id="upcoming-listings-shot">
          <h1 className="text-2xl font-display font-semibold mb-6">Upcoming Listings</h1>
          <UpcomingListingsTable
            rows={SAMPLE_UPCOMING}
            statusLabels={UPCOMING_STATUS_LABELS}
            statusColors={UPCOMING_STATUS_COLORS}
            canEdit={() => true}
            onStatusChange={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </div>
        <div id="buyer-needs-shot">
          <h1 className="text-2xl font-display font-semibold mb-6">Buyer Needs</h1>
          <BuyerNeedsTable
            rows={SAMPLE_BUYERS}
            statusLabels={BUYER_STATUS_LABELS}
            statusColors={BUYER_STATUS_COLORS}
            canEdit={() => true}
            onStatusChange={noop}
            onEdit={noop}
            onDelete={noop}
          />
        </div>
      </div>
    </div>
  );
}
