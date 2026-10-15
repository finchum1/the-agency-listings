// Buyer / seller / both tags on People cards. Leads and Pipeline can be any of the three; Transactions are buyer or
// seller only (the checklists are per side), see PersonPanel.jsx.
export const SIDE_TAGS = {
  buyer: { label: "Buyer", className: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  seller: { label: "Seller", className: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  both: { label: "Buyer & seller", className: "bg-violet-500/10 text-violet-700 dark:text-violet-300" },
};
