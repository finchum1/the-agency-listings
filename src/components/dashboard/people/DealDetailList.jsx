const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
// "$5,000 · delivered to the title company Oct 27" / "$5,000 · not delivered yet" / "" when there is no amount and nothing delivered.
export function earnestLine(form, person) {
  const amount = money(form.earnest_money);
  if (!amount && !form.earnest_money_delivered) return "";
  const when = form.earnest_money_delivered && person?.earnest_money_delivered_at ? ` ${new Date(person.earnest_money_delivered_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : "";
  return [amount, form.earnest_money_delivered ? `delivered to the title company${when}` : "not delivered yet"].filter(Boolean).join(" · ");
}
export const money = (n) => (n == null || n === "" || Number.isNaN(Number(n)) ? "" : `$${Number(n).toLocaleString()}`);

// A deal's details as read-only text: only the fields that have something in them, so a half-filled deal doesn't show a wall of empty boxes.
// rows: [{ label, value, href?, wide? }]. `title` is the group's small heading.
export function DetailGroup({ title, rows }) {
  const shown = rows.filter((r) => r.value !== null && r.value !== undefined && String(r.value).trim() !== "");
  const hidden = rows.length - shown.length;
  return (
    <section className="min-w-0 space-y-2.5">
      <h4 className={`text-xs font-semibold uppercase tracking-wide ${muted}`}>{title}</h4>
      {shown.length === 0 ? (
        <p className={`text-sm ${muted}`}>Nothing filled in yet.</p>
      ) : (
        <dl className="grid gap-x-6 gap-y-3 @md:grid-cols-2">
          {shown.map((r) => (
            <div key={r.label} className={`min-w-0 ${r.wide ? "@md:col-span-2" : ""}`}>
              <dt className={`text-xs ${muted}`}>{r.label}</dt>
              <dd className="mt-0.5 break-words text-sm">
                {r.href ? (
                  <a href={r.href} className="underline decoration-black/25 dark:decoration-white/30 underline-offset-2 hover:decoration-current">
                    {r.value}
                  </a>
                ) : (
                  r.value
                )}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {hidden > 0 && shown.length > 0 && <p className={`text-[11px] ${muted}`}>{hidden} empty field{hidden === 1 ? "" : "s"} hidden. Press Edit to fill {hidden === 1 ? "it" : "them"} in.</p>}
    </section>
  );
}

export function EditToggle({ editing, onToggle }) {
  return (
    <button type="button" onClick={onToggle} className="rounded-full border border-black/15 dark:border-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10">
      {editing ? "Done" : "Edit"}
    </button>
  );
}
