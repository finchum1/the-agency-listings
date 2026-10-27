import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BOARDS, DEFAULT_CADENCE } from "../lib/peopleStages";
import { useAuth } from "./useAuth";

const defaults = () => ({
  lead: [...BOARDS.lead.stages],
  pipeline: [...BOARDS.pipeline.stages],
  transaction: [...BOARDS.transaction.stages],
});

// Column names and order per board, with the agent's changes
// (people_settings.stages) layered over the defaults. Alongside the three
// lists, settings holds `transaction_closed` — which Transactions column
// means "closed" for the Overview's closed-deal totals, so adding or
// reordering columns can never silently change what counts as closed.
// Every mutation resolves to an error message, or null on success.
export function usePeopleStages() {
  const { user } = useAuth();
  const [stages, setStages] = useState(defaults);
  const [closedName, setClosedName] = useState(null);
  const [cadence, setCadenceState] = useState({}); // the agent's own per-column follow-up days; columns not in here use DEFAULT_CADENCE

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase
      .from("people_settings")
      .select("stages")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active || !data?.stages) return;
        const { transaction_closed, ...groups } = data.stages;
        setStages({ ...defaults(), ...groups });
        setClosedName(transaction_closed || null);
      });
    // Read on its own so a missing column can never take the board's columns down with it.
    supabase
      .from("people_settings")
      .select("cadence")
      .eq("owner_id", user.id)
      .maybeSingle()
      .then(({ data }) => active && data?.cadence && setCadenceState(data.cadence));
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Days between follow-ups for someone in this column, or null when the column has none.
  const cadenceFor = useCallback(
    (group, name) => {
      const own = cadence[group];
      if (own && Object.prototype.hasOwnProperty.call(own, name)) return own[name] || null;
      return DEFAULT_CADENCE[group]?.[name] || null;
    },
    [cadence],
  );

  const persistCadence = useCallback(
    async (next) => {
      const { error } = await supabase.from("people_settings").upsert({ owner_id: user.id, cadence: next, updated_at: new Date().toISOString() });
      if (error) return error.message;
      setCadenceState(next);
      return null;
    },
    [user?.id],
  );

  // days: a whole number 1-1095, or 0/null for "no follow-up cadence".
  const setCadence = useCallback(
    (group, name, days) => {
      const n = Math.max(0, Math.min(1095, Math.round(Number(days) || 0)));
      return persistCadence({ ...cadence, [group]: { ...(cadence[group] || {}), [name]: n } });
    },
    [cadence, persistCadence],
  );

  const txList = stages.transaction;
  const closedStage =
    closedName && txList.includes(closedName)
      ? closedName
      : txList.includes("Closed")
        ? "Closed"
        : txList[txList.length - 1];

  const persist = useCallback(
    async (nextStages, nextClosed) => {
      const payload = { ...nextStages };
      if (nextClosed) payload.transaction_closed = nextClosed;
      const { error } = await supabase
        .from("people_settings")
        .upsert({ owner_id: user.id, stages: payload, updated_at: new Date().toISOString() });
      if (error) return error.message;
      setStages(nextStages);
      if (nextClosed) setClosedName(nextClosed);
      return null;
    },
    [user?.id],
  );

  const renameStage = useCallback(
    async (group, oldName, newName) => {
      const name = newName.trim();
      if (!name || name === oldName) return null;
      if (stages[group].some((s) => s.toLowerCase() === name.toLowerCase() && s !== oldName)) {
        return `There's already a column called "${name}".`;
      }
      const next = { ...stages, [group]: stages[group].map((s) => (s === oldName ? name : s)) };
      // The database renames them without treating it as a move (a move resets follow-up dates to the column's cadence). If that function
      // isn't there yet, a plain update does the same job.
      let { error: moveErr } = await supabase.rpc("rename_people_stage", { p_group: group, p_old: oldName, p_new: name });
      if (moveErr && /rename_people_stage/.test(moveErr.message || "")) {
        ({ error: moveErr } = await supabase.from("people").update({ stage: name }).eq("owner_id", user.id).eq("stage_group", group).eq("stage", oldName));
      }
      if (moveErr) return moveErr.message;
      const err = await persist(next, group === "transaction" && oldName === closedStage ? name : closedStage);
      if (!err && cadence[group] && Object.prototype.hasOwnProperty.call(cadence[group], oldName)) {
        const { [oldName]: days, ...rest } = cadence[group];
        await persistCadence({ ...cadence, [group]: { ...rest, [name]: days } });
      } else if (!err && !cadence[group]?.hasOwnProperty?.(oldName) && DEFAULT_CADENCE[group]?.[oldName]) {
        // A renamed default column keeps its default cadence.
        await persistCadence({ ...cadence, [group]: { ...(cadence[group] || {}), [name]: DEFAULT_CADENCE[group][oldName] } });
      }
      return err;
    },
    [stages, closedStage, persist, cadence, persistCadence],
  );

  const addStage = useCallback(
    async (group, newName) => {
      const name = newName.trim();
      if (!name) return null;
      if (stages[group].some((s) => s.toLowerCase() === name.toLowerCase())) {
        return `There's already a column called "${name}".`;
      }
      return persist({ ...stages, [group]: [...stages[group], name] }, closedStage);
    },
    [stages, closedStage, persist],
  );

  const moveStage = useCallback(
    async (group, name, toIndex) => {
      const list = stages[group];
      const from = list.indexOf(name);
      if (from < 0 || toIndex < 0 || toIndex >= list.length || from === toIndex) return null;
      const next = [...list];
      next.splice(from, 1);
      next.splice(toIndex, 0, name);
      return persist({ ...stages, [group]: next }, closedStage);
    },
    [stages, closedStage, persist],
  );

  // peopleCount = everyone still in the column, archived included — a
  // column is only removable once it's truly empty.
  const removeStage = useCallback(
    async (group, name, peopleCount) => {
      if (stages[group].length <= 1) return "A board needs at least one column.";
      if (peopleCount > 0) {
        return `Move the ${peopleCount} ${peopleCount === 1 ? "person" : "people"} out of "${name}" first (archived people count too).`;
      }
      if (group === "transaction" && name === closedStage) {
        return `"${name}" is your closed-deals column — mark a different column as closed first.`;
      }
      return persist({ ...stages, [group]: stages[group].filter((s) => s !== name) }, closedStage);
    },
    [stages, closedStage, persist],
  );

  const setClosedStage = useCallback((name) => persist(stages, name), [stages, persist]);

  return { stages, closedStage, cadenceFor, setCadence, renameStage, addStage, moveStage, removeStage, setClosedStage };
}
