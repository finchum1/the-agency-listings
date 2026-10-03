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
    next: { group: "transaction", label: "Move to Transactions" },
  },
  transaction: {
    title: "Transactions",
    stages: ["Pending", "Closing Soon", "Closed"],
    next: null,
    prev: { group: "pipeline", label: "Move back to Pipeline" },
  },
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
