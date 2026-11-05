// Newsletters (see supabase/newsletters.sql, api/_lib/newsletterSend.js and src/lib/newsletterHtml.js).
//   GET  (the schedule, every 5 minutes; carries CRON_SECRET when one is set)  -> starts newsletters whose time has come, keeps sending the ones in progress
//   POST (a signed-in agent), with { action, id }:
//     "count"      { audience }       how many people that audience is right now (everyone who unsubscribed already left out)
//     "test"       { id }             sends the newsletter to the agent's own address only, marked [Test]
//     "send"       { id }             queues it for the whole audience and starts sending
//     "schedule"   { id, at }         sends it at that time (an ISO time at least a few minutes ahead)
//     "unschedule" { id }             takes a scheduled newsletter back to a draft
// A newsletter only ever goes to its owner's own contacts; the owner is read from the signed-in session, never from the request.
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { MAX_RECIPIENTS, buildEmail, dispatch, loadContext, resolveAudience, runNewsletters, startSending } from "./_lib/newsletterSend.js";

const hasContent = (n) => Array.isArray(n.blocks) && n.blocks.some((b) => b && b.type);

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const secret = process.env.CRON_SECRET;
      if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
      return res.status(200).json({ ran: await runNewsletters(serviceClient()) });
    }
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ error: "Method not allowed" });
    }
    const auth = await authenticate(req, res);
    if (!auth) return;
    const admin = serviceClient();
    const action = String(req.body?.action || "");

    if (action === "count") {
      const people = await resolveAudience(admin, auth.user.id, req.body?.audience);
      return res.status(200).json({ count: people.length, max: MAX_RECIPIENTS });
    }

    // Everything else is about one of this agent's own newsletters (read as them, so row-level security says who owns it).
    const { data: newsletter } = await auth.supabase.from("newsletters").select("*").eq("id", String(req.body?.id || "")).eq("owner_id", auth.user.id).maybeSingle();
    if (!newsletter) return res.status(404).json({ error: "Newsletter not found." });

    if (action === "unschedule") {
      await admin.from("newsletters").update({ status: "draft", scheduled_at: null }).eq("id", newsletter.id).eq("status", "scheduled");
      return res.status(200).json({ ok: true });
    }
    if (!["test", "send", "schedule"].includes(action)) return res.status(400).json({ error: "Unknown action." });
    if (newsletter.status !== "draft" && newsletter.status !== "scheduled") return res.status(409).json({ error: "That newsletter has already gone out." });
    if (!newsletter.subject.trim()) return res.status(400).json({ error: "Add a subject first." });
    if (!hasContent(newsletter)) return res.status(400).json({ error: "Add something to the newsletter first." });
    if (!process.env.RESEND_API_KEY) return res.status(502).json({ error: "Email isn't set up, so nothing was sent." });

    if (action === "test") {
      const ctx = await loadContext(admin, newsletter);
      if (!ctx.agent.email) return res.status(400).json({ error: "Your profile has no email address to send the test to." });
      const mail = buildEmail(ctx, newsletter, { token: "test", first: (ctx.agent.name || "").split(" ")[0], to: ctx.agent.email, test: true });
      const r = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify(mail) });
      if (!r.ok) return res.status(502).json({ error: "The email service refused the test." });
      return res.status(200).json({ ok: true, to: ctx.agent.email });
    }

    if (action === "schedule") {
      const at = new Date(String(req.body?.at || ""));
      if (Number.isNaN(at.getTime()) || at.getTime() < Date.now() + 4 * 60 * 1000) return res.status(400).json({ error: "Pick a time at least five minutes from now." });
      const people = await resolveAudience(admin, auth.user.id, newsletter.audience);
      if (people.length === 0) return res.status(400).json({ error: "There is nobody to send this to. Check who it goes to." });
      if (people.length > MAX_RECIPIENTS) return res.status(400).json({ error: `That is ${people.length} people. A single newsletter can go to ${MAX_RECIPIENTS}; narrow who it goes to.` });
      await admin.from("newsletters").update({ status: "scheduled", scheduled_at: at.toISOString() }).eq("id", newsletter.id).in("status", ["draft", "scheduled"]);
      return res.status(200).json({ ok: true, count: people.length });
    }

    // send now: queue everyone, then send the first part right here; the schedule finishes the rest.
    const count = await startSending(admin, newsletter);
    const started = { ...newsletter, status: "sending" };
    const result = await dispatch(admin, started, await loadContext(admin, started), { limit: 300, deadline: Date.now() + 35000 });
    return res.status(200).json({ ok: true, count, ...result });
  } catch (err) {
    console.error("newsletters error:", err);
    return res.status(500).json({ error: err.message || "Something went wrong." });
  }
}
