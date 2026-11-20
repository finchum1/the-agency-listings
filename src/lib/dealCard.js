// What a deal card on the board says at a glance: is anything overdue, what is next, and how far along the checklist is. Pure, so the board and its tests read
// the same rules.
//   deal       the deal's people row (its key dates, side, stage)
//   progress   what useTransactionProgress knows about this deal: { tasks: { done, total }, docs, open: [{ text, anchor, offset_days, due_override }] }
//   today      "YYYY-MM-DD"
//   closed     whether the deal has reached the closed column
import { effectiveDue } from "./checklistDefaults.js";
import { buildTimeline } from "./timeline.js";

const day = (key) => new Date(`${key}T12:00:00`).getTime();
const daysBetween = (from, to) => Math.round((day(to) - day(from)) / 86400000);

/** "3d overdue", "Today", "Tomorrow", "In 4 days". */
export const whenText = (days) => (days < 0 ? `${-days}d overdue` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);

export function dealCardStatus(deal, progress, today, closed = false) {
  const tasks = progress?.tasks || { done: 0, total: 0 };
  if (closed) return { closed: true, health: "closed", overdue: 0, dueToday: 0, next: null, tasks };

  const candidates = [];
  let overdue = 0;
  let dueToday = 0;
  for (const t of progress?.open || []) {
    const due = effectiveDue(t, deal);
    if (!due) continue;
    const days = daysBetween(today, due);
    if (days < 0) overdue += 1;
    else if (days === 0) dueToday += 1;
    candidates.push({ text: t.text, days, date: due, kind: "task" });
  }
  // The key dates still ahead (the closing day too: when it is the next thing, the card says so instead of repeating it in a corner).
  const { milestones } = buildTimeline(deal, today);
  for (const m of milestones) if (m.state !== "done" && m.key !== "earnest_money_delivered") candidates.push({ text: m.label, days: m.days, date: m.date, kind: "date" });

  // The most urgent thing first: the oldest overdue task, then what is due today, then whatever comes soonest (a date wins a tie: it is fixed).
  candidates.sort((a, b) => a.days - b.days || (a.kind === "date" ? -1 : 1));
  const next = candidates[0] || null;
  const health = overdue > 0 ? "red" : dueToday > 0 || (next && next.days <= 2) ? "amber" : next ? "green" : "grey";
  return { closed: false, health, overdue, dueToday, next: next && { ...next, tone: next.days < 0 ? "red" : next.days <= 1 ? "amber" : "muted" }, tasks };
}
