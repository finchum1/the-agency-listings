import { useMemo, useState } from "react";
import { dayLabel, toKey } from "../../../lib/homeDates";
import { lastContactLabel, relationshipLabel } from "../../../lib/contacts";
import { TagChip } from "./contacts/TagParts";
import { SIDE_TAGS } from "../../../lib/peopleSides";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const control = "rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const SORTS = {
  followup: ["Next follow-up", (a, b) => (a.next_follow_up || "9999").localeCompare(b.next_follow_up || "9999")],
  newest: ["Recently added", (a, b) => String(b.created_at).localeCompare(String(a.created_at))],
  contacted: ["Longest since contact", (a, b, info) => (info.get(a.id)?.lastContactedAt || "").localeCompare(info.get(b.id)?.lastContactedAt || "")],
  name: ["Name", (a, b) => a.name.localeCompare(b.name)],
  stage: ["Column", (a, b, _info, order) => (order.indexOf(a.stage) + 1 || 99) - (order.indexOf(b.stage) + 1 || 99)],
};

// A Leads or Pipeline board as a list, laid out like the Contacts list: who they are, where they are, relationship and tags, when you last
// talked and when you're due to again. Opening a row opens the same panel a board card does.
export default function ProspectsList({ own, stages, openDeal, info, tagById, cadenceFor, group, title }) {
  const [sort, setSort] = useState("followup");
  const today = toKey(new Date());
  const rows = useMemo(() => [...own].sort((a, b) => SORTS[sort][1](a, b, info, stages) || a.name.localeCompare(b.name)), [own, sort, info, stages]);

  const followUp = (p) =>
    p.next_follow_up ? (
      <span className={p.next_follow_up < today ? "font-semibold text-red-600 dark:text-red-400" : p.next_follow_up === today ? "font-semibold text-amber-700 dark:text-amber-400" : ""}>{dayLabel(p.next_follow_up, today)}</span>
    ) : (
      "–"
    );
  const contacted = (p) => {
    const c = info.get(p.id);
    return c?.lastContactedAt ? lastContactLabel({ last_contacted_at: c.lastContactedAt }) : "Never contacted";
  };
  const tags = (p) => (info.get(p.id)?.tagIds || []).map((id) => tagById.get(id)).filter(Boolean);
  const chips = (p, max) => {
    const t = tags(p);
    return (
      <span className="flex flex-wrap items-center gap-1">
        {t.slice(0, max).map((x) => (
          <TagChip key={x.id} tag={x} size="sm" />
        ))}
        {t.length > max && <span className={`text-[10px] ${muted}`}>+{t.length - max}</span>}
      </span>
    );
  };
  const side = (p) => (SIDE_TAGS[p.side] ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SIDE_TAGS[p.side].className}`}>{SIDE_TAGS[p.side].label}</span> : null);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label={`Sort ${title}`} className={control}>
          {Object.entries(SORTS).map(([k, [label]]) => (
            <option key={k} value={k}>
              Sort: {label}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-10 text-center">
          <p className={muted}>No one matches.</p>
        </div>
      ) : (
        <>
          <div className="hidden md:block rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/5 dark:border-white/10 text-left text-xs uppercase tracking-wider text-[#1c1a17]/40 dark:text-[#faf9f7]/40">
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-3 py-3 font-medium">Column</th>
                  <th className="px-3 py-3 font-medium">Relationship</th>
                  <th className="px-3 py-3 font-medium">Tags</th>
                  <th className="px-3 py-3 font-medium whitespace-nowrap">Last in touch</th>
                  <th className="px-5 py-3 font-medium whitespace-nowrap">Next follow-up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} onClick={() => openDeal(p.id)} className="cursor-pointer border-b border-black/5 dark:border-white/10 last:border-0 hover:bg-black/[0.02] dark:hover:bg-white/[0.04]">
                    <td className="px-5 py-3.5 min-w-[13rem]">
                      <p className="flex items-center gap-2 font-medium">
                        {p.name}
                        {side(p)}
                      </p>
                      <p className={`text-xs ${muted}`}>{[p.phone, p.email].filter(Boolean).join(" · ") || "No phone or email"}</p>
                    </td>
                    <td className="px-3 py-3.5 whitespace-nowrap text-xs">
                      {p.stage}
                      {cadenceFor(group, p.stage) ? <span className={muted}> · every {cadenceFor(group, p.stage)}d</span> : null}
                    </td>
                    <td className={`px-3 py-3.5 text-xs whitespace-nowrap ${muted}`}>{info.get(p.id) ? relationshipLabel(info.get(p.id).relationship) : "–"}</td>
                    <td className="px-3 py-3.5 max-w-[16rem]">{chips(p, 3)}</td>
                    <td className={`px-3 py-3.5 text-xs whitespace-nowrap ${muted}`}>{contacted(p)}</td>
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">{followUp(p)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="md:hidden space-y-2.5">
            {rows.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => openDeal(p.id)} className="block w-full rounded-2xl border border-black/5 dark:border-white/10 bg-white dark:bg-[#1a1a1a] p-4 text-left">
                  <div className="flex items-start justify-between gap-3">
                    <p className="flex items-center gap-2 font-medium leading-snug">
                      {p.name}
                      {side(p)}
                    </p>
                    <p className="shrink-0 text-xs">{followUp(p)}</p>
                  </div>
                  <p className={`mt-0.5 text-xs ${muted}`}>
                    {p.stage}
                    {info.get(p.id) ? ` · ${relationshipLabel(info.get(p.id).relationship)}` : ""} · {contacted(p) === "Never contacted" ? "Never contacted" : `Last in touch ${contacted(p).toLowerCase()}`}
                  </p>
                  {tags(p).length > 0 && <div className="mt-2">{chips(p, 3)}</div>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
