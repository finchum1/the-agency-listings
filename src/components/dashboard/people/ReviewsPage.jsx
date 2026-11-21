import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../../lib/supabaseClient";
import { refreshAuth, useAuth } from "../../../hooks/useAuth";
import { usePeopleStages } from "../../../hooks/usePeopleStages";
import { fullName } from "../../../lib/contacts";
import { DEFAULT_REVIEW_MESSAGE, REVIEW_MERGE_FIELDS, STATUS_LABEL, bylineOf, isGoogleReviewLink, mailtoHref, reviewMessage, smsHref, testimonialHtml } from "../../../lib/reviews";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const card = "rounded-2xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-5";
const control = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const ghost = "rounded-full border border-black/15 dark:border-white/20 px-3.5 py-1.5 text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/10";
const solid = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50";
const when = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "");
const Stars = ({ n }) => <span aria-label={`${n} out of 5`} className="text-amber-500">{"★".repeat(n)}<span className="opacity-25">{"★".repeat(5 - n)}</span></span>;

// Where the agent's Google review link and wording live.
function Setup({ profile, onSaved }) {
  const [url, setUrl] = useState(profile?.review_url || "");
  const [message, setMessage] = useState(profile?.review_message || "");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const clean = url.trim();
  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("profiles").update({ review_url: clean, review_message: message.trim() === DEFAULT_REVIEW_MESSAGE ? "" : message.trim() }).eq("id", profile.id);
    setSaving(false);
    if (err) return setError(/review_url/.test(err.message) ? "That needs to be a full link starting with https://" : err.message);
    setNote("Saved");
    refreshAuth();
    onSaved?.();
  };
  return (
    <form onSubmit={save} className={`${card} space-y-3`}>
      <div>
        <h2 className="font-display text-lg font-semibold">Your review link and message</h2>
        <p className={`text-sm ${muted}`}>
          {profile?.review_url ? "Every closing you make adds a review request to the list below, ready to send." : "Add your Google review link and closings will start adding review requests to the list below."} Nothing is ever sent for you.
        </p>
      </div>
      <label className="block text-xs font-medium">
        Google review link
        <input value={url} onChange={(e) => { setUrl(e.target.value); setNote(""); }} placeholder="https://g.page/r/…/review" inputMode="url" className={`${control} mt-1`} />
        <span className={`mt-1 block text-[11px] font-normal ${muted}`}>In your Google Business Profile, choose "Ask for reviews" and copy the link.</span>
        {clean && !isGoogleReviewLink(clean) && <span className="mt-1 block text-[11px] font-normal text-amber-700 dark:text-amber-400">That doesn't look like a Google link. It will still work if it opens your review page.</span>}
      </label>
      <label className="block text-xs font-medium">
        The message
        <textarea value={message || DEFAULT_REVIEW_MESSAGE} onChange={(e) => { setMessage(e.target.value); setNote(""); }} rows={5} maxLength={1000} className={`${control} mt-1`} />
        <span className={`mt-1 block text-[11px] font-normal ${muted}`}>
          You can use {REVIEW_MERGE_FIELDS.map(([k]) => `{${k}}`).join(", ")}.{" "}
          {message && message !== DEFAULT_REVIEW_MESSAGE && <button type="button" onClick={() => setMessage("")} className="underline">Use the standard wording</button>}
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className={solid}>{saving ? "Saving…" : "Save"}</button>
        {note && <span className={`text-sm ${muted}`} aria-live="polite">{note}</span>}
        {error && <span role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</span>}
      </div>
    </form>
  );
}

// One person on the list: what to do next with them.
function Row({ r, contact, deal, message, site, onChange, onError }) {
  const [form, setForm] = useState(null); // the "they left a review" form
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = fullName(contact || {});
  const noContact = contact?.do_not_contact;
  const update = async (patch, note) => {
    setBusy(true);
    onError("");
    const { error } = await supabase.from("contact_reviews").update(patch).eq("id", r.id);
    if (!error && note) await supabase.from("contact_notes").insert({ contact_id: r.contact_id, kind: "other", body: note });
    setBusy(false);
    if (error) return onError(error.message);
    onChange();
  };
  const copy = async () => {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const addToWebsite = async () => {
    setBusy(true);
    onError("");
    const author = r.reviewer?.trim() || bylineOf(name);
    const { data: t, error } = await supabase.from("agent_site_testimonials").insert({ agent_site_id: site.id, quote: testimonialHtml(r.body), author: author || "A client", sort_order: 1000 }).select("id").single();
    if (!error) await supabase.from("contact_reviews").update({ testimonial_id: t.id }).eq("id", r.id);
    setBusy(false);
    if (error) return onError(error.message);
    onChange();
  };
  const sub = [deal?.property_address, deal?.closing_date && `closed ${when(deal.closing_date)}`, r.status === "asked" && `asked ${when(r.asked_at)}`, r.status === "received" && `answered ${when(r.received_at)}`].filter(Boolean).join(" · ");

  return (
    <li className="rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/dashboard/people/contacts?contact=${r.contact_id}`} className="font-semibold underline decoration-black/20 dark:decoration-white/30 underline-offset-2">{name || "Contact"}</Link>
          {sub && <p className={`text-xs ${muted}`}>{sub}</p>}
        </div>
        <span className={`text-xs font-semibold ${muted}`}>{STATUS_LABEL[r.status]}</span>
      </div>

      {(r.status === "to_ask" || r.status === "asked") && (
        <>
          {noContact && <p className="text-xs text-red-600 dark:text-red-400">Marked do not contact. Skip this one, or change that on their contact first.</p>}
          <p className={`rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-3 text-sm whitespace-pre-wrap ${muted}`}>{message}</p>
          <div className="flex flex-wrap gap-2">
            {contact?.phone && !noContact && <a href={smsHref(contact.phone, message)} className={ghost}>Text</a>}
            {contact?.email && !noContact && <a href={mailtoHref(contact.email, "A quick favor", message)} className={ghost}>Email</a>}
            <button type="button" onClick={copy} className={ghost}>{copied ? "Copied" : "Copy message"}</button>
            {r.status === "to_ask" && !noContact && <button type="button" disabled={busy} onClick={() => update({ status: "asked", asked_at: new Date().toISOString() }, "Asked for a Google review.")} className={solid.replace("px-5 py-2 text-sm", "px-4 py-1.5 text-xs")}>I asked them</button>}
            {r.status === "asked" && <button type="button" onClick={() => setForm({ rating: 5, body: "", reviewer: bylineOf(name) })} className={ghost}>They left a review</button>}
            <button type="button" disabled={busy} onClick={() => update({ status: "skipped" })} className={`${ghost} ml-auto`}>Skip</button>
          </div>
          {form && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                update({ status: "received", received_at: new Date().toISOString(), rating: form.rating, body: form.body.trim(), reviewer: form.reviewer.trim() }, "Left a review.");
                setForm(null);
              }}
              className="space-y-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.05] p-3"
            >
              <p className="text-xs font-semibold">Paste what they wrote</p>
              <div className="flex items-center gap-1" role="radiogroup" aria-label="Stars">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={form.rating === n} aria-label={`${n} star${n === 1 ? "" : "s"}`} onClick={() => setForm({ ...form, rating: n })} className={`text-xl ${n <= form.rating ? "text-amber-500" : "text-black/20 dark:text-white/25"}`}>★</button>
                ))}
              </div>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} maxLength={3000} placeholder="Their review" className={control} aria-label="Their review" />
              <input value={form.reviewer} onChange={(e) => setForm({ ...form, reviewer: e.target.value })} maxLength={120} placeholder="How to sign it, e.g. Sam R." className={control} aria-label="Name to show" />
              <div className="flex gap-2">
                <button type="submit" className={solid.replace("px-5 py-2 text-sm", "px-4 py-1.5 text-xs")}>Save review</button>
                <button type="button" onClick={() => setForm(null)} className={ghost}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}

      {r.status === "received" && (
        <>
          <p className="text-sm"><Stars n={r.rating || 5} /></p>
          {r.body ? <p className="text-sm whitespace-pre-wrap">{r.body}</p> : <p className={`text-sm ${muted}`}>No words saved.</p>}
          <div className="flex flex-wrap items-center gap-2">
            {r.testimonial_id ? (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">On your website ✓</span>
            ) : site && r.body ? (
              <button type="button" disabled={busy} onClick={addToWebsite} className={ghost}>Add to my website</button>
            ) : (
              <span className={`text-xs ${muted}`}>{r.body ? "Set up your website to show it there." : "Add their words to show it on your website."}</span>
            )}
          </div>
        </>
      )}

      {r.status === "skipped" && (
        <button type="button" disabled={busy} onClick={() => update({ status: "to_ask" })} className={ghost}>Put back on the list</button>
      )}
    </li>
  );
}

// Marketing > Reviews: who to ask for a Google review after a closing, who has been asked, the reviews that came in, and one click to put one on the website.
export default function ReviewsPage() {
  const { user, profile } = useAuth();
  const { stages, closedName } = usePeopleStages();
  const [rows, setRows] = useState(null);
  const [contacts, setContacts] = useState(new Map());
  const [deals, setDeals] = useState(new Map());
  const [site, setSite] = useState(null);
  const [closedDeals, setClosedDeals] = useState([]);
  const [error, setError] = useState("");
  const [find, setFind] = useState("");
  const [hits, setHits] = useState([]);

  const closed = useMemo(() => {
    const list = stages.transaction || [];
    return closedName && list.includes(closedName) ? closedName : list.includes("Closed") ? "Closed" : list[list.length - 1] || "Closed";
  }, [stages, closedName]);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [{ data: rs, error: e1 }, { data: s }, { data: cd }] = await Promise.all([
      supabase.from("contact_reviews").select("*").order("created_at", { ascending: false }).limit(300),
      supabase.from("agent_sites").select("id").eq("agent_id", user.id).maybeSingle(),
      supabase.from("people").select("id, name, contact_id, property_address, closing_date, tc_only").eq("stage_group", "transaction").eq("stage", closed).eq("archived", false).eq("tc_only", false).not("contact_id", "is", null).order("closing_date", { ascending: false }).limit(60),
    ]);
    if (e1) setError(e1.message);
    const list = rs || [];
    setRows(list);
    setSite(s || null);
    const have = new Set(list.map((r) => r.person_id).filter(Boolean));
    const open = (cd || []).filter((d) => !have.has(d.id));
    setClosedDeals(open);
    const contactIds = [...new Set([...list.map((r) => r.contact_id), ...open.map((d) => d.contact_id)])];
    const personIds = list.map((r) => r.person_id).filter(Boolean);
    const [{ data: cs }, { data: ds }] = await Promise.all([
      contactIds.length ? supabase.from("contacts").select("id, first_name, last_name, company, email, phone, do_not_contact").in("id", contactIds) : { data: [] },
      personIds.length ? supabase.from("people").select("id, property_address, closing_date").in("id", personIds) : { data: [] },
    ]);
    setContacts(new Map((cs || []).map((c) => [c.id, c])));
    setDeals(new Map((ds || []).map((d) => [d.id, d])));
  }, [user?.id, closed]);
  useEffect(() => {
    load();
  }, [load]);

  // Add anyone from Contacts (a past client, someone from before this list existed).
  useEffect(() => {
    const t = find.trim();
    if (t.length < 2) {
      setHits([]);
      return undefined;
    }
    let live = true;
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name, company, email, phone, do_not_contact").ilike("search_text", `%${t.toLowerCase().replace(/[%,]/g, " ")}%`).eq("archived", false).limit(6);
      if (live) setHits(data || []);
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [find]);

  const add = async (contact_id, person_id = null) => {
    setError("");
    const { error: err } = await supabase.from("contact_reviews").insert({ contact_id, person_id });
    if (err) return setError(err.message);
    setFind("");
    setHits([]);
    load();
  };

  const link = profile?.review_url || "";
  const msgFor = (r) => reviewMessage({ template: profile?.review_message, contact: contacts.get(r.contact_id), agent: profile, link });
  const group = (status) => (rows || []).filter((r) => r.status === status);
  const sections = [
    ["to_ask", "To ask", "People to ask for a review. Send it yourself, then press “I asked them”."],
    ["asked", "Asked, waiting", "Asked and not answered yet. When they post a review, paste it in."],
    ["received", "Reviews you got", "Put the good ones on your website."],
    ["skipped", "Skipped", ""],
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-display font-semibold">Reviews</h1>
        <p className={`mt-1 text-sm ${muted}`}>After a closing, ask your client for a Google review, keep track of who answered, and put the best reviews on your website. Nothing is sent for you.</p>
      </div>
      {profile && <Setup key={profile.id} profile={profile} onSaved={load} />}
      {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <section className={`${card} space-y-3`}>
        <div>
          <h2 className="font-display text-lg font-semibold">Add someone to ask</h2>
          <p className={`text-sm ${muted}`}>New closings are added for you once your link is saved. Add a past client yourself here.</p>
        </div>
        <div className="relative">
          <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Search your contacts" className={control} aria-label="Find a contact to ask" />
          {hits.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] shadow-lg">
              {hits.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => add(c.id)} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-black/[0.04] dark:hover:bg-white/[0.06]">
                    <span className="font-medium">{fullName(c)}</span>
                    <span className={`truncate text-xs ${muted}`}>{c.email || c.phone}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {closedDeals.length > 0 && (
          <div>
            <p className="text-xs font-semibold">Closed deals with no request yet</p>
            <ul className="mt-1.5 divide-y divide-black/5 dark:divide-white/10">
              {closedDeals.slice(0, 8).map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">{d.name}{d.property_address ? <span className={muted}> · {d.property_address}</span> : null}{d.closing_date ? <span className={muted}> · {when(d.closing_date)}</span> : null}</span>
                  <button type="button" onClick={() => add(d.contact_id, d.id)} className={ghost}>Add</button>
                </li>
              ))}
            </ul>
            <p className={`mt-1 text-[11px] ${muted}`}>Deals marked "I'm only coordinating" aren't listed.</p>
          </div>
        )}
      </section>

      {rows === null ? (
        <p className={`text-sm ${muted}`}>Loading…</p>
      ) : (
        sections.map(([status, title, hint]) => {
          const list = group(status);
          if (!list.length && status !== "to_ask") return null;
          return (
            <section key={status} aria-label={title} className="space-y-2">
              <div>
                <h2 className="font-display text-lg font-semibold">{title} <span className={`text-sm font-normal ${muted}`}>{list.length}</span></h2>
                {hint && <p className={`text-xs ${muted}`}>{hint}</p>}
              </div>
              {list.length === 0 ? (
                <p className={`rounded-xl border border-dashed border-black/15 dark:border-white/20 p-4 text-sm ${muted}`}>{link ? "No one to ask right now. New closings show up here." : "Save your Google review link above to start."}</p>
              ) : (
                <ul className="space-y-3">
                  {list.map((r) => <Row key={r.id} r={r} contact={contacts.get(r.contact_id)} deal={deals.get(r.person_id)} message={msgFor(r)} site={site} onChange={load} onError={setError} />)}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
