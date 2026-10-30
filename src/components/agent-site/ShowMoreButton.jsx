// The "Show more" button under a list that is cut to a few items on a phone (see hooks/useShowMore.js). Draws nothing when there is nothing more.
export default function ShowMoreButton({ more, className = "" }) {
  if (!more.hasMore) return null;
  return (
    <div className={`mt-8 flex justify-center ${className}`}>
      <button
        type="button"
        onClick={more.showMore}
        className="border border-[var(--as-text)]/25 px-8 py-3 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] transition-colors hover:bg-[var(--as-text)] hover:text-[var(--as-bg)]"
      >
        Show more
      </button>
    </div>
  );
}
