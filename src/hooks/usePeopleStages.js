import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { BOARDS } from "../lib/peopleStages";
import { useAuth } from "./useAuth";

const defaults = () => ({
  lead: [...BOARDS.lead.stages],
  pipeline: [...BOARDS.pipeline.stages],
  transaction: [...BOARDS.transaction.stages],
});

// Column names per board, with the agent's renames (people_settings)
// layered over the defaults. Renaming also rewrites people.stage for
// everyone currently in that column so nobody is orphaned.
export function usePeopleStages() {
  const { user } = useAuth();
  const [stages, setStages] = useState(defaults);

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
        setStages({ ...defaults(), ...data.stages });
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  // Returns an error message, or null on success.
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
      const { error: saveErr } = await supabase
        .from("people_settings")
        .upsert({ owner_id: user.id, stages: next, updated_at: new Date().toISOString() });
      if (saveErr) return saveErr.message;
      setStages(next);
      return null;
    },
    [stages, user?.id],
  );

  return { stages, renameStage };
}
