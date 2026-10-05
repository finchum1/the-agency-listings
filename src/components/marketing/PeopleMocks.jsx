// Sample-data renderings of the People module's real screens, drawn with
// the same colors, spacing and labels as the dashboard itself. Every name,
// number and address here is invented.

const pill = "rounded-full border border-black/10 px-1.5 py-0.5 text-[9px] font-medium text-[#1c1a17]/70";

function MiniCard({ name, sub, follow, tone = "muted" }) {
  const toneClass =
    tone === "overdue" ? "text-red-600" : tone === "today" ? "text-amber-700" : "text-[#1c1a17]/50";
  return (
    <div className="bg-white border border-black/5 rounded-lg p-2 space-y-1">
      <p className="text-[11px] font-medium truncate">{name}</p>
      {sub && <p className="text-[10px] text-[#1c1a17]/50 truncate">{sub}</p>}
      {follow && <p className={`text-[10px] font-medium ${toneClass}`}>{follow}</p>}
      <div className="flex gap-1">
        <span className={pill}>Call</span>
        <span className={pill}>Text</span>
        <span className={pill}>Email</span>
      </div>
    </div>
  );
}

export function BoardMock({ title, columns }) {
  return (
    <div className="p-4 sm:p-5 select-none" aria-hidden="true">
      <p className="font-display text-base font-semibold mb-3">{title}</p>
      <div className="flex gap-2.5 overflow-hidden">
        {columns.map((col) => (
          <div key={col.name} className="w-40 shrink-0 rounded-xl bg-black/[0.04] p-2 space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[9px] font-semibold uppercase tracking-wide text-[#1c1a17]/60">{col.name}</span>
              <span className="text-[10px] text-[#1c1a17]/40">{col.cards.length} +</span>
            </div>
            {col.cards.map((c) => (
              <MiniCard key={c.name} {...c} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export const LEAD_COLUMNS = [
  {
    name: "New",
    cards: [
      { name: "Maya Whitfield", sub: "Website inquiry", follow: "Follow up today", tone: "today" },
      { name: "Daniel Ortega", sub: "(405) 555-0142", follow: "Follow up Oct 9" },
    ],
  },
  {
    name: "Contacted",
    cards: [{ name: "Priya Raman", sub: "Referral", follow: "Follow up · overdue", tone: "overdue" }],
  },
  {
    name: "Nurturing",
    cards: [
      { name: "The Hendersons", sub: "Open house", follow: "Follow up Oct 14" },
      { name: "Chris Boyd", sub: "(918) 555-0187", follow: "Follow up Oct 21" },
    ],
  },
  { name: "Qualified", cards: [{ name: "Alana Fox", sub: "Past client", follow: "Follow up Oct 10" }] },
];

export const PIPELINE_COLUMNS = [
  { name: "12+ Months", cards: [{ name: "Sam Patel", sub: "Renting until lease ends", follow: "Follow up Nov 3" }] },
  { name: "6+ Months", cards: [{ name: "Jordan & Lee Park", sub: "Selling to upsize", follow: "Follow up Oct 18" }] },
  { name: "3-6 Months", cards: [{ name: "Rhea Collins", sub: "Pre-approved", follow: "Follow up Oct 12" }] },
  {
    name: "Coming Soon",
    cards: [{ name: "Marcus Bell", sub: "Listing in spring", follow: "Follow up today", tone: "today" }],
  },
  { name: "Active", cards: [{ name: "Tessa Nguyen", sub: "Touring this weekend", follow: "Follow up Oct 8" }] },
];

export function TransactionMock() {
  const dates = [
    ["Contract", "Oct 1"],
    ["Inspection", "Oct 9"],
    ["Appraisal", "Oct 14"],
    ["Financing", "Oct 20"],
    ["Closing", "Oct 31"],
  ];
  const tasks = [
    [true, "Create calendar event for closing & invite agent"],
    [true, "Send buyer welcome and next steps email"],
    [false, "Confirm earnest money deposit & upload"],
    [false, "Email lender to confirm appraisal is ordered"],
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 select-none" aria-hidden="true">
      <div className="space-y-3">
        <div>
          <p className="font-display text-base font-semibold">Jordan & Lee Park</p>
          <p className="text-[10px] text-[#1c1a17]/50">Transactions · Closing Soon</p>
        </div>
        <div className="bg-white border border-black/5 rounded-lg p-3 space-y-2 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#1c1a17]/50">Property</span>
            <span className="font-medium">412 Maple Ridge Dr</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1c1a17]/50">Side</span>
            <span className="font-medium">Buyer</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1c1a17]/50">Price · Commission</span>
            <span className="font-medium">$385,000 · $11,550</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#1c1a17]/50">Title · Lender</span>
            <span className="font-medium">Frontier Title · Cardinal Home Loans</span>
          </div>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {dates.map(([label, date]) => (
            <div key={label} className="bg-white border border-black/5 rounded-lg px-1.5 py-1.5 text-center">
              <p className="text-[8px] uppercase tracking-wide text-[#1c1a17]/45">{label}</p>
              <p className="text-[10px] font-semibold">{date}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-lg p-3 space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-[12px] font-semibold">Checklist</p>
          <p className="text-[10px] text-[#1c1a17]/50">2 of 24 done</p>
        </div>
        <div>
          <div className="flex justify-between text-[11px] font-semibold">
            <span>First 7 Days</span>
            <span className="text-[10px] font-normal text-[#1c1a17]/50">2/8</span>
          </div>
          <p className="text-[9px] text-[#1c1a17]/45 mb-1">Due 7 days after the contract date</p>
          <ul className="space-y-1.5">
            {tasks.map(([done, text]) => (
              <li key={text} className="flex items-start gap-1.5 text-[10.5px] leading-snug">
                <span
                  className={`mt-0.5 h-3 w-3 shrink-0 rounded-[3px] border flex items-center justify-center ${
                    done ? "bg-[#ed2127] border-[#ed2127]" : "border-black/25"
                  }`}
                >
                  {done && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                      <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className={done ? "line-through opacity-50" : ""}>{text}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-between text-[11px] font-semibold pt-1">
          <span>Inspection Window</span>
          <span className="text-[10px] font-normal text-[#1c1a17]/50">0/8</span>
        </div>
        <div className="flex justify-between text-[11px] font-semibold">
          <span>10 Days Before Closing</span>
          <span className="text-[10px] font-normal text-[#1c1a17]/50">0/8</span>
        </div>
      </div>
    </div>
  );
}

export function OverviewMock() {
  const tiles = [
    ["Leads", 14, ["New 5", "Contacted 4", "Nurturing 3", "Qualified 2"]],
    ["Pipeline", 22, ["12+ Months 6", "6+ Months 5", "3-6 Months 5", "Active 6"]],
    ["Transactions", 5, ["Pending 2", "Closing Soon 2", "Closed 1"]],
  ];
  const values = [
    ["Open deals", "4", "$1.6M volume"],
    ["Expected commission", "$48,200", "From open transactions"],
    ["Closed in 2026", "17", "$6.4M volume"],
    ["Commission earned", "$191,500", "Deals closed this year"],
  ];
  return (
    <div className="p-4 sm:p-5 space-y-3 select-none" aria-hidden="true">
      <p className="font-display text-base font-semibold">Overview</p>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map(([name, total, rows]) => (
          <div key={name} className="bg-white border border-black/5 rounded-lg p-2.5">
            <div className="flex justify-between items-baseline">
              <span className="text-[11px] font-semibold">{name}</span>
              <span className="text-base font-semibold">{total}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {rows.map((r) => (
                <li key={r} className="text-[9.5px] text-[#1c1a17]/50">
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {values.map(([label, value, sub]) => (
          <div key={label} className="bg-white border border-black/5 rounded-lg p-2.5">
            <p className="text-[9px] text-[#1c1a17]/50">{label}</p>
            <p className="text-sm font-semibold">{value}</p>
            <p className="text-[9px] text-[#1c1a17]/45">{sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-white border border-black/5 rounded-lg p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold">Key dates · next 14 days</p>
          {[
            ["Thu, Oct 9", "Inspection · 412 Maple Ridge Dr"],
            ["Tue, Oct 14", "Appraisal · 412 Maple Ridge Dr"],
            ["Fri, Oct 31", "Closing · 88 Cedar Hollow Ln"],
          ].map(([d, t]) => (
            <div key={t}>
              <p className="text-[8.5px] font-semibold uppercase tracking-wide text-[#1c1a17]/55">{d}</p>
              <p className="text-[10px]">{t}</p>
            </div>
          ))}
        </div>
        <div className="bg-white border border-black/5 rounded-lg p-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold">Follow-ups</p>
          {[
            ["Priya Raman", "Leads · Contacted · overdue", true],
            ["Maya Whitfield", "Leads · New · today", false],
            ["Marcus Bell", "Pipeline · Coming Soon · today", false],
          ].map(([n, t, late]) => (
            <div key={n}>
              <p className="text-[10px] font-medium">{n}</p>
              <p className={`text-[9px] ${late ? "text-red-600" : "text-[#1c1a17]/50"}`}>{t}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
