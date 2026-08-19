import { formatPrice } from "../../lib/format";
import PillSelect from "./PillSelect";

// Pulled out of UpcomingListingsPage.jsx so the exact same markup can be
// fed either live Supabase rows (the real dashboard) or hardcoded sample
// rows (marketing screenshots — see pages/marketing/ModulePreview.jsx) —
// one source of truth for what this table looks like, not a hand-copied
// mockup that can drift from the real thing.
export default function UpcomingListingsTable({ rows, statusLabels, statusColors, canEdit, onStatusChange, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
            <th className="px-5 py-3 font-medium">Address / Area</th>
            <th className="px-5 py-3 font-medium">Beds / Baths / Sqft</th>
            <th className="px-5 py-3 font-medium">Est. Price</th>
            <th className="px-5 py-3 font-medium">Expected</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] align-top">
              <td className="px-5 py-4">
                <p className="font-medium">{row.address_line1 || row.city || "—"}</p>
                {(row.city || row.state) && (
                  <p className="text-xs text-[#1c1a17]/50">
                    {[row.city, row.state, row.zip].filter(Boolean).join(", ")}
                  </p>
                )}
                {row.notes && (
                  <p className="text-xs text-[#1c1a17]/50 mt-1 max-w-xs truncate" title={row.notes}>
                    {row.notes}
                  </p>
                )}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                {[row.beds != null ? `${row.beds} bd` : null, row.baths != null ? `${row.baths} ba` : null, row.sqft != null ? `${row.sqft.toLocaleString()} sqft` : null]
                  .filter(Boolean)
                  .join(" | ") || "—"}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                {row.price_estimate != null ? formatPrice(row.price_estimate) : "—"}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap text-xs">
                {row.expected_list_date
                  ? new Date(`${row.expected_list_date}T00:00:00`).toLocaleDateString()
                  : "—"}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                {row.agent?.full_name || "—"}
              </td>
              <td className="px-5 py-4">
                <PillSelect
                  value={row.status}
                  labels={statusLabels}
                  colors={statusColors}
                  disabled={!canEdit(row)}
                  onChange={(status) => onStatusChange(row.id, status)}
                />
              </td>
              <td className="px-5 py-4 text-right whitespace-nowrap">
                {canEdit(row) && (
                  <div className="flex items-center justify-end gap-3">
                    <button onClick={() => onEdit(row)} className="text-xs text-[#1c1a17]/60 hover:text-[#1c1a17]">
                      Edit
                    </button>
                    <button onClick={() => onDelete(row)} className="text-xs text-[#1c1a17]/40 hover:text-red-600">
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
