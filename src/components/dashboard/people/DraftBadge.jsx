// A small envelope pinned to the outer corner of a person's card: there's a message waiting for you to send or discard (drafted by
// your bot, see OutreachDrafts.jsx). Opening the person shows it.
export default function DraftBadge({ count }) {
  if (!count) return null;
  return (
    <span
      className="absolute -top-2 -right-2 z-10 inline-flex h-6 min-w-6 items-center justify-center gap-0.5 rounded-full bg-[#ed2127] px-1.5 text-white shadow-md shadow-black/25 ring-2 ring-[#f7f4ee] dark:ring-[#141414] pointer-events-none"
      title={`${count} draft message${count === 1 ? "" : "s"} waiting for you to send or discard`}
      role="img"
      aria-label={`${count} draft message${count === 1 ? "" : "s"} waiting for you`}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </svg>
      {count > 1 && <span className="text-[10px] font-bold leading-none">{count}</span>}
    </span>
  );
}
