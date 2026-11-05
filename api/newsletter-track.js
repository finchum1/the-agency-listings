// Counts a newsletter open (the 1px picture at the end of the email) and a click (a link in it, sent through here first).
//   GET ?t=<token>&k=o                       the picture; records an open
//   GET ?t=<token>&k=c&u=<url>&s=<signature> records a click and sends the reader on to the url. The signature was made when the email was built, so this
//                                            can only forward to links that really were in that email (it is not an open redirect).
import { serviceClient } from "./_lib/authUser.js";
import { checkSignature } from "./_lib/newsletterSend.js";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

async function record(admin, token, kind, url) {
  const { data: send } = await admin.from("newsletter_sends").select("id, newsletter_id, owner_id, open_count, click_count, opened_at, clicked_at").eq("token", token).maybeSingle();
  if (!send) return;
  const now = new Date().toISOString();
  await admin.from("newsletter_events").insert({ send_id: send.id, newsletter_id: send.newsletter_id, owner_id: send.owner_id, kind, url: url || "" });
  if (kind === "open") await admin.from("newsletter_sends").update({ open_count: send.open_count + 1, opened_at: send.opened_at || now }).eq("id", send.id);
  else await admin.from("newsletter_sends").update({ click_count: send.click_count + 1, clicked_at: send.clicked_at || now, opened_at: send.opened_at || now }).eq("id", send.id);
}

export default async function handler(req, res) {
  const token = String(req.query?.t || "");
  const kind = req.query?.k === "c" ? "c" : "o";
  const valid = /^[a-f0-9]{32}$/.test(token);

  if (kind === "o") {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Content-Type", "image/gif");
    if (valid) {
      try {
        await record(serviceClient(), token, "open");
      } catch (err) {
        console.error("open tracking error:", err);
      }
    }
    return res.status(200).send(PIXEL);
  }

  const url = String(req.query?.u || "");
  if (!valid || !/^https?:\/\//i.test(url) || !checkSignature(token, url, String(req.query?.s || ""))) return res.status(400).send("This link isn't valid.");
  try {
    await record(serviceClient(), token, "click", url);
  } catch (err) {
    console.error("click tracking error:", err);
  }
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Location", url);
  return res.status(302).end();
}
