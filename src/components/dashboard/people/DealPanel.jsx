import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { BOARDS } from "../../../lib/peopleStages";
import TransactionModules from "./TransactionModules";
import DealCompliance, { ComplianceChip } from "./DealCompliance";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40 disabled:opacity-100 disabled:border-transparent disabled:px-0";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const TEXT = [["property_address", "Property"], ["other_agent", "Other agent"], ["title_company", "Title company"], ["lender", "Lender"]];
const DATES = [["contract_date", "Contract"], ["inspection_date", "Inspection"], ["appraisal_date", "Appraisal"], ["financing_deadline", "Financing deadline"], ["closing_date", "Closing"]];
const NUMBERS = [["price", "Price"], ["commission", "Commission"]];

// The deal as a coordinator or compliance sees it (the agent uses the People panel). A coordinator can edit the facts and
// work the checklists; compliance reads them, marks documents, and approves or sends the deal back.
export default function DealPanel({ deal, agentName, viewer, onClose, onChanged }) {
  const edit = viewer === "tc";
  const [form, setForm] = useState(() => toForm(deal));
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState(deal);
  const [tcNames, setTcNames] = useState([]);
  const [agentStages, setAgentStages] = useState(null); // the deal owner's own Deals column names
  useEffect(() => {
    supabase.rpc("deal_stage_names", { p_person: deal.id }).then(({ data }) => setAgentStages(data || null));
  }, [deal.id]);
  useEffect(() => {
    (async () => {
      const [{ data: per }, { data: wide }] = await Promise.all([
        supabase.from("deal_tcs").select("tc_id").eq("person_id", deal.id),
        supabase.from("deal_team").select("tc_id").eq("agent_id", deal.owner_id),
      ]);
      const ids = [...new Set([...(per || []), ...(wide || [])].map((r) => r.tc_id))];
      if (!ids.length) return setTcNames([]);
      const { data: profs } = await supabase.from("profiles").select("full_name").in("id", ids);
      setTcNames((profs || []).map((p) => p.full_name));
    })();
  }, [deal.id, deal.owner_id]);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && !e.defaultPrevented && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const refresh = async () => {
    const { data } = await supabase.from("people").select("*").eq("id", deal.id).single();
    if (data) setFresh(data);
    onChanged?.();
  };

  const save = async (changes) => {
    setError("");
    const { error: err } = await supabase.from("people").update(changes).eq("id", deal.id);
    if (err) setError(err.message);
    else onChanged?.();
  };
  const commit = (key, kind) => {
    const raw = form[key];
    const next = kind === "number" ? (raw === "" ? null : Number(raw)) : kind === "date" ? raw || null : raw.trim();
    const cur = fresh[key] ?? (kind === "text" ? "" : null);
    if (next === cur || (kind === "number" && Number(next) === Number(cur))) return;
    setFresh((f) => ({ ...f, [key]: next }));
    save({ [key]: next });
  };
  const bind = (key, kind) => ({
    value: form[key],
    disabled: !edit,
    onChange: (e) => setForm((f) => ({ ...f, [key]: e.target.value })),
    onBlur: () => edit && commit(key, kind),
  });

  const baseStages = agentStages || BOARDS.transaction.stages;
  const stages = baseStages.includes(fresh.stage) ? baseStages : [fresh.stage, ...baseStages];
  const side = fresh.side === "both" ? "" : fresh.side;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside className="h-full w-full lg:w-[60rem] max-w-full overflow-y-auto bg-white dark:bg-[#161616] shadow-2xl" aria-label={`Deal: ${fresh.name}`}>
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#161616]/95 backdrop-blur px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold truncate">{fresh.property_address || fresh.name}</h2>
              <ComplianceChip status={fresh.compliance_status} />
            </div>
            <p className={`mt-0.5 text-xs ${muted}`}>
              {fresh.property_address ? `${fresh.name} · ` : ""}
              {fresh.side === "buyer" ? "Buyer" : fresh.side === "seller" ? "Seller" : "Side not set"} · Agent {agentName || "unknown"}
              {tcNames.length > 0 && ` · TC ${tcNames.join(", ")}`}
              {!edit && " · Read only"}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50 hover:text-[#1c1a17] dark:hover:text-[#faf9f7]">✕</button>
        </div>

        <div className="@container space-y-8 px-5 py-6">
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="min-w-0 space-y-6">
              <DealCompliance person={fresh} viewer={viewer} onChanged={refresh} />
            </div>
            <section className="min-w-0 space-y-4">
              <h3 className="font-display text-base font-semibold">Details</h3>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelClass}>Client</label>
                  <p className="text-sm">{fresh.name}</p>
                </div>
                <div>
                  <label className={labelClass}>Phone / email</label>
                  <p className="text-sm break-words">{[fresh.phone, fresh.email].filter(Boolean).join(" · ") || "–"}</p>
                </div>
                <div>
                  <label className={labelClass}>Stage</label>
                  <select
                    value={fresh.stage}
                    disabled={!edit}
                    onChange={(e) => {
                      setFresh((f) => ({ ...f, stage: e.target.value }));
                      save({ stage: e.target.value });
                    }}
                    className={inputClass}
                  >
                    {stages.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </div>
                {NUMBERS.map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    {edit ? <input type="number" min="0" step="any" inputMode="decimal" {...bind(key, "number")} className={inputClass} /> : <p className="text-sm">{fresh[key] == null ? "–" : money.format(fresh[key])}</p>}
                  </div>
                ))}
                {TEXT.map(([key, label]) => (
                  <div key={key} className={key === "property_address" ? "sm:col-span-2" : ""}>
                    <label className={labelClass}>{label}</label>
                    {edit ? <input {...bind(key, "text")} className={inputClass} /> : <p className="text-sm">{fresh[key] || "–"}</p>}
                  </div>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {DATES.map(([key, label]) => (
                  <div key={key}>
                    <label className={labelClass}>{label}</label>
                    {edit ? (
                      <input
                        type="date"
                        value={form[key]}
                        onChange={(e) => {
                          setForm((f) => ({ ...f, [key]: e.target.value }));
                          const v = e.target.value || null;
                          setFresh((f) => ({ ...f, [key]: v }));
                          save({ [key]: v });
                        }}
                        className={inputClass}
                      />
                    ) : (
                      <p className="text-sm">{fresh[key] ? new Date(`${fresh[key]}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "–"}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
          <TransactionModules
            person={fresh}
            side={side}
            viewer={viewer}
            dates={{ contract_date: fresh.contract_date || "", inspection_date: fresh.inspection_date || "", closing_date: fresh.closing_date || "" }}
          />
        </div>
      </aside>
    </div>
  );
}

function toForm(p) {
  const f = {};
  for (const [k] of TEXT) f[k] = p[k] || "";
  for (const [k] of NUMBERS) f[k] = p[k] == null ? "" : String(p[k]);
  for (const [k] of DATES) f[k] = p[k] || "";
  return f;
}
