// Email templates for deals: the merge fields, the people an email goes to, the built-in starter set, and the function that turns a template and a
// deal into a ready-to-send email (to, cc, subject, body). Pure functions with no imports, so the dashboard and the AI connection share them
// (the same split as checklistDefaults.js). Nothing here sends anything: the deal's Email button opens the result in the person's own email app.

// ------------------------------------------------------------------------------------------------ who it goes to
// A role is a person on the deal. `name` and `email` are the column names on the deal's row; `agent` and `tc` come from `ctx` instead.
export const RECIPIENT_ROLES = [
  { key: "client", label: "Client", name: "name", email: "email" },
  { key: "client2", label: "Second client", name: "client2_name", email: "client2_email" },
  { key: "agent", label: "The deal's agent" },
  { key: "tc", label: "Coordinator" },
  { key: "other_agent", label: "Other agent", name: "other_agent", email: "other_agent_email" },
  { key: "other_agent2", label: "Second agent on the other side", name: "other_agent2", email: "other_agent2_email" },
  { key: "other_agent_tc", label: "Other agent's TC", name: "other_agent_tc_name", email: "other_agent_tc_email" },
  { key: "escrow", label: "Escrow officer", name: "escrow_officer", email: "escrow_officer_email" },
  { key: "title_processor", label: "Title processor", name: "title_processor_name", email: "title_processor_email" },
  { key: "lender", label: "Lender", name: "lender", email: "lender_email", cashHides: true },
  { key: "loan_processor", label: "Loan processor", name: "loan_processor_name", email: "loan_processor_email", cashHides: true },
];
const ROLE = Object.fromEntries(RECIPIENT_ROLES.map((r) => [r.key, r]));

// ------------------------------------------------------------------------------------------------ small formatters
const text = (v) => String(v ?? "").trim();
export const firstName = (s) => text(s).split(/\s+/)[0] || "";
// "Connor & Annie Maynard" -> Connor, Annie. "Jane Doe" -> Jane.
const personFirsts = (s) => text(s).split(/\s*(?:&|\band\b)\s*/i).map(firstName).filter(Boolean);
const joinNames = (list) => {
  const names = [...new Set(list.filter(Boolean))];
  return names.length <= 1 ? names[0] || "" : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};
const longDate = (key) => {
  const d = /^\d{4}-\d{2}-\d{2}/.test(key || "") ? new Date(`${String(key).slice(0, 10)}T12:00:00Z`) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" }) : "";
};
const clock = (hhmm) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || "");
  if (!m) return "";
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? "PM" : "AM"}`;
};
const usd = (n) => (n === null || n === undefined || n === "" || Number.isNaN(Number(n)) ? "" : `$${Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`);
// "Name with Company | contact": any piece that is blank is left out, and nothing at all gives "" (so an optional line can drop out).
const line = (name, company, contact) => {
  const who = [text(name), text(company) && text(name) ? `with ${text(company)}` : text(company)].filter(Boolean).join(" ");
  return [who, text(contact)].filter(Boolean).join(" | ");
};
const when = (date, time) => [longDate(date), time && date ? `at ${clock(time)}` : ""].filter(Boolean).join(" ");

// ------------------------------------------------------------------------------------------------ merge fields
// [key, label shown in the editor and in "fill in" warnings, group]
export const MERGE_FIELDS = [
  ["client_first_name", "client first name(s)", "Client"],
  ["client_name", "client name(s)", "Client"],
  ["client_role", "buyer or seller", "Client"],
  ["client_emails", "client email address(es)", "Client"],
  ["client_phone", "client phone", "Client"],
  ["property_address", "property address", "Deal"],
  ["street", "street address", "Deal"],
  ["price", "price", "Deal"],
  ["earnest_money", "earnest money", "Deal"],
  ["contract_date", "contract date", "Dates"],
  ["inspection_date", "inspection date", "Dates"],
  ["inspection_time", "inspection time", "Dates"],
  ["inspection_when", "inspection date and time", "Dates"],
  ["inspection_period_end", "end of the inspection period", "Dates"],
  ["appraisal_date", "appraisal date", "Dates"],
  ["closing_date", "closing date", "Dates"],
  ["closing_time", "closing time", "Dates"],
  ["closing_when", "closing date and time", "Dates"],
  ["financing", "financing type", "Deal"],
  ["other_party_name", "the other side's client", "Deal"],
  ["other_party_role", "Seller or Buyer (the other side's client)", "Deal"],
  ["title_company", "title company", "Other people"],
  ["title_processor", "title processor", "Other people"],
  ["escrow_officer", "escrow officer", "Other people"],
  ["title_greeting", "title contact first name", "Other people"],
  ["lender", "lender", "Other people"],
  ["loan_processor", "loan processor", "Other people"],
  ["lender_greeting", "lender contact first name", "Other people"],
  ["other_agent", "other agent", "Other people"],
  ["other_agent_first", "other agent's first name", "Other people"],
  ["other_agent_firsts", "other agents' first names", "Other people"],
  ["other_agent_line", "other agent: name | email", "Contact lines"],
  ["other_agent2_line", "second agent on the other side: name | email", "Contact lines"],
  ["title_line", "title contact: name with company | email", "Contact lines"],
  ["lender_line", "lender contact: name with company | email", "Contact lines"],
  ["other_side_firsts", "other side's first names (agents and their TC)", "Other people"],
  ["other_agent_tc", "other agent's TC", "Other people"],
  ["my_name", "your name", "You"],
  ["my_first_name", "your first name", "You"],
  ["my_phone", "your phone", "You"],
  ["my_email", "your email", "You"],
  ["my_role", "your role on the deal", "You"],
  ["my_signature", "your signature", "You"],
  ["agent_name", "the agent's name", "Agent and coordinator"],
  ["agent_first_name", "the agent's first name", "Agent and coordinator"],
  ["agent_phone", "the agent's phone", "Agent and coordinator"],
  ["agent_email", "the agent's email", "Agent and coordinator"],
  ["agent_company", "the agent's brokerage", "Agent and coordinator"],
  ["agent_line", "the agent: name with brokerage | email, phone", "Contact lines"],
  ["coordinator_lines", "coordinator name and email", "Agent and coordinator"],
  ["coordinator_names", "coordinator name(s)", "Agent and coordinator"],
];
const FIELD_LABEL = Object.fromEntries(MERGE_FIELDS.map(([k, l]) => [k, l]));

/**
 * Every merge field's value for this deal. `ctx`:
 *   me            the person sending: { name, email, phone }
 *   agent         the deal's agent:   { name, email, phone }
 *   coordinators  [{ name, email }] working the deal
 */
export function fieldValues(deal = {}, ctx = {}) {
  const me = ctx.me || {};
  const agent = ctx.agent || {};
  const tcs = ctx.coordinators || [];
  const clients = [...personFirsts(deal.name), ...personFirsts(deal.client2_name)];
  const clientNames = deal.client2_name && !text(deal.name).includes(text(deal.client2_name)) ? `${text(deal.name)} and ${text(deal.client2_name)}` : text(deal.name);
  const address = text(deal.property_address);
  const imAgent = !!me.email && !!agent.email && me.email.toLowerCase() === agent.email.toLowerCase();
  const side = deal.side === "seller" ? "seller" : deal.side === "buyer" ? "buyer" : "";
  return {
    client_first_name: joinNames([...new Set(clients)]),
    client_name: clientNames,
    client_role: side ? (side === "buyer" ? "Buyer" : "Seller") : "",
    client_emails: [...new Set([text(deal.email), text(deal.client2_email)].filter(Boolean))].join(", "),
    client_phone: text(deal.phone),
    property_address: address,
    street: address.split(",")[0].trim(),
    price: usd(deal.price),
    earnest_money: usd(deal.earnest_money),
    contract_date: longDate(deal.contract_date),
    inspection_date: longDate(deal.inspection_date),
    inspection_time: clock(deal.inspection_time),
    inspection_when: when(deal.inspection_date, deal.inspection_time),
    inspection_period_end: longDate(deal.inspection_period_end),
    appraisal_date: longDate(deal.appraisal_date),
    closing_date: longDate(deal.closing_date),
    closing_time: clock(deal.closing_time),
    closing_when: when(deal.closing_date, deal.closing_time),
    financing: deal.is_cash ? "Cash" : text(deal.financing_type),
    other_party_name: text(deal.other_party_name),
    other_party_role: side === "seller" ? "Buyer" : "Seller",
    title_company: text(deal.title_company),
    title_processor: text(deal.title_processor_name),
    escrow_officer: text(deal.escrow_officer),
    title_greeting: firstName(deal.escrow_officer) || firstName(deal.title_processor_name) || text(deal.title_company),
    lender: text(deal.lender),
    loan_processor: text(deal.loan_processor_name),
    lender_greeting: firstName(deal.loan_processor_name) || text(deal.lender),
    other_agent: text(deal.other_agent),
    other_agent_first: firstName(deal.other_agent),
    other_agent_line: line(deal.other_agent, deal.other_agent_company, [text(deal.other_agent_email), text(deal.other_agent_phone)].filter(Boolean).join(", ")),
    other_agent2_line: line(deal.other_agent2, deal.other_agent2_company, [text(deal.other_agent2_email), text(deal.other_agent2_phone)].filter(Boolean).join(", ")),
    title_line: deal.escrow_officer || !deal.title_processor_name
      ? line(deal.escrow_officer, deal.title_company, [text(deal.escrow_officer_email), text(deal.title_phone)].filter(Boolean).join(", "))
      : line(deal.title_processor_name, deal.title_company, [text(deal.title_processor_email), text(deal.title_phone)].filter(Boolean).join(", ")),
    lender_line: deal.is_cash ? "" : line(deal.loan_processor_name || deal.lender, deal.loan_processor_name ? deal.lender : "", [text(deal.loan_processor_email || deal.lender_email), text(deal.lender_phone)].filter(Boolean).join(", ")),
    other_agent_firsts: joinNames([firstName(deal.other_agent), firstName(deal.other_agent2)]),
    other_side_firsts: joinNames([firstName(deal.other_agent), firstName(deal.other_agent2), firstName(deal.other_agent_tc_name)]),
    other_agent_tc: text(deal.other_agent_tc_name),
    my_name: text(me.name),
    my_first_name: firstName(me.name),
    my_phone: text(me.phone),
    my_email: text(me.email),
    my_role: imAgent ? (side ? `the ${side}'s agent` : "the agent") : agent.name ? `the transaction coordinator for ${text(agent.name)}` : "the transaction coordinator",
    my_signature: [text(me.name), text(me.phone), text(me.email)].filter(Boolean).join("\n"),
    agent_name: text(agent.name),
    agent_first_name: firstName(agent.name),
    agent_phone: text(agent.phone),
    agent_email: text(agent.email),
    agent_company: text(agent.company),
    agent_line: line(agent.name, agent.company, [text(agent.email), text(agent.phone)].filter(Boolean).join(", ")),
    coordinator_lines: tcs.map((t) => [text(t.name), text(t.email)].filter(Boolean).join(", ")).filter(Boolean).join("; "),
    coordinator_names: joinNames(tcs.map((t) => t.name)),
  };
}

/**
 * Fills a template's text from the values. A field with no value becomes "[its label]" (so it can't go out blank by accident) and is reported
 * in `missing`. A line that starts with "? " is optional: it is dropped when any field on it is blank, and shown without the "? " otherwise.
 */
export function fillText(template, values) {
  const missing = [];
  const lines = String(template || "").split("\n");
  const out = [];
  for (const raw of lines) {
    const optional = /^\?\s/.test(raw);
    const line = optional ? raw.replace(/^\?\s/, "") : raw;
    const keys = [...line.matchAll(/\{([a-z0-9_]+)\}/g)].map((m) => m[1]);
    if (optional && keys.some((k) => !text(values[k]))) continue;
    out.push(
      line.replace(/\{([a-z0-9_]+)\}/g, (_, k) => {
        const v = text(values[k]);
        if (v) return v;
        const label = FIELD_LABEL[k] || k.replace(/_/g, " ");
        if (!missing.includes(label)) missing.push(label);
        return `[${label}]`;
      }),
    );
  }
  return { text: out.join("\n").replace(/\n{3,}/g, "\n\n"), missing };
}

// ------------------------------------------------------------------------------------------------ recipients
const SIBLINGS = [["escrow", "title_processor"], ["lender", "loan_processor"]];
function peopleFor(roles, deal, ctx) {
  const found = [];
  const noEmail = [];
  for (const raw of roles || []) {
    const key = raw === "title" ? "escrow" : raw; // the title company has no email of its own now: its mail goes to the escrow officer
    const role = ROLE[key];
    if (!role || (role.cashHides && deal.is_cash)) continue;
    let list;
    if (key === "agent") list = ctx.agent ? [{ name: ctx.agent.name, email: ctx.agent.email }] : [];
    else if (key === "tc") list = ctx.coordinators || [];
    else list = [{ name: deal[role.name], email: deal[role.email] }];
    for (const p of list) {
      const email = text(p.email);
      const name = text(p.name);
      if (email) found.push({ role: key, label: role.label, name, email });
      else if (name || key === "client") noEmail.push({ role: key, text: name ? `${role.label} (${name})` : role.label });
    }
  }
  // A company and its processor are one team: one address between them is enough, so only flag the pair when neither has one.
  const reached = (group) => group.some((k) => found.some((f) => f.role === k));
  const quiet = SIBLINGS.filter(reached).flat();
  return { found, noEmail: noEmail.filter((n) => !quiet.includes(n.role)).map((n) => n.text) };
}

/**
 * The email for a template on a deal: { to, cc, toPeople, ccPeople, subject, body, missing, noEmail }.
 *   to / cc   address lists with duplicates removed, nobody in both, and the sender never on their own email
 *   missing   labels of merge fields that had no value (they are left in the text as [label])
 *   noEmail   people the template goes to who have no email yet
 */
export function renderDealEmail(template, deal, ctx = {}) {
  const values = fieldValues(deal, ctx);
  const subject = fillText(template.subject, values);
  const body = fillText(template.body, values);
  const mine = text(ctx.me?.email).toLowerCase();
  const seen = new Set(mine ? [mine] : []);
  const pick = (found) => found.filter((p) => !seen.has(p.email.toLowerCase()) && seen.add(p.email.toLowerCase()));
  const to = peopleFor(template.to_roles, deal, ctx);
  const cc = peopleFor(template.cc_roles, deal, ctx);
  const toPeople = pick(to.found);
  const ccPeople = pick(cc.found);
  return {
    to: toPeople.map((p) => p.email),
    cc: ccPeople.map((p) => p.email),
    toPeople,
    ccPeople,
    subject: subject.text,
    body: body.text,
    missing: [...new Set([...subject.missing, ...body.missing])],
    noEmail: [...new Set([...to.noEmail, ...cc.noEmail])],
  };
}

const enc = encodeURIComponent;
/** A mailto: link. Line breaks are CRLF, which every mail app understands. */
export function mailtoHref({ to = [], cc = [], subject = "", body = "" }) {
  const query = [cc.length && `cc=${enc(cc.join(","))}`, subject && `subject=${enc(subject)}`, body && `body=${enc(body.replace(/\r?\n/g, "\r\n"))}`].filter(Boolean).join("&");
  return `mailto:${to.map(enc).join(",").replace(/%40/g, "@")}${query ? `?${query}` : ""}`;
}
/** The same email as a Gmail compose window. */
export function gmailHref({ to = [], cc = [], subject = "", body = "" }) {
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to.join(","))}&cc=${enc(cc.join(","))}&su=${enc(subject)}&body=${enc(body)}`;
}

// Which templates show on a deal: the ones for its side (or both), minus the lender ones on a cash purchase.
export function templatesForDeal(templates, deal) {
  return templates.filter((t) => (t.side === "both" || !deal.side || t.side === deal.side || deal.side === "both") && !(deal.is_cash && t.skipCash));
}

// ------------------------------------------------------------------------------------------------ the starter set
// One set for buyer deals and one for seller deals, each worded for that side. Every email task on the standard checklists has one
// (see TASK_EMAIL_RULES below), and a few more cover the moments in between. `group` only orders the menu.
export const EMAIL_GROUPS = ["Getting started", "Inspection and appraisal", "Financing and title", "Closing", "After closing"];

const SIG = "{my_signature}";
const CLIENTS = ["client", "client2"];
const US = ["agent", "tc"];
const TITLE = ["escrow", "title_processor"];
const LENDER = ["lender", "loan_processor"];
const OTHER_SIDE = ["other_agent", "other_agent2", "other_agent_tc"];
const EVERYONE = [...TITLE, ...LENDER, ...OTHER_SIDE];

const mk = (side, group, slug, name, to_roles, cc_roles, subject, body, extra = {}) => ({ key: `${side}-${slug}`, side, group, name, to_roles, cc_roles, subject, body, ...extra });

const BUYER = [
  mk("buyer", "Getting started", "welcome", "Welcome and next steps", CLIENTS, ["agent"], "Congrats! You’re under contract @ {property_address}",
`Hi {client_first_name},

Congratulations on your accepted offer! My name is {my_name} and I am {my_role}.
I will be one of your main contact points from now until closing.

Now that you are under contract, here are the next steps:

* Deliver Earnest Money to the {title_company} - you may drop this off in person OR you may send a wire transfer. If you would like to send a wire please let me know and I will inform the Title Company and they will provide wiring instructions for you.
* Confirm time and date for home, termite, and any other requested inspections. Please let me know if you plan to attend your home and termite inspections!
* Start calling for homeowners insurance quotes.
* Work with your lender to finalize all terms and documentation required for your loan application. In order to close on time, it is important to ensure all requested items are turned in promptly.

I look forward to working with you!`),
  mk("buyer", "Getting started", "contract-intro", "Contract intro to title, lender and co-agent", EVERYONE, US, "NEW CONTRACT - {property_address} | {client_role}",
`Hello,

My name is {my_name} and I am {my_role}.

Attached you will find the agreed-upon contract for {property_address}.

* Buyer Name: {client_name}
* Seller Name: {other_party_name}
* Purchase Price & Earnest Money: {price} | {earnest_money}
* Financing: {financing}
* Contract Date: {contract_date}
* Inspections: {inspection_date}
* Closing Date: {closing_date}
* Selling Agent: {agent_line}
* Transaction Coordinator: {coordinator_lines}
* Listing Agent: {other_agent_line}
? * Listing Agent: {other_agent2_line}
* Transaction Coordinator: {other_agent_first}, let us know if you have a TC to add to this file.
* Title: {title_line}
? * Lender: {lender_line}

Special Notes: Please confirm receipt of this email and all documents attached below.

{title_greeting}- I will be sending a separate email with commission information as well as buyer information. Please send the earnest money receipt once received.

I am looking forward to working with you all.

[Attach the contract and documents]

Thanks!`),
  mk("buyer", "Getting started", "client-info-title", "Client contact info to title", TITLE, US, "Client contact information: {property_address}",
`Hello {title_greeting},

Here is our buyer's contact information for {property_address}:

- Name: {client_name}
? - Email: {client_emails}
? - Phone: {client_phone}

Please reach out to them directly with anything you need, and copy me.

Thank you,
${SIG}`),
  mk("buyer", "Getting started", "earnest-title", "Confirm earnest money with title", TITLE, US, "Earnest money: {property_address}",
`Hello {title_greeting},

Can you confirm you've received the earnest money on {property_address}?

? - Amount: {earnest_money}
? - Buyer: {client_name}

A quick reply is all I need. I'll update the file on our end.

Thank you,
${SIG}`),
  mk("buyer", "Getting started", "earnest-client", "Earnest money reminder to the client", CLIENTS, US, "Earnest money for {property_address}",
`Hi {client_first_name},

A quick reminder about the earnest money on {property_address}. It's due to the title company within 3 days of the contract being accepted.

? - Amount: {earnest_money}
? - Deliver it to: {title_company}

Let me know once it's been sent and I'll confirm it arrived.

${SIG}`),
  mk("buyer", "Getting started", "trr-agent", "TRR due date to the agent", ["agent"], ["tc"], "TRR due date: {property_address}",
`Hi {agent_first_name},

The fully negotiated TRR on {property_address} is due [add the TRR due date].

? - Inspection period ends: {inspection_period_end}
? - Closing: {closing_when}

Let me know if anything changes.

${SIG}`),
  mk("buyer", "Inspection and appraisal", "inspection", "Inspection is scheduled", CLIENTS, US, "Inspection for {property_address}",
`Hi {client_first_name},

The inspection at {property_address} is set.

? - When: {inspection_when}
? - Inspection period ends: {inspection_period_end}

If you can be there, it's worth it: you'll see the home through the inspector's eyes and can ask questions as they go. I'll send you the report as soon as I have it.

${SIG}`),
  mk("buyer", "Inspection and appraisal", "repair-request", "Repair request to the listing agent", OTHER_SIDE, US, "Inspection response: {property_address}",
`Hi {other_agent_firsts},

Our inspection on {property_address} is complete. Here is what {client_first_name} would like addressed:

[list the requested repairs, or attach the request]

? - The inspection period ends {inspection_period_end}, so we'd appreciate your response before then.

Thank you,
${SIG}`),
  mk("buyer", "Inspection and appraisal", "missing-docs", "Missing documents from the listing agent", OTHER_SIDE, US, "Documents needed: {property_address}",
`Hi {other_agent_firsts},

To complete the file on {property_address}, we still need:

[list the missing documents]

Please send them when you can. I'll get our buyers' signatures right away.

Thank you,
${SIG}`),
  mk("buyer", "Inspection and appraisal", "docs-to-title", "Inspection reports and invoices to title", TITLE, US, "Documents for the file: {property_address}",
`Hello {title_greeting},

Attached for {property_address}: the DA, the termite report, all invoices and receipts for the inspections, the home warranty invoice (if applicable), and anything being billed to closing. All are PDFs.

[Attach the PDFs]

Please confirm you have everything, and let me know if you need anything else.

Thank you,
${SIG}`),
  mk("buyer", "Inspection and appraisal", "appraisal-update", "Appraisal update to the client", CLIENTS, US, "Appraisal: {property_address}",
`Hi {client_first_name},

An update on the appraisal for {property_address}.

? - Appraisal: {appraisal_date}

[add where it stands: ordered, scheduled, or completed and the value]

Call or text me with any questions.

${SIG}`, { skipCash: true }),
  mk("buyer", "Financing and title", "lender-appraisal", "Lender: appraisal ordered and due date", LENDER, US, "Appraisal on {property_address}",
`Hello {lender_greeting},

Can you confirm the appraisal has been ordered on {property_address} and let me know when the report is due?

? - Appraisal date on the contract: {appraisal_date}
? - Closing: {closing_when}

Thank you,
${SIG}`, { skipCash: true }),
  mk("buyer", "Financing and title", "lender-status", "Loan status check with the lender", LENDER, US, "Loan status: {client_name}, {property_address}",
`Hello {lender_greeting},

Can you give me a quick update on {client_name}'s loan for {property_address}?

? - Closing: {closing_when}

Please let me know where it stands and anything you still need from {client_first_name}. I'll get it to you quickly.

Thank you,
${SIG}`, { skipCash: true }),
  mk("buyer", "Financing and title", "title-status", "Ask title for an update", TITLE, US, "Status check: {property_address}",
`Hello {title_greeting},

Can you give me a quick update on {property_address}? Specifically:

- Title commitment and any items to clear
? - Anything you still need from {client_first_name}
? - Whether we're on track for closing on {closing_when}

Thank you,
${SIG}`),
  mk("buyer", "Financing and title", "commitment-survey", "Title commitment and survey to the client", CLIENTS, US, "Your title commitment and survey: {property_address}",
`Hi {client_first_name},

Attached are the title commitment and the survey for {property_address}. Please look them over and call or text me with any questions. Nothing here needs a signature from you.

[Attach the title commitment and survey]

${SIG}`),
  mk("buyer", "Closing", "closing-scheduled", "Closing scheduled", [...CLIENTS, "other_agent", "other_agent2"], ["agent", "tc", "title_processor"], "Closing scheduled: {property_address}",
`Hello all,

Closing on {property_address} is scheduled.

? - When: {closing_when}
? - Where: {title_company}

Please let me know right away if that doesn't work for you.

Thank you,
${SIG}`),
  mk("buyer", "Closing", "closing-details-title", "Confirm closing details with title", TITLE, US, "Closing details: {property_address}",
`Hello {title_greeting},

We're planning to close on {property_address}.

? - Date and time: {closing_when}

Can you confirm the time and location (or the remote closing arrangements) and what the buyers need to bring?

Thank you,
${SIG}`),
  mk("buyer", "Closing", "clear-to-close", "Clear to close", CLIENTS, ["agent", "tc", "title_processor"], "Clear to close: {property_address}",
`Hi {client_first_name},

Great news, we're clear to close on {property_address}!

? - Closing: {closing_when}
? - Where: {title_company}

Please avoid any big purchases or changes with your finances until after closing.

${SIG}`),
  mk("buyer", "Closing", "closing-week", "Closing week email to the client", CLIENTS, US, "Closing week: {property_address}",
`Hi {client_first_name},

Closing on {property_address} is this coming week.

? - When: {closing_when}
? - Where: {title_company}

What to bring: a government-issued photo ID. {title_company} will tell you how to get your funds there. A wire or cashier's check is usual. Please confirm wire instructions by phone before sending anything.

Also this week: schedule your utilities to switch to your name, and do your final walk-through.

${SIG}`),
  mk("buyer", "Closing", "settlement-request", "Request the settlement statement from title", TITLE, ["agent", "tc"], "Settlement statement: {property_address}",
`Hello {title_greeting},

Can you send the settlement statement for {property_address} when it's ready? I'll review it with {agent_first_name} before it goes to our buyers.

? - Closing: {closing_when}

Thank you,
${SIG}`),
  mk("buyer", "Closing", "settlement-client", "Closing details and settlement statement to the client", CLIENTS, US, "Your settlement statement: {property_address}",
`Hi {client_first_name},

Attached is the settlement statement for {property_address}, with the closing details.

? - Closing: {closing_when}
? - Where: {title_company}

Please look it over and call or text me with any questions before closing.

[Attach the settlement statement]

${SIG}`),
  mk("buyer", "Closing", "friday-update", "Friday update to the client", CLIENTS, US, "Friday update: {property_address}",
`Hi {client_first_name},

Here is where things stand on {property_address} this week.

Done this week:
[add what was completed]

Coming up:
? - Inspection period ends: {inspection_period_end}
? - Appraisal: {appraisal_date}
? - Closing: {closing_when}

Have a great weekend. Call or text me with any questions.

${SIG}`),
  mk("buyer", "After closing", "congratulations", "Congratulations after closing", CLIENTS, ["agent"], "Congratulations on {street}!",
`Hi {client_first_name},

Congratulations, it's officially yours! It was a pleasure working with you on {property_address}.

If you ever need anything, whether it's a recommendation for a contractor or help down the road, just reach out. And if you know anyone thinking about buying or selling, I'd be grateful for the introduction.

${SIG}`),
];

const SELLER = [
  mk("seller", "Getting started", "welcome", "Welcome and next steps", CLIENTS, US, "Your home is under contract: {property_address}",
`Hi {client_first_name},

Congratulations, {property_address} is officially under contract! I'm {my_name}, {my_role}, and I'll keep things moving and keep you posted at every step.

What happens next:
- The contract goes to the title company, and the buyer's earnest money goes to them too.
- The buyer's inspection and the lender's appraisal get scheduled. We'll let you know when so you can plan for access.
- Title works toward a closing date.

Key dates:
? - Inspection: {inspection_when}
? - Inspection period ends: {inspection_period_end}
? - Appraisal: {appraisal_date}
? - Closing: {closing_when}

Call or text me any time at {my_phone}.

${SIG}`),
  mk("seller", "Getting started", "contract-intro", "Contract intro to title, buyer's lender and co-agent", EVERYONE, US, "New contract: {property_address}",
`Hello everyone,

I'm {my_name}, {my_role}, and I'll be coordinating the file on {property_address}. The fully executed contract is attached.

? - Seller: {client_name}
? - Buyer: {other_party_name}
? - Purchase price: {price}
? - Earnest money: {earnest_money}
? - Closing: {closing_when}

Title: please open the file and confirm you've received the contract.
Lender: please confirm the buyer's loan is on track and tell me what you need from our side.
? {other_agent_firsts}: thank you for working with us. Please send anything for the file my way.

[Attach the fully executed contract]

Thank you,
${SIG}`),
  mk("seller", "Getting started", "client-info-title", "Client contact info to title", TITLE, US, "Seller contact information: {property_address}",
`Hello {title_greeting},

Here is our seller's contact information for {property_address}:

- Name: {client_name}
? - Email: {client_emails}
? - Phone: {client_phone}
- Forwarding address after closing: [add it if you have it]

Please reach out to them directly with anything you need, and copy me.

Thank you,
${SIG}`),
  mk("seller", "Getting started", "earnest-title", "Confirm the buyer's earnest money with title", TITLE, US, "Earnest money: {property_address}",
`Hello {title_greeting},

Can you confirm you've received the buyer's earnest money on {property_address}?

? - Amount: {earnest_money}

A quick reply is all I need. I'll update the file on our end.

Thank you,
${SIG}`),
  mk("seller", "Getting started", "trr-agent", "TRR due date to the agent", ["agent"], ["tc"], "TRR due date: {property_address}",
`Hi {agent_first_name},

The fully negotiated TRR on {property_address} is due [add the TRR due date].

? - Inspection period ends: {inspection_period_end}
? - Closing: {closing_when}

Let me know if anything changes.

${SIG}`),
  mk("seller", "Inspection and appraisal", "inspection", "Buyer's inspection is scheduled", CLIENTS, US, "Inspection at {property_address}",
`Hi {client_first_name},

The buyer's inspection at {property_address} is set.

? - When: {inspection_when}
? - Inspection period ends: {inspection_period_end}

Please make sure the inspector has access, the utilities are on, and any pets are secured. Most sellers plan to be away for a few hours. I'll tell you what the buyer asks for as soon as I hear.

${SIG}`),
  mk("seller", "Inspection and appraisal", "repair-response", "Inspection results and repair request to the seller", CLIENTS, ["agent"], "Buyer's inspection response: {property_address}",
`Hi {client_first_name},

The buyer's inspection on {property_address} is complete. Here is what they've asked for:

[summarize or attach the repair request]

? - The inspection period ends {inspection_period_end}, so we'll need to respond before then.

Let's talk through your options. We can agree, counter, or decline. Call or text me when you're ready.

${SIG}`),
  mk("seller", "Inspection and appraisal", "missing-docs", "Documents needed from the agent", ["agent"], ["tc"], "Documents needed: {property_address}",
`Hi {agent_first_name},

To complete the file on {property_address}, we still need:

[list the missing documents]

Please send them when you can, and I'll route them to {client_first_name} for signature.

Thank you,
${SIG}`),
  mk("seller", "Inspection and appraisal", "docs-to-title", "Invoices and documents to title", TITLE, US, "Documents for the file: {property_address}",
`Hello {title_greeting},

Attached for {property_address}: the DA, all invoices and receipts, and anything being billed to closing. All are PDFs.

[Attach the PDFs]

Please confirm you have everything, and let me know if you need anything else.

Thank you,
${SIG}`),
  mk("seller", "Inspection and appraisal", "appraisal-update", "Appraisal update to the client", CLIENTS, US, "Appraisal: {property_address}",
`Hi {client_first_name},

An update on the appraisal for {property_address}.

? - Appraisal: {appraisal_date}

If the appraiser needs to come through the home, I'll let you know the day and time. A tidy, well-lit home helps.

[add where it stands: ordered, scheduled, or completed and the value]

${SIG}`, { skipCash: true }),
  mk("seller", "Financing and title", "lender-appraisal", "Buyer's lender: appraisal ordered and due date", LENDER, US, "Appraisal on {property_address}",
`Hello {lender_greeting},

Can you confirm the appraisal has been ordered on {property_address} and let me know when the report is due?

? - Appraisal date on the contract: {appraisal_date}
? - Closing: {closing_when}

Thank you,
${SIG}`, { skipCash: true }),
  mk("seller", "Financing and title", "lender-status", "Loan status check with the buyer's lender", LENDER, US, "Loan status: {property_address}",
`Hello {lender_greeting},

Can you give me a quick update on the buyer's loan for {property_address}?

? - Closing: {closing_when}

Please let me know where it stands and anything you still need from the seller's side.

Thank you,
${SIG}`, { skipCash: true }),
  mk("seller", "Financing and title", "title-status", "Ask title for an update", TITLE, US, "Status check: {property_address}",
`Hello {title_greeting},

Can you give me a quick update on {property_address}? Specifically:

- Title commitment and any items to clear
? - Anything you still need from {client_first_name}
? - Whether we're on track for closing on {closing_when}

Thank you,
${SIG}`),
  mk("seller", "Financing and title", "commitment-survey", "Title commitment and survey to the seller", CLIENTS, US, "Title commitment and survey: {property_address}",
`Hi {client_first_name},

Attached are the title commitment and the survey for {property_address}. Please look them over and call or text me with any questions. If anything on them looks wrong, tell me before closing.

[Attach the title commitment and survey]

${SIG}`),
  mk("seller", "Closing", "closing-scheduled", "Closing scheduled (pre-signing, mail-out or notary)", CLIENTS, US, "Closing scheduled: {property_address}",
`Hi {client_first_name},

Closing on {property_address} is scheduled.

? - When: {closing_when}
? - Where: {title_company}

We can set it up a few ways: sign in person at closing, sign ahead of time (pre-signing), have the documents mailed to you, or use a notary near you. Which works best for you?

${SIG}`),
  mk("seller", "Closing", "closing-details-title", "Confirm closing details with title", TITLE, US, "Closing details: {property_address}",
`Hello {title_greeting},

We're planning to close on {property_address}.

? - Date and time: {closing_when}

Can you confirm the time and location (or the remote closing arrangements) and what the seller needs to bring or sign?

Thank you,
${SIG}`),
  mk("seller", "Closing", "clear-to-close", "Clear to close", CLIENTS, ["agent", "tc", "title_processor"], "Clear to close: {property_address}",
`Hi {client_first_name},

Great news, we're clear to close on {property_address}!

? - Closing: {closing_when}
? - Where: {title_company}

I'll send a reminder of what to do before closing day.

${SIG}`),
  mk("seller", "Closing", "closing-week", "Closing week email to the client", CLIENTS, US, "Closing week: {property_address}",
`Hi {client_first_name},

Closing on {property_address} is this coming week.

? - When: {closing_when}
? - Where: {title_company}

Before closing day:
- Bring a government-issued photo ID.
- Move out and leave the home clean and empty, unless we agreed otherwise.
- Leave all keys, garage remotes and any manuals for the buyer.
- Switch your utilities out of your name effective the closing date.
- Plan for your proceeds. A wire is usual, so confirm wire instructions by phone with {title_company}.

${SIG}`),
  mk("seller", "Closing", "settlement-request", "Request the settlement statement from title", TITLE, ["agent", "tc"], "Settlement statement: {property_address}",
`Hello {title_greeting},

Can you send the settlement statement for {property_address} when it's ready? I'll review it with {agent_first_name} before it goes to our seller.

? - Closing: {closing_when}

Thank you,
${SIG}`),
  mk("seller", "Closing", "settlement-client", "Closing details and settlement statement to the seller", CLIENTS, US, "Your settlement statement: {property_address}",
`Hi {client_first_name},

Attached is the settlement statement for {property_address}, with the closing details.

? - Closing: {closing_when}
? - Where: {title_company}

Please look it over, especially your net proceeds, and call or text me with any questions before closing.

[Attach the settlement statement]

${SIG}`),
  mk("seller", "Closing", "friday-update", "Friday update to the client", CLIENTS, US, "Friday update: {property_address}",
`Hi {client_first_name},

Here is where things stand on {property_address} this week.

Done this week:
[add what was completed]

Coming up:
? - Inspection period ends: {inspection_period_end}
? - Appraisal: {appraisal_date}
? - Closing: {closing_when}

Have a great weekend. Call or text me with any questions.

${SIG}`),
  mk("seller", "After closing", "congratulations", "Thank you after closing", CLIENTS, ["agent"], "Thank you, {client_first_name}",
`Hi {client_first_name},

{property_address} is officially closed. Thank you for trusting us with the sale. It was a pleasure working with you.

If you need anything down the road, or if you know anyone thinking about buying or selling, I'd be grateful for the introduction.

${SIG}`),
];

export const STARTER_TEMPLATES = [...BUYER, ...SELLER];

// ------------------------------------------------------------------------------------------------ email tasks
// The standard checklists have tasks that are an email ("Send Buyer Welcome and next steps email", "Send closing week email to Client"). Each rule
// matches a task by its wording and names the starter template (without the side) that belongs to it, so the task gets a one-click Email button on
// every deal, old or new, even if the wording was changed a little. A task can still be pointed at any template, or at none, by hand: a task's own
// email_template ("" = none, otherwise a template key or id) wins over the rules.
export const TASK_EMAIL_RULES = [
  [/welcome/i, "welcome"],
  [/intro email|contract to title/i, "contract-intro"],
  [/contact info.*title|client contact info/i, "client-info-title"],
  [/earnest money/i, "earnest-title"],
  [/lender.*appraisal|appraisal.*lender/i, "lender-appraisal"],
  [/trr due date/i, "trr-agent"],
  [/missing docs/i, "missing-docs"],
  [/send da\b|invoices.*title|title.*pdf/i, "docs-to-title"],
  [/status of the loan|follow up with the lender/i, "lender-status"],
  [/closing scheduled/i, "closing-scheduled"],
  [/commitment.*survey|survey.*commitment/i, "commitment-survey"],
  [/closing week/i, "closing-week"],
  [/closing or remote closing|confirm closing/i, "closing-details-title"],
  [/request settlement statement/i, "settlement-request"],
  [/settlement statement.*client|closing details.*settlement|send closing details/i, "settlement-client"],
  [/friday update/i, "friday-update"],
];

/** The starter template a task's wording points at for this side ("buyer" / "seller"), or null. */
export function autoEmailKey(side, taskText) {
  if (side !== "buyer" && side !== "seller") return null;
  const hit = TASK_EMAIL_RULES.find(([re]) => re.test(String(taskText || "")));
  return hit ? `${side}-${hit[1]}` : null;
}

/** The template key or id a task should offer: its own choice if it has one ("" means none), otherwise what its wording points at. */
export function taskEmailKey(task, side) {
  if (task && task.email_template === "") return null;
  if (task && task.email_template) return task.email_template;
  return autoEmailKey(side, task?.text);
}
