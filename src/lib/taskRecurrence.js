import { addDays, daysBetween, fromKey, toKey } from "./homeDates.js";

// Repeat choices for the home page tasks (agent_tasks.recurrence). Keep in step with the table's check constraint.
export const RECURRENCES = [
  { value: "none", label: "Doesn't repeat", short: "" },
  { value: "daily", label: "Every day", short: "Daily" },
  { value: "weekdays", label: "Every weekday", short: "Weekdays" },
  { value: "weekly", label: "Every week", short: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks", short: "Every 2 weeks" },
  { value: "monthly", label: "Every month", short: "Monthly" },
  { value: "quarterly", label: "Every 3 months", short: "Quarterly" },
  { value: "yearly", label: "Every year", short: "Yearly" },
];

const MONTH_STEPS = { monthly: 1, quarterly: 3, yearly: 12 };
const DAY_STEPS = { weekly: 7, biweekly: 14 };

// start + n months, but never spilling into the next month: Jan 31 + 1 month = Feb 28 (or 29), not Mar 3.
function addMonthsClamped(date, months) {
  const first = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  first.setDate(Math.min(date.getDate(), lastDay));
  return first;
}

/**
 * The next due date after completing a repeating task. Always lands strictly after both the current due date and
 * today, so finishing a task late (or early) never leaves a pile of missed copies behind. Monthly, quarterly and
 * yearly count from `seriesStart` (the date the repeat was set up on), so "the 31st" stays the 31st where it can.
 * Dates are YYYY-MM-DD strings.
 */
export function nextDue(rule, seriesStart, due, today) {
  const after = due && due > today ? due : today;
  const afterDate = fromKey(after);

  if (rule === "daily") return toKey(addDays(afterDate, 1));

  if (rule === "weekdays") {
    let d = addDays(afterDate, 1);
    while (d.getDay() === 0 || d.getDay() === 6) d = addDays(d, 1);
    return toKey(d);
  }

  const start = seriesStart || due || today;

  if (DAY_STEPS[rule]) {
    const step = DAY_STEPS[rule];
    const n = Math.max(1, Math.floor(daysBetween(start, after) / step) + 1);
    let candidate = toKey(addDays(fromKey(start), n * step));
    while (candidate <= after) candidate = toKey(addDays(fromKey(candidate), step));
    return candidate;
  }

  if (MONTH_STEPS[rule]) {
    const startDate = fromKey(start);
    for (let n = 1; n < 2400; n++) {
      const candidate = toKey(addMonthsClamped(startDate, n * MONTH_STEPS[rule]));
      if (candidate > after) return candidate;
    }
  }
  return null;
}
