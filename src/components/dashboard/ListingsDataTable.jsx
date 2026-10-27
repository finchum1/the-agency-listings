import { Link } from "react-router-dom";
import { formatPrice } from "../../lib/format";
import StatusSelect from "./StatusSelect";

// Pulled out of ListingsTable.jsx so the exact same markup can be reused
// for a marketing screenshot (see UpcomingListingsTable.jsx/
// BuyerNeedsTable.jsx for the same pattern already established there).
export default function ListingsDataTable({ rows, onStatusChange, domainChecks = {}, checking = false }) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
            <th className="px-5 py-3 font-medium">Address</th>
            <th className="px-5 py-3 font-medium">Agent</th>
            <th className="px-5 py-3 font-medium">Price</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Domain</th>
            <th className="px-5 py-3 font-medium">Updated</th>
            <th className="px-5 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((listing) => (
            <tr key={listing.id} className="border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
              <td className="px-5 py-4">
                <Link to={`/dashboard/listings/${listing.id}/edit`} className="font-medium hover:underline">
                  {listing.address_line1}
                </Link>
                <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">
                  {listing.city}, {listing.state} {listing.zip}
                </p>
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{listing.agent?.full_name || "—"}</td>
              <td className="px-5 py-4 text-[#1c1a17]/70 dark:text-[#faf9f7]/70">{formatPrice(listing.price)}</td>
              <td className="px-5 py-4">
                <StatusSelect value={listing.status} onChange={(status) => onStatusChange(listing.id, status)} />
              </td>
              <td className="px-5 py-4 text-xs">
                {listing.custom_domain ? (
                  (() => {
                    const check = domainChecks[listing.id];
                    const bad = check && check.status !== "ok";
                    return (
                      <div className="space-y-1">
                        <a
                          href={`https://${listing.custom_domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={bad ? check.label : check ? "Live: this domain is serving the property site" : "This property site has its own domain"}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-semibold hover:underline ${
                            bad
                              ? "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300"
                              : check
                                ? "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300"
                                : "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
                          }`}
                        >
                          {bad ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v8M12 18v.5" /></svg>
                          ) : check ? (
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
                          ) : (
                            <span className={`h-2 w-2 rounded-full bg-current ${checking ? "animate-pulse" : "opacity-40"}`} aria-hidden="true" />
                          )}
                          {listing.custom_domain}
                        </a>
                        {bad && <p className="max-w-[16rem] text-[11px] leading-snug text-red-700 dark:text-red-300">{check.label}</p>}
                      </div>
                    );
                  })()
                ) : (
                  <span className="text-[#1c1a17]/35 dark:text-[#faf9f7]/35">None</span>
                )}
              </td>
              <td className="px-5 py-4 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 text-xs">
                {new Date(listing.updated_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-4 text-right">
                <div className="flex items-center justify-end gap-2.5">
                  {listing.status !== "draft" && (
                    <a
                      href={`/listings/${listing.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full border border-[#ed2127] dark:border-[#f2454b] text-[#ed2127] dark:text-[#f2454b] text-[11px] font-semibold px-3 py-1 hover:bg-[#ed2127] dark:hover:bg-[#f2454b] hover:text-white dark:hover:text-white transition-colors"
                    >
                      View live
                    </a>
                  )}
                  <Link to={`/dashboard/listings/${listing.id}/analytics`} className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
                    Analytics
                  </Link>
                  <Link to={`/dashboard/listings/${listing.id}/edit`} className="text-xs text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">
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
