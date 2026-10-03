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
    next: null,
  },
  transaction: {
    title: "Transactions",
    stages: ["Pending", "Closing Soon", "Closed"],
    next: null,
  },
};

export const ARCHIVE_REASONS = [
  "Went with another agent",
  "Not interested",
  "Not responding",
  "Timing / no longer moving",
  "Other",
];
