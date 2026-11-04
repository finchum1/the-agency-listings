import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { useOrg } from "../../context/OrgContext";
import AreasManager from "./AreasManager";

// The areas every NEW agent site in this organization starts with. Editing them changes only sites created afterwards: sites that already exist
// keep their own areas (each agent edits those in their own site editor).
export default function AreaTemplatesPage() {
  const { org } = useOrg();
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!org?.id) return;
    const { data, error: err } = await supabase.from("area_template_areas").select("*").eq("org_id", org.id).order("sort_order");
    if (err) setError(err.message);
    else setAreas(data || []);
    setLoading(false);
  }, [org?.id]);
  useEffect(() => {
    load();
  }, [load]);

  if (!org) return null;
  return (
    <div className="max-w-3xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-display font-semibold">Area templates</h1>
        <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
          The Areas of Expertise every new <strong>{org.brand?.admin_name || org.name}</strong> agent site starts with. Changes here only affect sites created
          after you save. Sites that already exist keep their own areas, and each agent edits those in their own site editor.
        </p>
      </div>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {loading ? (
        <p className="text-sm text-[#1c1a17]/50 dark:text-[#faf9f7]/50">Loading…</p>
      ) : (
        <AreasManager
          areas={areas}
          onChanged={load}
          table="area_template_areas"
          ownerColumn="org_id"
          ownerId={org.id}
          photoFolder={`area-templates-${org.id}`}
          title="Starting areas"
        />
      )}
    </div>
  );
}
