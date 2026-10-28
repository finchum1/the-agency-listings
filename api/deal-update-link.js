// A coordinator's private update on one deal, for the agent who owns it (see supabase/deal-update-links-and-tc-timeline.sql and
// src/pages/AgentUpdatePage.jsx).
//   GET /api/deal-update-link?token=du...  -> the deal's dates, tasks, documents and signatures, branded with the office and signed by
//                                             the coordinator who made the link
// No sign-in: the long random token in the link is the credential, compared only by its hash. It carries what an agent works from and
// nothing the client or another agent shouldn't see: no commission, no price.
import crypto from "node:crypto";
import { serviceClient } from "./_lib/authUser.js";
import { gatherDeal, summarize, todayKey } from "./_lib/dealUpdate.js";
import { effectiveDue } from "../src/lib/checklistDefaults.js";

const TOKEN = /^du[0-9a-f]{64}$/;

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  let admin;
  try {
    admin = serviceClient();
  } catch {
    return res.status(500).json({ error: "Server not configured." });
  }
  const token = String(req.query?.token || "");
  if (!TOKEN.test(token)) return res.status(404).json({ error: "This link isn't valid anymore." });
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  const { data: link } = await admin.from("deal_update_links").select("id, org_id, person_id, created_by, message, expires_at, revoked_at, view_count").eq("token_hash", hash).maybeSingle();
  if (!link || link.revoked_at || new Date(link.expires_at) < new Date()) return res.status(404).json({ error: "This link isn't valid anymore." });

  const data = await gatherDeal(admin, link.person_id);
  if (!data) return res.status(404).json({ error: "This link isn't valid anymore." });
  const [{ data: sender }, { data: org }] = await Promise.all([
    admin.from("profiles").select("full_name, title, license, phone, email, photo_url").eq("id", link.created_by).maybeSingle(),
    admin.from("organizations").select("id, slug, name, brand, address_line1, city, state, zip, disclaimer").eq("id", link.org_id).maybeSingle(),
  ]);
  await admin.from("deal_update_links").update({ last_viewed_at: new Date().toISOString(), view_count: (link.view_count || 0) + 1 }).eq("id", link.id);

  const { deal, owner, tasks, docs, sigs } = data;
  const today = todayKey();
  const s = summarize(data, today);
  const dates = { contract_date: deal.contract_date, inspection_date: deal.inspection_date, closing_date: deal.closing_date };
  const withDue = tasks.map((t) => ({ id: t.id, text: t.text, section: t.section, done: t.done, done_at: t.done_at, due: effectiveDue(t, dates) || null }));
  const byDue = (a, b) => (a.due || "9999").localeCompare(b.due || "9999");
  return res.status(200).json({
    today,
    expires_at: link.expires_at,
    message: link.message,
    sender: sender || null,
    agent: owner ? { full_name: owner.full_name } : null,
    org: org || null,
    deal: {
      name: deal.name,
      side: deal.side,
      stage: deal.stage,
      property_address: deal.property_address,
      compliance_status: deal.compliance_status,
      other_agent: deal.other_agent,
      title_company: deal.title_company,
      lender: deal.lender,
      contract_date: deal.contract_date,
      inspection_date: deal.inspection_date,
      inspection_time: deal.inspection_time,
      inspection_period_end: deal.inspection_period_end,
      appraisal_date: deal.appraisal_date,
      financing_deadline: deal.financing_deadline,
      is_cash: deal.is_cash,
      closing_date: deal.closing_date,
    },
    counts: { tasksDone: s.tasksDone, tasksTotal: s.tasksTotal, docsDone: s.docsDone, docsTotal: s.docsTotal },
    openTasks: withDue.filter((t) => !t.done).sort(byDue).slice(0, 60),
    doneTasks: withDue.filter((t) => t.done).sort((a, b) => (b.done_at || "").localeCompare(a.done_at || "")).slice(0, 10),
    docs: docs.map((d) => ({ text: d.text, done: d.done, review_status: d.review_status, review_note: d.review_note })),
    signatures: sigs.map((g) => ({ title: g.title, status: g.status, waiting_on: (g.recipients || []).filter((r) => r.signing_status === "NOT_SIGNED" && r.role !== "CC").map((r) => r.name || r.email) })),
  });
}
