import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BOARDS } from "../lib/peopleStages";
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
    return () => {
      active = false;
    };
  }, [user?.id]);

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
      const { error: moveErr } = await supabase
        .from("people")
        .update({ stage: name })
        .eq("stage_group", group)
        .eq("stage", oldName);
      if (moveErr) return moveErr.message;
      return persist(next, group === "transaction" && oldName === closedStage ? name : closedStage);
    },
    [stages, closedStage, persist],
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

  return { stages, closedStage, renameStage, addStage, moveStage, removeStage, setClosedStage };
}
