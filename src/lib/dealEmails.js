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
  { key: "title", label: "Title company", name: "title_company", email: "title_company_email" },
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
const when = (date, time) => [longDate(date), time && date ? `at ${clock(time)}` : ""].filter(Boolean).join(" ");

// ------------------------------------------------------------------------------------------------ merge fields
// [key, label shown in the editor and in "fill in" warnings, group]
export const MERGE_FIELDS = [
  ["client_first_name", "client first name(s)", "Client"],
  ["client_name", "client name(s)", "Client"],
  ["client_role", "buyer or seller", "Client"],
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
  ["financing_deadline", "financing deadline", "Dates"],
  ["closing_date", "closing date", "Dates"],
  ["closing_time", "closing time", "Dates"],
  ["closing_when", "closing date and time", "Dates"],
  ["title_company", "title company", "Other people"],
  ["title_processor", "title processor", "Other people"],
  ["title_greeting", "title contact first name", "Other people"],
  ["lender", "lender", "Other people"],
  ["loan_processor", "loan processor", "Other people"],
  ["lender_greeting", "lender contact first name", "Other people"],
  ["other_agent", "other agent", "Other people"],
  ["other_agent_firsts", "other agents' first names", "Other people"],
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
    financing_deadline: longDate(deal.financing_deadline),
    closing_date: longDate(deal.closing_date),
    closing_time: clock(deal.closing_time),
    closing_when: when(deal.closing_date, deal.closing_time),
    title_company: text(deal.title_company),
    title_processor: text(deal.title_processor_name),
    title_greeting: firstName(deal.title_processor_name) || text(deal.title_company),
    lender: text(deal.lender),
    loan_processor: text(deal.loan_processor_name),
    lender_greeting: firstName(deal.loan_processor_name) || text(deal.lender),
    other_agent: text(deal.other_agent),
    other_agent_firsts: joinNames([firstName(deal.other_agent), firstName(deal.other_agent2)]),
    other_side_firsts: joinNames([firstName(deal.other_agent), firstName(deal.other_agent2), firstName(deal.other_agent_tc_name)]),
    other_agent_tc: text(deal.other_agent_tc_name),
    my_name: text(me.name),
    my_first_name: firstName(me.name),
    my_phone: text(me.phone),
    my_email: text(me.email),
    my_role: imAgent ? (side ? `the ${side}'s agent` : "the agent") : agent.name ? `${text(agent.name)}'s transaction coordinator` : "the transaction coordinator",
    my_signature: [text(me.name), text(me.phone), text(me.email)].filter(Boolean).join("\n"),
    agent_name: text(agent.name),
    agent_first_name: firstName(agent.name),
    agent_phone: text(agent.phone),
    agent_email: text(agent.email),
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
function peopleFor(roles, deal, ctx) {
  const found = [];
  const noEmail = [];
  for (const key of roles || []) {
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
      else if (name || key === "client") noEmail.push(name ? `${role.label} (${name})` : role.label);
    }
  }
  return { found, noEmail };
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
const SIG = "{my_signature}";
const CLIENTS = ["client", "client2"];
const OTHER_SIDE = ["other_agent", "other_agent2", "other_agent_tc"];
const US = ["agent", "tc"];

export const STARTER_TEMPLATES = [
  {
    key: "welcome",
    name: "Welcome and what's next",
    side: "both",
    to_roles: CLIENTS,
    cc_roles: US,
    subject: "We're under contract: {property_address}",
    body: `Hi {client_first_name},

Congratulations, we're officially under contract on {property_address}! Here's what's coming up:

? - Inspection: {inspection_when}
? - Inspection period ends: {inspection_period_end}
? - Appraisal: {appraisal_date}
? - Financing deadline: {financing_deadline}
? - Closing: {closing_when}

I'll keep you posted at every step. If you have a question at any point, call or text me at {my_phone}.

${SIG}`,
  },
  {
    key: "title-intro",
    name: "Open the file with title",
    side: "both",
    to_roles: ["title", "title_processor"],
    cc_roles: US,
    subject: "New contract: {property_address}",
    body: `Hello {title_greeting},

We have a fully executed contract on {property_address} and would like to open the file with you.

? - {client_role}: {client_name}
? - Purchase price: {price}
? - Earnest money: {earnest_money}
? - Closing: {closing_when}

Please confirm you've received the contract and let me know what you need from us to get started. You can reach me at {my_phone}.

Thank you,
${SIG}`,
  },
  {
    key: "lender-intro",
    name: "Introduce the lender to the deal",
    side: "buyer",
    skipCash: true,
    to_roles: ["lender", "loan_processor"],
    cc_roles: US,
    subject: "{client_name}: {property_address}",
    body: `Hello {lender_greeting},

{client_name} is under contract on {property_address}. Here is the timeline so you can work back from it:

? - Contract date: {contract_date}
? - Appraisal: {appraisal_date}
? - Financing deadline: {financing_deadline}
? - Closing: {closing_when}

Could you confirm the loan is on track and let me know what you still need from {client_first_name}? I'll make sure it gets to you quickly.

Thank you,
${SIG}`,
  },
  {
    key: "other-side-intro",
    name: "Introduce myself to the other side",
    side: "both",
    to_roles: OTHER_SIDE,
    cc_roles: US,
    subject: "Contract on {property_address}",
    body: `Hi {other_side_firsts},

I'm {my_name}, {my_role}, on {property_address}. Thank you for working with us on this one.

? - Closing: {closing_when}

Please send anything for the file my way, and call me at {my_phone} if something comes up.

Thank you,
${SIG}`,
  },
  {
    key: "earnest-title",
    name: "Confirm earnest money with title",
    side: "both",
    to_roles: ["title", "title_processor"],
    cc_roles: US,
    subject: "Earnest money: {property_address}",
    body: `Hello {title_greeting},

Can you confirm you've received the earnest money on {property_address}?

? - Amount: {earnest_money}
? - {client_role}: {client_name}

A quick reply is all I need, and I'll update the file on our end.

Thank you,
${SIG}`,
  },
  {
    key: "earnest-client",
    name: "Earnest money reminder to the client",
    side: "buyer",
    to_roles: CLIENTS,
    cc_roles: US,
    subject: "Earnest money for {property_address}",
    body: `Hi {client_first_name},

A quick reminder about the earnest money on {property_address}.

? - Amount: {earnest_money}
? - Deliver it to: {title_company}

Let me know once it's been sent and I'll confirm it arrived.

${SIG}`,
  },
  {
    key: "inspection",
    name: "Inspection is scheduled",
    side: "both",
    to_roles: CLIENTS,
    cc_roles: US,
    subject: "Inspection for {property_address}",
    body: `Hi {client_first_name},

The inspection at {property_address} is set.

? - When: {inspection_when}
? - Inspection period ends: {inspection_period_end}

If you can be there, it's worth it: you'll see the home through the inspector's eyes and can ask questions as they go. I'll send you the report as soon as I have it.

${SIG}`,
  },
  {
    key: "repair-request",
    name: "Repair request to the other side",
    side: "buyer",
    to_roles: OTHER_SIDE,
    cc_roles: US,
    subject: "Inspection response: {property_address}",
    body: `Hi {other_agent_firsts},

Our inspection on {property_address} is complete. Here is what {client_first_name} would like addressed:

[list the requested repairs, or attach the request]

? - The inspection period ends {inspection_period_end}, so we'd appreciate your response before then.

Thank you,
${SIG}`,
  },
  {
    key: "appraisal",
    name: "Appraisal update",
    side: "both",
    skipCash: true,
    to_roles: CLIENTS,
    cc_roles: US,
    subject: "Appraisal: {property_address}",
    body: `Hi {client_first_name},

An update on the appraisal for {property_address}.

? - Appraisal: {appraisal_date}
? - Financing deadline: {financing_deadline}

[add where it stands: ordered, scheduled or completed]

Call or text me with any questions.

${SIG}`,
  },
  {
    key: "title-status",
    name: "Ask title for an update",
    side: "both",
    to_roles: ["title", "title_processor"],
    cc_roles: US,
    subject: "Status check: {property_address}",
    body: `Hello {title_greeting},

Can you give me a quick update on {property_address}? Specifically:

- Title commitment and any items to clear
? - Anything you still need from {client_first_name}
? - Whether we're on track for closing on {closing_when}

Thank you,
${SIG}`,
  },
  {
    key: "clear-to-close",
    name: "Clear to close",
    side: "both",
    to_roles: CLIENTS,
    cc_roles: ["agent", "tc", "title_processor"],
    subject: "Clear to close: {property_address}",
    body: `Hi {client_first_name},

Great news, we're clear to close on {property_address}!

? - Closing: {closing_when}
? - Where: {title_company}

I'll send a reminder of what to bring a day or two before. Until then, please avoid any big purchases or changes with your finances.

${SIG}`,
  },
  {
    key: "closing-reminder",
    name: "Closing day reminder",
    side: "both",
    to_roles: CLIENTS,
    cc_roles: US,
    subject: "Closing on {closing_date}: {property_address}",
    body: `Hi {client_first_name},

Closing on {property_address} is coming up.

? - When: {closing_when}
? - Where: {title_company}

Please bring a government-issued photo ID. If you're buying, ask {title_company} how to send your funds. A wire or cashier's check is usual, and please confirm wire instructions by phone before sending anything.

${SIG}`,
  },
  {
    key: "congratulations",
    name: "Congratulations after closing",
    side: "both",
    to_roles: CLIENTS,
    cc_roles: ["agent"],
    subject: "Congratulations on {street}!",
    body: `Hi {client_first_name},

Congratulations, it's officially yours! It was a pleasure working with you on {property_address}.

If you ever need anything, whether it's a recommendation for a contractor or help down the road, just reach out. And if you know anyone thinking about buying or selling, I'd be grateful for the introduction.

${SIG}`,
  },
];
