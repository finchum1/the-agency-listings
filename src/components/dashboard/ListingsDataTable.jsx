import { Link } from "react-router-dom";
import { formatPrice } from "../../lib/format";
import StatusSelect from "./StatusSelect";

// Pulled out of ListingsTable.jsx so the exact same markup can be reused
// for a marketing screenshot (see UpcomingListingsTable.jsx/
// BuyerNeedsTable.jsx for the same pattern already established there).
export default function ListingsDataTable({ rows, onStatusChange }) {
  return (
    <div className="bg-white border border-black/5 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/5 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40">
            <th className="px-5 py-3 font-medium">Address</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Price</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Updated</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((listing) => (
            <tr key={listing.id} className="border-b border-black/5 last:border-0 hover:bg-black/[0.02]">
              <td className="px-5 py-4">
                <Link to={`/dashboard/listings/${listing.id}/edit`} className="font-medium hover:underline">
                  {listing.address_line1}
                </Link>
                <p className="text-xs text-[#1c1a17]/50">
                  {listing.city}, {listing.state} {listing.zip}
                </p>
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70">{listing.agent?.full_name || "—"}</td>
              <td className="px-5 py-4 text-[#1c1a17]/70">{formatPrice(listing.price)}</td>
              <td className="px-5 py-4">
                <StatusSelect value={listing.status} onChange={(status) => onStatusChange(listing.id, status)} />
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/50 text-xs">
                {new Date(listing.updated_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4 text-right">
                <div className="flex items-center justify-end gap-3">
                  {listing.status !== "draft" && (
                    <a
                      href={`/listings/${listing.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#ed2127] hover:underline"
                    >
                      View live
                    </a>
                  )}
                  <Link to={`/dashboard/listings/${listing.id}/edit`} className="text-xs text-[#1c1a17]/60 hover:text-[#1c1a17]">
                    Edit
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
