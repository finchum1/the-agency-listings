// Kanban columns per board. `stage` is stored as free text on people, so
// renaming a column later means updating this list and migrating rows.
export const BOARDS = {
  lead: {
    title: "Leads",
    stages: ["New", "Contacted", "Nurturing", "Qualified"],
    next: { group: "pipeline", label: "Move to Pipeline" },
  },
  pipeline: {
    title: "Pipeline",
    stages: ["12+ Months", "6+ Months", "3-6 Months", "Coming Soon", "Active"],
    next: { group: "transaction", label: "Start a deal" },
  },
  transaction: {
    title: "Deals",
    // Listings first: where a deal sits while the listing is being put together, before there is a contract.
    stages: ["Listings", "Pending", "Closing Soon", "Closed"],
    next: null,
    prev: { group: "pipeline", label: "Move back to Pipeline" },
  },
};

// How often to follow up with someone sitting in a Leads / Pipeline column, in days. The agent changes these per column (people_settings.cadence);
// the database applies them when someone lands in a column (see people_apply_cadence), so these must match the defaults in that function.
export const DEFAULT_CADENCE = {
  lead: { New: 1, Contacted: 3, Nurturing: 14, Qualified: 3 },
  pipeline: { "12+ Months": 90, "6+ Months": 60, "3-6 Months": 30, "Coming Soon": 7, Active: 3 },
};

export const ARCHIVE_REASONS = [
  "Deal fell through",
  "Went with another agent",
  "Not interested",
  "Not responding",
  "Timing / no longer moving",
  "Other",
];

export const SOURCES = [
  "Website inquiry",
  "Referral",
  "Past client",
  "Sphere of influence",
  "Open house",
  "Sign call",
  "Online portal",
  "Social media",
  "Cold call / door knocking",
  "Added manually",
  "Other",
];
