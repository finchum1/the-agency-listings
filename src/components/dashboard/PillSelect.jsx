// Generic version of StatusSelect.jsx's pill-styled <select> — that one
// is hardwired to the `listings` table's own STATUS_LABELS/STATUS_COLORS,
// so rather than bolt extra props onto a component two other files
// already depend on, this takes `labels`/`colors` directly. Used by
// UpcomingListingsPage.jsx and BuyerNeedsPage.jsx, each with their own
// status vocabulary.
export default function PillSelect({ value, labels, colors, onChange, disabled }) {
  const color = colors[value] || "#8a8a8a";

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ background: `${color}1a`, color }}
      className="text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {Object.entries(labels).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
