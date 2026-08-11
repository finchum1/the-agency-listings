import { STATUS_COLORS, STATUS_LABELS } from "../../lib/format";

// Pill-styled <select>, adapted from tc-dashboard-web's DealModal
// pillSelectStyle pattern — background is the status color at low
// opacity, text is the full color, no border.
export default function StatusSelect({ value, onChange, disabled }) {
  const color = STATUS_COLORS[value] || "#8a8a8a";

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      style={{ background: `${color}1a`, color }}
      className="text-xs font-semibold rounded-full px-3 py-1.5 border-0 outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {Object.entries(STATUS_LABELS).map(([statusValue, label]) => (
        <option key={statusValue} value={statusValue}>
          {label}
        </option>
      ))}
    </select>
  );
}
