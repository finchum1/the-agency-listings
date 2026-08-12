// Fire-and-forget page-view beacon — never awaited by callers, never
// throws, never delays or blocks rendering. See api/track-view.js.
// `keepalive: true` lets the request finish even if the visitor
// immediately navigates away.
export function trackView(targetType, targetId) {
  if (!targetId) return;
  fetch("/api/track-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
    keepalive: true,
  }).catch(() => {});
}
