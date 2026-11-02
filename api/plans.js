// Vercel serverless function: runs follow-up plans.
//   GET  (the schedule, every 15 minutes; carries CRON_SECRET when one is set)  -> runs every step that is due, for everyone
//   POST { action: "run" } (a signed-in agent, when their dashboard opens or after they start a plan) -> runs their own due steps
import { authenticate, serviceClient } from "./_lib/authUser.js";
import { runPlans } from "./_lib/planRunner.js";

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method === "GET") {
      const secret = process.env.CRON_SECRET;
      if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: "Not allowed." });
      return res.status(200).json({ ran: await runPlans(serviceClient()) });
    }
    if (req.method === "POST") {
      const auth = await authenticate(req, res);
      if (!auth) return;
      return res.status(200).json({ ran: await runPlans(serviceClient(), { ownerId: auth.user.id }) });
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  } catch (err) {
    console.error("plans error:", err);
    return res.status(500).json({ error: "Couldn't run the plans." });
  }
}
