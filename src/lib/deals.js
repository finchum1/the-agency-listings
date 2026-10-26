// Deals: the old Transactions board, now its own top-level module. Who can see what is decided in the database (deal_access());
// this file is only labels and small helpers for the screens.

export const COMPLIANCE = {
  none: { label: "Not submitted", tone: "gray" },
  submitted: { label: "In compliance review", tone: "amber" },
  needs_changes: { label: "Sent back", tone: "red" },
  approved: { label: "Approved", tone: "green" },
};

export const COMPLIANCE_TONES = {
  gray: "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/65 dark:text-[#faf9f7]/65",
  amber: "bg-amber-100 dark:bg-amber-400/15 text-amber-900 dark:text-amber-300",
  red: "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300",
  green: "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300",
};

export const complianceInfo = (status) => COMPLIANCE[status] || COMPLIANCE.none;

// Where a board lives. Deals moved out of People; the other two boards stay put.
export const boardPath = (group) => (group === "transaction" ? "/dashboard/deals" : `/dashboard/people/${group === "lead" ? "leads" : "pipeline"}`);

// What the signed-in profile can do in Deals. `mine` = their own deals board (the People module switch), `team` = the office view
// that coordinators and compliance get.
export function dealAccess(profile) {
  const isCompliance = profile?.deals_role === "compliance";
  const isTc = profile?.deals_role === "tc";
  const mine = Boolean(profile?.people_enabled);
  return { mine, isCompliance, isTc, team: isCompliance || isTc, any: mine || isCompliance || isTc };
}
