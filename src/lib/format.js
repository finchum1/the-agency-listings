export function formatPrice(value) {
  if (value === null || value === undefined || value === "") return "Price upon request";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export const STATUS_LABELS = {
  draft: "Draft",
  coming_soon: "Coming Soon",
  for_sale: "For Sale",
  pending: "Pending",
  closed: "Closed",
  off_market: "Off Market",
};

export const STATUS_COLORS = {
  draft: "#8a8a8a",
  coming_soon: "#8a7a5c",
  for_sale: "#1c7c4d",
  pending: "#b5860b",
  closed: "#9a3b3b",
  off_market: "#5a5a5a",
};

export function formatDateTime(isoString) {
  if (!isoString) return "";
  return new Date(isoString).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
