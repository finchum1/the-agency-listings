import { supabase } from "./supabaseClient";

// A section's due rule is anchor + offset_days: positive = days after the
// anchor date, negative = days before. Each task copies its section's rule
// when a checklist is applied, and can then be pinned to a specific date.
export const ANCHORS = [
  { value: "contract_date", label: "contract date" },
  { value: "inspection_date", label: "inspection date" },
  { value: "closing_date", label: "closing date" },
];

export const SIDE_LABELS = { buyer: "Buyer", seller: "Seller" };

const FIRST_7 = { anchor: "contract_date", offset_days: 7 };
const INSPECTION = { anchor: "inspection_date", offset_days: 0 };
const BEFORE_CLOSING = { anchor: "closing_date", offset_days: -10 };

export const DEFAULT_TEMPLATES = {
  buyer: [
    {
      title: "First 7 Days",
      ...FIRST_7,
      items: [
        "Create Calendar Event for Closing Appt & Invite Agent",
        "Beginning audit of file for compliance & notifying agent of missing items",
        "Begin uploading documents from Dotloop to SkySlope",
        "Send Buyer Welcome and next steps email",
        "Send intro email with contract to title, lender, and co-agent to start the transaction",
        "Send client contact info email to Title",
        "Confirm Earnest Money Deposit within 3 days of Contract Acceptance Date (or 1st business day thereafter) & Upload to SkySlope",
        "Email the lender to confirm that the appraisal is ordered and request the due date for the report",
      ],
    },
    {
      title: "Inspection Window",
      ...INSPECTION,
      items: [
        "Inform Agent of Fully Negotiated TRR Due Date",
        "Order home warranty & upload invoice & send to title",
        "Obtain All Missing Docs - email listing agent, send for buyers signatures",
        "Upload Remaining Docs to SkySlope & Submit to Compliance",
        "Confirm DA completed",
        "Send DA, termite report, all invoices /receipts for inspections, home warranty invoice (if applicable), and anything being billed to closing, to the title company in .pdf format",
        "Confirm appraisal is received and matches value",
        "Compose any additional documents, excluding TRR's, and send for signatures",
      ],
    },
    {
      title: "10 Days Before Closing",
      ...BEFORE_CLOSING,
      items: [
        "Send closing scheduled email to client & co-agent",
        "Follow up with the lender on the status of the loan",
        "Confirm Title Commitment & Survey are received from Title & Send to Client(s)",
        "Send closing week email to Client",
        "Confirm Closing or Remote Closing Details with title and buyer(s)",
        "Request Settlement Statement from Title & Send to Agent for review upon receipt",
        "Send Closing Details & Settlement Statement to Client(s) for review after TC & Agent have reviewed it",
        "Send Friday Update Emails to Clients (updating them on the milestones of their transaction)",
      ],
    },
  ],
  seller: [
    {
      title: "First 7 Days",
      ...FIRST_7,
      items: [
        "Create Calendar Event for Closing Appt & Invite Agent",
        "Beginning audit of file for compliance & notifying agent of missing items",
        "Begin uploading documents from Dotloop to SkySlope",
        "Send Seller Welcome and next steps email",
        "Send intro email with contract to title, lender, and co-agent to start the transaction",
        "Send client contact info email to Title",
        "Confirm Earnest Money Deposit within 3 days of Contract Acceptance Date (or 1st business day thereafter) & Upload to Dotloop",
        "Email the lender to confirm that the appraisal is ordered and request the due date for the report",
      ],
    },
    {
      title: "Inspection Window",
      ...INSPECTION,
      items: [
        "Inform Agent of Fully Negotiated TRR Due Date",
        "Obtain All Missing Docs - email listing agent, send for Seller signature",
        "Upload Remaining Docs to SkySlope & Submit to Compliance",
        "Confirm DA completed",
        "Send DA, all invoices /receipts, and anything being billed to closing, to the title company in .pdf format",
        "Confirm appraisal is received and matches value",
        "Compose any additional documents, excluding TRR's, and send for signatures",
        "Send closing scheduled email to client - arrange pre-signing, mail out or notary as needed",
        "Follow up with the lender on the status of the loan",
      ],
    },
    {
      title: "10 Days Before Closing",
      ...BEFORE_CLOSING,
      items: [
        "Confirm Title Commitment & Survey are received from Title & Send to Client(s)",
        "Send closing week email to Client",
        "Confirm Closing or Remote Closing Details with title and buyer(s)",
        "Request Settlement Statement from Title & Send to Agent for review upon receipt",
        "Send Closing Details & Settlement Statement to Client(s) for review after TC & Agent have reviewed it",
        "Send Friday Update Emails to Clients (updating them on the milestones of their transaction)",
      ],
    },
  ],
};

export function ruleLabel(anchor, offset) {
  const name = ANCHORS.find((a) => a.value === anchor)?.label || anchor;
  if (!offset) return `Due on the ${name}`;
  const n = Math.abs(offset);
  return `Due ${n} day${n === 1 ? "" : "s"} ${offset > 0 ? "after" : "before"} the ${name}`;
}

export function shiftDate(dateKey, days) {
  if (!dateKey) return null;
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const pad = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

// dates = { contract_date, inspection_date, closing_date } from the deal.
export function effectiveDue(task, dates) {
  return task.due_override || shiftDate(dates[task.anchor], task.offset_days);
}

// The agent's saved template for a side, or the built-in default.
export async function loadTemplate(side) {
  const { data } = await supabase.from("checklist_templates").select("sections").eq("side", side).maybeSingle();
  return data?.sections?.length ? data.sections : DEFAULT_TEMPLATES[side];
}
