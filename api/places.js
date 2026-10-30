// Vercel serverless function: address suggestions as an agent types a location. Signed-in agents only (so it is not an open proxy).
//   { q } -> { suggestions: [{ label }] }
import { authenticate } from "./_lib/authUser.js";
import { suggestPlaces } from "./_lib/places.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }
  res.setHeader("Cache-Control", "no-store");
  const auth = await authenticate(req, res);
  if (!auth) return;
  try {
    return res.status(200).json({ suggestions: await suggestPlaces(req.body?.q) });
  } catch (err) {
    // Suggestions are a convenience: a miss just means no list, never an error in the form.
    return res.status(200).json({ suggestions: [], unavailable: true });
  }
}
