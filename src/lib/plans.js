// Follow-up plans: timed steps counted from the day someone enters a plan. Shared by the plan editor, the person card, the server that runs the steps
// (api/_lib/planRunner.js) and the AI connection tools. A step creates a to-do (`task`), a DRAFT message for the agent to send (`draft`; nothing is sent),
// or moves the person to another column (`move`).

export const STEP_TYPES = [
  { value: "task", label: "To-do for me" },
  { value: "draft", label: "Draft a message" },
  { value: "move", label: "Move to a column" },
];
export const CHANNELS = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "call", label: "Call notes" },
];

// What can go in a title, subject or message: {first_name} becomes the person's first name, and so on. Anything else in braces is left out.
export const MERGE_FIELDS = [
  ["first_name", "Their first name"],
  ["name", "Their full name"],
  ["property_address", "Their property, if known"],
  ["source", "Where they came from"],
  ["agent_first_name", "Your first name"],
  ["agent_name", "Your full name"],
  ["agent_phone", "Your phone number"],
];

export function renderTemplate(template, ctx) {
  return String(template || "")
    .replace(/\{(\w+)\}/g, (_, key) => (ctx[key] == null ? "" : String(ctx[key])))
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ {2,}/g, " ")
    .trim();
}

export const mergeContext = (person, owner) => {
  const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";
  return {
    first_name: first(person?.name),
    name: person?.name || "",
    property_address: person?.property_address || "",
    source: person?.source || "",
    agent_first_name: first(owner?.full_name),
    agent_name: owner?.full_name || "",
    agent_phone: owner?.phone || "",
  };
};

/** "Starts when someone is added from Website inquiry" and so on, for lists. */
export function startText(startsWhen) {
  const s = startsWhen || { type: "manual" };
  if (s.type === "source") return `Starts when someone is added from “${s.value}”`;
  if (s.type === "column") return `Starts when someone enters ${s.group === "pipeline" ? "Pipeline" : "Leads"} › ${s.stage}`;
  return "You start it yourself";
}

export const stepSummary = (step) => {
  if (step.type === "move") return `Move to ${step.group === "pipeline" ? "Pipeline" : "Leads"} › ${step.stage}`;
  if (step.type === "draft") return `${CHANNELS.find((c) => c.value === step.channel)?.label || "Message"} draft${step.subject ? `: ${step.subject}` : ""}`;
  return step.title || "To-do";
};

const fail = (message) => {
  throw new Error(message);
};

/** Checks a plan someone typed (or an AI wrote) and returns it cleaned up, or throws an Error saying what is wrong. */
export function cleanPlan(raw) {
  const name = String(raw?.name || "").trim().slice(0, 80);
  if (!name) fail("A plan needs a name.");
  const sw = raw?.starts_when || { type: "manual" };
  let starts_when = { type: "manual" };
  if (sw.type === "source") {
    if (!String(sw.value || "").trim()) fail("Say which source starts the plan.");
    starts_when = { type: "source", value: String(sw.value).trim().slice(0, 80) };
  } else if (sw.type === "column") {
    if (!["lead", "pipeline"].includes(sw.group) || !String(sw.stage || "").trim()) fail('A column start needs group ("lead" or "pipeline") and stage.');
    starts_when = { type: "column", group: sw.group, stage: String(sw.stage).trim().slice(0, 60) };
  } else if (sw.type && sw.type !== "manual") fail('starts_when.type must be "manual", "source" or "column".');
  const list = Array.isArray(raw?.steps) ? raw.steps : fail("A plan needs steps.");
  if (list.length < 1 || list.length > 20) fail("A plan has 1 to 20 steps.");
  let last = 0;
  const steps = list.map((s, i) => {
    const n = i + 1;
    const day = Number(s?.day);
    if (!Number.isInteger(day) || day < 0 || day > 730) fail(`Step ${n}: day must be a whole number from 0 to 730.`);
    if (day < last) fail(`Step ${n}: days must go up (this is day ${day} after day ${last}).`);
    last = day;
    if (s.type === "task") {
      const title = String(s.title || "").trim().slice(0, 200);
      if (!title) fail(`Step ${n}: a to-do needs a title.`);
      return { day, type: "task", title };
    }
    if (s.type === "draft") {
      if (!CHANNELS.some((c) => c.value === s.channel)) fail(`Step ${n}: channel must be text, email or call.`);
      const body = String(s.body || "").trim().slice(0, 2000);
      if (!body) fail(`Step ${n}: a draft needs a message.`);
      return { day, type: "draft", channel: s.channel, ...(s.channel === "email" ? { subject: String(s.subject || "").trim().slice(0, 150) } : {}), body };
    }
    if (s.type === "move") {
      if (!["lead", "pipeline"].includes(s.group) || !String(s.stage || "").trim()) fail(`Step ${n}: a move needs group ("lead" or "pipeline") and stage.`);
      return { day, type: "move", group: s.group, stage: String(s.stage).trim().slice(0, 60) };
    }
    return fail(`Step ${n}: type must be task, draft or move.`);
  });
  return { name, starts_when, steps };
}

const NEW_LEAD_TEXT =
  "Hi {first_name}, it's {agent_first_name}. Thanks for reaching out! I saw your message and I'd love to help. When's a good time for a quick call?";

export const STARTER_PLANS = [
  {
    key: "new-web-lead",
    name: "New web lead",
    description: "Answer a website inquiry within minutes, then stay in touch for a month.",
    starts_when: { type: "source", value: "Website inquiry" },
    steps: [
      { day: 0, type: "task", title: "Call {first_name} within 5 minutes" },
      { day: 0, type: "draft", channel: "text", body: NEW_LEAD_TEXT },
      { day: 1, type: "draft", channel: "email", subject: "Following up, {first_name}", body: "Hi {first_name},\n\nThanks again for reaching out. If you tell me a little about your timeline and what matters most, I'll send over a few options that fit.\n\nYou can reach me at {agent_phone} or just reply here.\n\n{agent_first_name}" },
      { day: 3, type: "task", title: "Second call attempt: {name}" },
      { day: 7, type: "draft", channel: "email", subject: "A quick update for you", body: "Hi {first_name},\n\nI wanted to check in. Is buying or selling still on your mind? If anything has changed, or if you'd like to see what's happening in the market right now, I'm happy to help.\n\n{agent_first_name}" },
      { day: 14, type: "draft", channel: "text", body: "Hi {first_name}, it's {agent_first_name}. Just checking in. Anything I can help you with?" },
      { day: 30, type: "move", group: "lead", stage: "Nurturing" },
    ],
  },
  {
    key: "open-house",
    name: "Open house follow-up",
    description: "Thank people who came through your open house and follow up while it's fresh.",
    starts_when: { type: "source", value: "Open house" },
    steps: [
      { day: 0, type: "draft", channel: "text", body: "Hi {first_name}, it's {agent_first_name}. Thanks so much for coming by today! Let me know if you have any questions about the home or the area." },
      { day: 1, type: "task", title: "Call {first_name} about the open house" },
      { day: 2, type: "draft", channel: "email", subject: "Thanks for stopping by", body: "Hi {first_name},\n\nIt was great meeting you at the open house. If you'd like to see similar homes, or talk through what you're looking for, just reply here or call me at {agent_phone}.\n\n{agent_first_name}" },
      { day: 10, type: "draft", channel: "text", body: "Hi {first_name}, it's {agent_first_name}. Still looking? I can send you a few new listings that match what you liked." },
    ],
  },
  {
    key: "check-in",
    name: "Slow-burn check-in",
    description: "A gentle touch every couple of months for people who aren't ready. You start it yourself.",
    starts_when: { type: "manual" },
    steps: [
      { day: 0, type: "draft", channel: "text", body: "Hi {first_name}, it's {agent_first_name}. Thinking of you! Let me know if anything changes with your plans." },
      { day: 60, type: "draft", channel: "email", subject: "Checking in", body: "Hi {first_name},\n\nIt's been a little while. How are things? If your plans have changed, or you'd like to know what your home is worth today, I'm always happy to help.\n\n{agent_first_name}" },
      { day: 120, type: "task", title: "Call {name} to check in" },
    ],
  },
];
