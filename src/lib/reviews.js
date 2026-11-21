// Asking for reviews: the message, the links that open it in the agent's own texting or email app, and a review as website testimonial text. Pure, shared by the
// Reviews page (components/dashboard/people/ReviewsPage.jsx). Nothing here sends anything: the agent presses Text or Email and sends it themselves.

import { renderTemplate } from "./plans.js";

export const DEFAULT_REVIEW_MESSAGE =
  "Hi {first_name}, it's {agent_first_name}. It was a pleasure helping you with your home! If you have a minute, would you share your experience in a quick Google review? It means a lot and helps other families find me: {review_link}\n\nThank you!";

export const REVIEW_MERGE_FIELDS = [
  ["first_name", "Their first name"],
  ["agent_first_name", "Your first name"],
  ["agent_name", "Your full name"],
  ["review_link", "Your Google review link"],
];

const first = (s) => String(s || "").trim().split(/\s+/)[0] || "";

/** The request for one person: the agent's own wording (or the default) with their name and review link filled in. */
export function reviewMessage({ template, contact, agent, link }) {
  return renderTemplate(String(template || "").trim() || DEFAULT_REVIEW_MESSAGE, {
    first_name: first(contact?.first_name) || first(contact?.company) || "there",
    agent_first_name: first(agent?.full_name),
    agent_name: agent?.full_name || "",
    review_link: link || "",
  });
}

/** A link that opens the texting app with the message ready (the `&` form works on iPhone and Android). */
export const smsHref = (phone, body) => `sms:${String(phone || "").replace(/[^\d+]/g, "")}?&body=${encodeURIComponent(body)}`;
export const mailtoHref = (email, subject, body) => `mailto:${encodeURIComponent(email || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** A review's words as the HTML a website testimonial holds (paragraphs kept, nothing else). */
export const testimonialHtml = (text) =>
  String(text || "")
    .split(/\n{2,}|\r\n\r\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

/** "Sam R." for a testimonial's byline when only a full name is known. */
export function bylineOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return parts[0] || "";
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const STATUS_LABEL = { to_ask: "To ask", asked: "Asked", received: "Got a review", skipped: "Skipped" };
export const isGoogleReviewLink = (url) => /^https:\/\/(g\.page\/|g\.co\/|search\.google\.com\/|www\.google\.com\/|maps\.app\.goo\.gl\/|goo\.gl\/|share\.google\/)/i.test(String(url || "").trim());
