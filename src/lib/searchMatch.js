// Simple "type to filter" matching for the dashboard lists: every word typed has to appear somewhere in the row's text
// (any order, any case), and a run of digits also matches a phone number written with dashes or spaces.
export function matchesSearch(parts, query) {
  const words = String(query || "").toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const text = parts.filter((p) => p !== null && p !== undefined && p !== "").map(String).join(" \n ").toLowerCase();
  const digits = text.replace(/\D/g, "");
  return words.every((w) => text.includes(w) || (/^\d{3,}$/.test(w) && digits.includes(w)));
}
