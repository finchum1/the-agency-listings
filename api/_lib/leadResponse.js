// Speed to lead: what happens the moment a website inquiry is saved. The database files the visitor in People (a trigger); here the agent's active plans
// run their first steps right away (a task to call, a drafted text), and the alert email gets one-tap Call / Text / Email buttons pre-filled with the
// drafted reply, so answering takes one tap from the phone. Never throws: the alert must go out even if this fails.
import { SITE_ORIGIN } from "../../src/lib/seo.js";
import { renderTemplate } from "../../src/lib/plans.js";
import { runPlans } from "./planRunner.js";

const digits = (p) => String(p || "").replace(/[^\d+]/g, "");
const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";

export async function respondToNewLead(admin, { agentId, agentName, lead }) {
  const empty = { personId: null, actions: [], dashboardUrl: null };
  try {
    if (!admin || !agentId || !lead?.email) return empty;
    const escaped = lead.email.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: person } = await admin.from("people").select("id, name, email, phone, property_address").eq("owner_id", agentId).ilike("email", escaped).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!person) return empty;
    try {
      await runPlans(admin, { ownerId: agentId, personId: person.id });
    } catch (err) {
      console.error("Plans at lead arrival failed:", err);
    }
    const { data: drafts } = await admin.from("people_outreach").select("channel, subject, body").eq("person_id", person.id).eq("status", "draft").order("created_at", { ascending: false }).limit(6);
    const text = drafts?.find((d) => d.channel === "text");
    const mail = drafts?.find((d) => d.channel === "email");
    const ctx = { first_name: first(person.name), agent_first_name: first(agentName) };
    const textBody = text?.body || renderTemplate("Hi {first_name}, it's {agent_first_name}. Thanks for reaching out! When's a good time for a quick call?", ctx);
    const mailSubject = mail?.subject || "Thanks for reaching out";
    const mailBody = mail?.body || renderTemplate("Hi {first_name},\n\nThanks for reaching out. I'd love to help. When's a good time for a quick call?\n\n{agent_first_name}", ctx);

    const phone = digits(lead.phone || person.phone);
    const actions = [];
    if (phone) actions.push({ label: "Call", href: `tel:${phone}` }, { label: "Text", href: `sms:${phone}?&body=${encodeURIComponent(textBody)}` });
    actions.push({ label: "Email", href: `mailto:${person.email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}` });
    return { personId: person.id, actions, dashboardUrl: `${SITE_ORIGIN}/dashboard/people/leads?person=${person.id}` };
  } catch (err) {
    console.error("Lead response failed:", err);
    return empty;
  }
}
