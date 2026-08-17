// Shared contact target for the two product deep-dive pages' CTAs.
// Sign-up is invite-only (see PRODUCT.md) — there's no self-serve signup
// flow, so a prospective agent's "yes" is a conversation, not a form.
// terrence.finchum@theagencyre.com is the professional address he
// publishes on his own agent site's Contact page, not a personal inbox.
const CONTACT_EMAIL = "terrence.finchum@theagencyre.com";

export function contactMailto(subject) {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}
