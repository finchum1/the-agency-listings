import { Link } from "react-router-dom";
import { formatPrice } from "../../lib/format";
import StatusSelect from "./StatusSelect";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const linkClass = "text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] whitespace-nowrap";

const ExternalIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="inline -mt-0.5 ml-0.5">
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);

// The listing's own web address, once it has one, with the result of the last live check (see ListingsTable.jsx).
function DomainBadge({ listing, check, checking }) {
  if (!listing.custom_domain) return null;
  const bad = check && check.status !== "ok";
  return (
    <div className="mt-1.5">
      <a
        href={`https://${listing.custom_domain}`}
        target="_blank"
        rel="noopener noreferrer"
        title={bad ? check.label : check ? "Live: this domain is serving the property site" : "This property site has its own domain"}
        className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold hover:underline ${
          bad
            ? "bg-red-100 dark:bg-red-400/15 text-red-800 dark:text-red-300"
            : check
              ? "bg-emerald-100 dark:bg-emerald-400/15 text-emerald-800 dark:text-emerald-300"
              : "bg-black/[0.06] dark:bg-white/10 text-[#1c1a17]/70 dark:text-[#faf9f7]/70"
        }`}
      >
        {bad ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true" className="shrink-0"><path d="M12 5v8M12 18v.5" /></svg>
        ) : check ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0"><path d="M5 12.5l4.5 4.5L19 7" /></svg>
        ) : (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${checking ? "animate-pulse" : "opacity-40"}`} aria-hidden="true" />
        )}
        <span className="truncate">{listing.custom_domain}</span>
      </a>
      {bad && <p className="mt-1 max-w-xs text-[11px] leading-snug text-red-700 dark:text-red-300">{check.label}</p>}
    </div>
  );
}

function Links({ listing, className = "" }) {
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      {listing.status !== "draft" && (
        <a href={`/listings/${listing.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#ed2127] dark:text-[#f2454b] hover:underline whitespace-nowrap">
          View site
          <ExternalIcon />
        </a>
      )}
      <Link to={`/dashboard/listings/${listing.id}/analytics`} className={linkClass}>
        Analytics
      </Link>
      <Link to={`/dashboard/listings/${listing.id}/edit`} className="text-xs font-semibold text-[#1c1a17] dark:text-[#faf9f7] hover:underline whitespace-nowrap">
        Edit
      </Link>
    </div>
  );
}

// Pulled out of ListingsTable.jsx so the exact same markup can be reused
// for a marketing screenshot (see UpcomingListingsTable.jsx/
// BuyerNeedsTable.jsx for the same pattern already established there).
// A table on wider screens; a stack of cards on phones, where a table's columns would crush each other.
export default function ListingsDataTable({ rows, onStatusChange, domainChecks = {}, checking = false }) {
  return (
    <>
      <div className="hidden md:block bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
              <th className="px-5 py-3 font-medium">Property</th>
              <th className="px-3 py-3 font-medium">Agent</th>
              <th className="px-3 py-3 font-medium">Price</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((listing) => (
              <tr key={listing.id} className="border-b border-black/5 dark:border-white/10 last:border-0 align-top hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                <td className="px-5 py-4 min-w-[15rem]">
                  <Link to={`/dashboard/listings/${listing.id}/edit`} className="font-medium hover:underline">
                    {listing.address_line1}
                  </Link>
                  <p className={`text-xs ${muted}`}>
                    {listing.city}, {listing.state} {listing.zip}
                    <span className="opacity-60"> · Updated {new Date(listing.updated_at).toLocaleDateString()}</span>
                  </p>
                  <DomainBadge listing={listing} check={domainChecks[listing.id]} checking={checking} />
                </td>
                <td className="px-3 py-4 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 whitespace-nowrap">{listing.agent?.full_name || "—"}</td>
                <td className="px-3 py-4 text-[#1c1a17]/70 dark:text-[#faf9f7]/70 whitespace-nowrap">{formatPrice(listing.price)}</td>
                <td className="px-3 py-3.5">
                  <StatusSelect value={listing.status} onChange={(status) => onStatusChange(listing.id, status)} />
                </td>
                <td className="px-5 py-4">
                  <Links listing={listing} className="justify-end" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden space-y-3">
        {rows.map((listing) => (
          <li key={listing.id} className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link to={`/dashboard/listings/${listing.id}/edit`} className="block font-medium leading-snug">
                  {listing.address_line1}
                </Link>
                <p className={`text-xs mt-0.5 ${muted}`}>
                  {listing.city}, {listing.state} {listing.zip}
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatPrice(listing.price)}</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
              <StatusSelect value={listing.status} onChange={(status) => onStatusChange(listing.id, status)} />
              {listing.agent?.full_name && <span className={`text-xs ${muted}`}>{listing.agent.full_name}</span>}
            </div>
            <DomainBadge listing={listing} check={domainChecks[listing.id]} checking={checking} />
            <div className="mt-3 flex items-center justify-between border-t border-black/5 dark:border-white/10 pt-3">
              <Links listing={listing} />
              <span className={`text-[11px] ${muted}`}>Updated {new Date(listing.updated_at).toLocaleDateString()}</span>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
