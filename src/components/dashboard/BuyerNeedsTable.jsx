import { formatPrice } from "../../lib/format";
import PillSelect from "./PillSelect";

// See UpcomingListingsTable.jsx's same comment — pulled out of
// BuyerNeedsSection.jsx so real dashboard rows and hardcoded marketing
// sample rows render through the exact same markup.
export default function BuyerNeedsTable({ rows, statusLabels, statusColors, canEdit, onStatusChange, onEdit, onDelete }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
            <th className="px-5 py-3 font-medium">Buyer</th>
            <th className="px-5 py-3 font-medium">Budget</th>
            <th className="px-5 py-3 font-medium">Min Beds / Baths</th>
            <th className="px-5 py-3 font-medium">Areas</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02] align-top">
              <td className="px-5 py-4">
                <p className="font-medium">{row.buyer_name}</p>
                {row.buyer_contact && <p className="text-xs text-[#1c1a17]/50">{row.buyer_contact}</p>}
                {row.notes && (
                  <p className="text-xs text-[#1c1a17]/50 mt-1 max-w-xs truncate" title={row.notes}>
                    {row.notes}
                  </p>
                )}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                {row.min_price != null || row.max_price != null
                  ? `${row.min_price != null ? formatPrice(row.min_price) : "Any"} – ${
                      row.max_price != null ? formatPrice(row.max_price) : "Any"
                    }`
                  : "—"}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 whitespace-nowrap">
                {[row.min_beds != null ? `${row.min_beds}+ bd` : null, row.min_baths != null ? `${row.min_baths}+ ba` : null]
                  .filter(Boolean)
                  .join(" | ") || "—"}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 max-w-[14rem] truncate" title={row.areas}>
                {row.areas || "—"}
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
