import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "../../../lib/supabaseClient";
import { useAuth } from "../../../hooks/useAuth";
import { useEmailTemplates } from "../../../hooks/useEmailTemplates";
import { EMAIL_GROUPS, gmailHref, mailtoHref, renderDealEmail, templatesForDeal } from "../../../lib/dealEmails";
import EmailTemplatesEditor from "./EmailTemplatesEditor";

const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = "block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1";
const primary = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5";
const ghost = "rounded-full border border-black/10 dark:border-white/15 text-sm font-medium px-4 py-2.5 hover:bg-black/[0.03] dark:hover:bg-white/[0.05]";
const list = (s) => String(s || "").split(/[,;\s]+/).map((a) => a.trim()).filter(Boolean);

function Modal({ title, wide, onClose, children }) {
  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 px-4" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-label={title} className={`w-full ${wide ? "max-w-3xl" : "max-w-2xl"} max-h-[92vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#1c1c1c] text-[#1c1a17] dark:text-[#faf9f7] p-5 shadow-2xl space-y-4`}>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 text-[#1c1a17]/50 dark:text-[#faf9f7]/50">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

// The email, filled in from the deal and still editable. Nothing is sent from here: it opens in your own email app (or Gmail), or you copy it.
function Preview({ template, deal, ctx, onClose }) {
  const first = useMemo(() => renderDealEmail(template, deal, ctx), [template, deal, ctx]);
  const [to, setTo] = useState(first.to.join(", "));
  const [cc, setCc] = useState(first.cc.join(", "));
  const [subject, setSubject] = useState(first.subject);
  const [body, setBody] = useState(first.body);
  const [copied, setCopied] = useState(false);
  const email = { to: list(to), cc: list(cc), subject, body };
  const href = mailtoHref(email);
  const blanks = [...new Set([...subject.matchAll(/\[([^\]]+)\]/g), ...body.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]))];

  const copy = async () => {
    const all = [`To: ${email.to.join(", ")}`, email.cc.length ? `Cc: ${email.cc.join(", ")}` : "", `Subject: ${subject}`, "", body].filter((l, i) => l || i > 1).join("\n");
    try {
      await navigator.clipboard.writeText(all);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this email:", all);
    }
  };

  return (
    <Modal title={template.name} onClose={onClose}>
      {(first.noEmail.length > 0 || blanks.length > 0) && (
        <div className="space-y-1 rounded-xl bg-amber-50 dark:bg-amber-400/10 px-3.5 py-2.5 text-sm text-amber-900 dark:text-amber-200">
          {first.noEmail.length > 0 && <p>No email address yet for: {first.noEmail.join(", ")}. Add them in the deal's Details, or type one below.</p>}
          {blanks.length > 0 && <p>Still to fill in: {blanks.map((b) => `[${b}]`).join(", ")}.</p>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className={labelClass}>To</label>
          <input value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} placeholder="name@example.com" />
        </div>
        <div>
          <label className={labelClass}>Cc</label>
          <input value={cc} onChange={(e) => setCc(e.target.value)} className={inputClass} />
        </div>
      </div>
      <div>
        <label className={labelClass}>Subject</label>
        <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Message</label>
        <textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} className={`${inputClass} leading-relaxed`} />
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        <a href={href} onClick={onClose} className={`${primary} ${email.to.length === 0 ? "opacity-60" : ""}`}>Open in my email app</a>
        <a href={gmailHref(email)} target="_blank" rel="noreferrer" className={ghost}>Open in Gmail</a>
        <button type="button" onClick={copy} className={ghost}>{copied ? "Copied" : "Copy"}</button>
      </div>
      {href.length > 1900 && <p className={`text-xs ${muted}`}>This one is long. If your email app cuts it off, use Gmail or Copy instead.</p>}
      <p className={`text-xs ${muted}`}>Nothing is sent from here. You'll review it in your email app first, and it goes from your own address.</p>
    </Modal>
  );
}

// Everything a deal needs to email from a template: the person's templates, who is on the deal (its agent and coordinators, looked up the first time
// one is used), and the preview window. `launch(template)` opens the filled-in email; render `element` once somewhere in the component.
export function useDealEmail(deal) {
  const { profile } = useAuth();
  const tpl = useEmailTemplates();
  const [picked, setPicked] = useState(null);
  const [wanted, setWanted] = useState(false);
  const [people, setPeople] = useState(null); // { agent, coordinators } for this deal

  useEffect(() => {
    if (!wanted) return undefined;
    let live = true;
    (async () => {
      const [{ data: agent }, { data: per }, { data: wide }] = await Promise.all([
        supabase.from("profiles").select("full_name, email, phone, org_id").eq("id", deal.owner_id).maybeSingle(),
        supabase.from("deal_tcs").select("tc_id").eq("person_id", deal.id),
        supabase.from("deal_team").select("tc_id").eq("agent_id", deal.owner_id),
      ]);
      const ids = [...new Set([...(per || []), ...(wide || [])].map((r) => r.tc_id))];
      const { data: tcs } = ids.length ? await supabase.from("profiles").select("full_name, email").in("id", ids) : { data: [] };
      const { data: org } = agent?.org_id ? await supabase.from("organizations").select("name").eq("id", agent.org_id).maybeSingle() : { data: null };
      if (live) setPeople({ agent: { name: agent?.full_name || "", email: agent?.email || "", phone: agent?.phone || "", company: org?.name || "" }, coordinators: (tcs || []).map((t) => ({ name: t.full_name || "", email: t.email || "" })) });
    })();
    return () => {
      live = false;
    };
  }, [wanted, deal.id, deal.owner_id]);

  const ctx = useMemo(() => (people ? { me: { name: profile?.full_name || "", email: profile?.email || "", phone: profile?.phone || "" }, ...people } : null), [people, profile]);
  const find = (key) => tpl.templates.find((t) => t.key === key || t.id === key) || null;
  const forDeal = useMemo(() => templatesForDeal(tpl.templates, deal), [tpl.templates, deal]);
  const element = picked && ctx ? <Preview key={picked.key} template={picked} deal={deal} ctx={ctx} onClose={() => setPicked(null)} /> : null;
  return { tpl, find, forDeal, ready: !!ctx, prepare: () => setWanted(true), launch: (template) => { setWanted(true); setPicked(template); }, element };
}

// An "Email" button for a deal: pick a template and it fills out from the deal and addresses the right people.
//   deal   the deal's current values (a row from people)
export default function DealEmailButton({ deal }) {
  const mail = useDealEmail(deal);
  const [menu, setMenu] = useState(false);
  const [managing, setManaging] = useState(false);
  const groups = useMemo(() => {
    const out = EMAIL_GROUPS.map((g) => [g, mail.forDeal.filter((t) => t.starter && t.group === g)]);
    out.push(["My templates", mail.forDeal.filter((t) => !t.starter)]);
    return out.filter(([, list]) => list.length);
  }, [mail.forDeal]);

  return (
    <div className="relative">
      <button type="button" onClick={() => { setMenu((v) => !v); mail.prepare(); }} aria-haspopup="menu" aria-expanded={menu} className="inline-flex items-center gap-1.5 rounded-full border border-black/10 dark:border-white/15 px-4 py-2 text-sm font-medium hover:bg-black/[0.03] dark:hover:bg-white/[0.05]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3.5 7l8.5 6 8.5-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Email with a template
      </button>
      {menu && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setMenu(false)} className="fixed inset-0 z-[55] cursor-default" />
          <div role="menu" className="absolute left-0 z-[60] mt-1 w-80 max-h-[65vh] overflow-y-auto rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1f1f1f] text-[#1c1a17] dark:text-[#faf9f7] py-1 shadow-xl">
            {groups.map(([group, list]) => (
              <div key={group}>
                <p className={`px-3.5 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide ${muted}`}>{group}</p>
                {list.map((t) => (
                  <button
                    key={t.id || t.key}
                    type="button"
                    role="menuitem"
                    disabled={!mail.ready}
                    onClick={() => {
                      setMenu(false);
                      mail.launch(t);
                    }}
                    className="block w-full px-3.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            ))}
            <div className="my-1 border-t border-black/10 dark:border-white/10" />
            <button type="button" role="menuitem" onClick={() => { setMenu(false); setManaging(true); }} className={`block w-full px-3.5 py-2 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${muted}`}>
              Edit templates…
            </button>
          </div>
        </>
      )}
      {mail.element}
      {managing && (
        <Modal title="Email templates" wide onClose={() => setManaging(false)}>
          <EmailTemplatesEditor tpl={mail.tpl} />
        </Modal>
      )}
    </div>
  );
}
