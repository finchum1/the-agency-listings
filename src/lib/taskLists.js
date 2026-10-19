// Small helpers for a task's list label and its checklist steps ([{ id, text, done }]).
export const LIST_SUGGESTIONS = ["Clients", "Listings", "Marketing", "Admin", "Personal"];
export const MAX_STEPS = 50;

export const newStepId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`);

/** Steps ready to save: trimmed text, blanks dropped, a stable id on each, capped. */
export const cleanSteps = (steps) =>
  (steps || [])
    .map((s) => ({ id: s.id || newStepId(), text: String(s.text || "").trim().slice(0, 200), done: Boolean(s.done) }))
    .filter((s) => s.text)
    .slice(0, MAX_STEPS);

export const cleanList = (list) => {
  const v = String(list || "").trim().slice(0, 40);
  return v || null;
};

/** { done, total } for a task's steps, or null when it has none. */
export const stepProgress = (task) => {
  const steps = Array.isArray(task.checklist) ? task.checklist : [];
  return steps.length ? { done: steps.filter((s) => s.done).length, total: steps.length } : null;
};

/** The distinct list labels across tasks, most used first. */
export function listsOf(tasks) {
  const counts = new Map();
  for (const t of tasks) if (t.list) counts.set(t.list, (counts.get(t.list) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name]) => name);
}
