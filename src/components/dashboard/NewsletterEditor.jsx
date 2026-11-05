import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import { brandFromOrg } from "../../lib/brand";
import { RELATIONSHIPS } from "../../lib/contacts";
import { newsletterAction } from "../../lib/newslettersApi";
import { BANNER_COLORS, BLOCK_TYPES, listingCardData, postCardData, renderNewsletter } from "../../lib/newsletterHtml";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40 disabled:opacity-60";
const labelClass = `block text-xs font-medium mb-1.5 ${muted}`;
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5 space-y-4";
const ghost = "rounded-full border border-black/15 dark:border-white/20 px-4 py-2 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-50";
const solid = "rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-2.5 hover:opacity-90 disabled:opacity-50";
const arrow = "text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-25 px-1.5";
const absolute = (u) => (u && u.startsWith("/") ? `${window.location.origin}${u}` : u || "");
const FIELDS = ["subject", "preheader", "blocks", "audience", "greeting", "track"];

const listingLabel = (l) => `${l.address_line1}${l.city ? `, ${l.city}` : ""}`;

// One block's own fields.
function BlockFields({ block, set, listings, posts, disabled }) {
  const field = (key, label, props = {}) => (
    <div>
      <label className={labelClass}>{label}</label>
      <input value={block[key] || ""} onChange={(e) => set({ [key]: e.target.value })} disabled={disabled} className={inputClass} {...props} />
    </div>
  );
  if (block.type === "text")
    return (
      <div className="space-y-3">
        {field("heading", "Heading (optional)", { maxLength: 120 })}
        <div>
          <label className={labelClass}>Words</label>
          <textarea value={block.body || ""} onChange={(e) => set({ body: e.target.value })} rows={5} disabled={disabled} className={inputClass} />
        </div>
      </div>
    );
  if (block.type === "banner")
    return (
      <div className="space-y-3">
        {field("heading", "Big words", { maxLength: 80, placeholder: "Happy Thanksgiving" })}
        <div>
          <label className={labelClass}>Line under it</label>
          <textarea value={block.body || ""} onChange={(e) => set({ body: e.target.value })} rows={2} disabled={disabled} className={inputClass} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Banner color">
          {BANNER_COLORS.map((c) => (
            <button
              key={c.hex}
              type="button"
              disabled={disabled}
              onClick={() => set({ color: c.hex })}
              aria-pressed={block.color === c.hex}
              aria-label={c.name}
              title={c.name}
              className={`h-8 w-8 rounded-full border-2 ${block.color === c.hex ? "border-[#1c1a17] dark:border-[#faf9f7] ring-2 ring-offset-2 ring-[#1c1a17]/30 ring-offset-white dark:ring-offset-[#1a1a1a]" : "border-black/15 dark:border-white/20"}`}
              style={{ background: c.hex }}
            />
          ))}
        </div>
      </div>
    );
  if (block.type === "button")
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {field("label", "Button words", { maxLength: 40 })}
        {field("url", "Goes to (a web address)", { placeholder: "https://" })}
      </div>
    );
  if (block.type === "post")
    return (
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Blog post</label>
          <select value={block.postId || ""} onChange={(e) => set({ postId: e.target.value })} disabled={disabled} className={inputClass}>
            <option value="">Choose a post…</option>
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
          {posts.length === 0 && <p className={`mt-1 text-xs ${muted}`}>You have no published blog posts yet.</p>}
        </div>
        {field("cta", "Link words", { maxLength: 40 })}
      </div>
    );
  if (block.type === "listing" || block.type === "openhouse")
    return (
      <div className="space-y-3">
        <div>
          <label className={labelClass}>Listing</label>
          <select value={block.listingId || ""} onChange={(e) => set({ listingId: e.target.value })} disabled={disabled} className={inputClass}>
            <option value="">Choose a listing…</option>
            {listings.map((l) => (
              <option key={l.id} value={l.id}>
                {listingLabel(l)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("heading", "Heading above it (optional)", { maxLength: 60 })}
          {field("cta", "Link words", { maxLength: 40 })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Layout</label>
            <select value={block.layout || "side"} onChange={(e) => set({ layout: e.target.value })} disabled={disabled} className={inputClass}>
              <option value="side">Side by side</option>
              <option value="stacked">Photo on top</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>The link goes to</label>
            <select value={block.linkTo || "property"} onChange={(e) => set({ linkTo: e.target.value })} disabled={disabled} className={inputClass}>
              <option value="property">The property site</option>
              <option value="website">My website's listings page</option>
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>A few words of your own (optional)</label>
          <textarea value={block.note || ""} onChange={(e) => set({ note: e.target.value })} rows={2} disabled={disabled} className={inputClass} />
        </div>
      </div>
    );
  return <p className={`text-xs ${muted}`}>A thin line between sections.</p>;
}

// Writing a newsletter, with the email beside it as recipients will see it. Saved as a draft until you send a test, send it or schedule it. Once it is on
// its way (or sent) the page turns into its results.
export default function NewsletterEditor() {
  const { id } = useParams();
  const { user, profile } = useAuth();
  const { org } = useOrg();
  const brokerage = brandFromOrg(org);

  const [row, setRow] = useState(null);
  const [form, setForm] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [listings, setListings] = useState([]);
  const [photos, setPhotos] = useState({});
  const [houses, setHouses] = useState({});
  const [site, setSite] = useState(null);
  const [posts, setPosts] = useState([]);
  const [tags, setTags] = useState([]);
  const [count, setCount] = useState(null);
  const [sends, setSends] = useState([]);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [when, setWhen] = useState("");
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("newsletters").select("*").eq("id", id).maybeSingle();
    if (err || !data) return setLoadError(err?.message || "Newsletter not found.");
    setRow(data);
    setForm((f) => (f && data.status === "draft" ? f : Object.fromEntries(FIELDS.map((k) => [k, data[k]]))));
    return data;
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: ls }, { data: st }, { data: tg }] = await Promise.all([
        supabase.from("listings").select("id, slug, address_line1, city, state, zip, price, beds, baths, sqft, lot_size, status, custom_domain").eq("agent_id", user.id).neq("status", "draft").order("created_at", { ascending: false }).limit(100),
        supabase.from("agent_sites").select("id, slug, custom_domain, instagram_url, facebook_url, linkedin_url, tiktok_url, youtube_url, x_url").eq("agent_id", user.id).maybeSingle(),
        supabase.from("contact_tags").select("id, name").eq("owner_id", user.id).order("name"),
      ]);
      setListings(ls || []);
      setSite(st || null);
      setTags(tg || []);
      const ids = (ls || []).map((l) => l.id);
      if (ids.length) {
        const [{ data: ph }, { data: oh }] = await Promise.all([
          supabase.from("listing_photos").select("listing_id, url, is_hero, sort_order").in("listing_id", ids).order("sort_order"),
          supabase.from("open_houses").select("listing_id, starts_at, ends_at").in("listing_id", ids).order("starts_at"),
        ]);
        const hero = {};
        for (const p of ph || []) if (!hero[p.listing_id] || p.is_hero) hero[p.listing_id] = p.url;
        setPhotos(hero);
        const byListing = {};
        for (const o of oh || []) (byListing[o.listing_id] ||= []).push(o);
        setHouses(byListing);
      }
      if (st) {
        const { data: ps } = await supabase.from("agent_site_posts").select("*").eq("agent_site_id", st.id).eq("status", "published").order("post_date", { ascending: false }).limit(60);
        setPosts(ps || []);
      }
    })();
  }, [user]);

  const locked = Boolean(row) && (row.status === "sending" || row.status === "sent");
  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setBlock = (i, patch) => set({ blocks: form.blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)) });
  const move = (i, d) => {
    const blocks = [...form.blocks];
    const j = i + d;
    if (j < 0 || j >= blocks.length) return;
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    set({ blocks });
  };

  // How many people it would go to, from the server (it knows who has unsubscribed).
  const audienceKey = form ? JSON.stringify(form.audience) : "";
  useEffect(() => {
    if (!form || locked) return undefined;
    setCount(null);
    const t = setTimeout(() => {
      newsletterAction({ action: "count", audience: form.audience }).then((r) => setCount(r)).catch(() => setCount({ count: null }));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey, locked]);

  // Results, once it has gone out.
  useEffect(() => {
    if (!row || row.status === "draft" || row.status === "scheduled") return undefined;
    const pull = async () => {
      const { data } = await supabase.from("newsletter_sends").select("email, first_name, status, error, opened_at, open_count, clicked_at, click_count, unsubscribed_at").eq("newsletter_id", id).order("email").limit(5000);
      setSends(data || []);
      if (row.status === "sending") load();
    };
    pull();
    const t = row.status === "sending" ? setInterval(pull, 8000) : null;
    return () => t && clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [row?.status, id]);

  const siteBase = site ? (site.custom_domain ? `https://${site.custom_domain}` : `${window.location.origin}/sites/${site.slug}`) : "";
  const preview = useMemo(() => {
    if (!form) return "";
    const lmap = {};
    for (const l of listings) lmap[l.id] = listingCardData(l, { photoUrl: photos[l.id] || "", openHouses: houses[l.id] || [], origin: window.location.origin, siteBase });
    const pmap = {};
    for (const p of posts) pmap[p.id] = postCardData(p, { siteBase });
    return renderNewsletter({
      newsletter: form,
      agent: {
        name: profile?.full_name || "",
        title: profile?.title || "",
        phone: profile?.phone || "",
        email: profile?.email || "",
        license: profile?.license || "",
        photo: profile?.photo_url || "",
        contactUrl: siteBase ? `${siteBase}/contact` : "",
        social: { instagram: site?.instagram_url, facebook: site?.facebook_url, linkedin: site?.linkedin_url, youtube: site?.youtube_url, tiktok: site?.tiktok_url, x: site?.x_url },
      },
      brand: { name: brokerage.name, logo: absolute(brokerage.logos?.red || brokerage.logo), address: brokerage.address, disclaimer: brokerage.disclaimer, franchiseDisclaimer: brokerage.franchiseDisclaimer },
      listings: lmap,
      posts: pmap,
      recipient: { first: "Sam", unsubscribeUrl: "#" },
    }).html;
  }, [form, listings, photos, houses, posts, profile, site, siteBase, brokerage]);

  const save = async () => {
    const { error: err } = await supabase.from("newsletters").update({ subject: form.subject, preheader: form.preheader, blocks: form.blocks, audience: form.audience, greeting: form.greeting, track: form.track }).eq("id", id);
    if (err) throw new Error(err.message);
    setDirty(false);
  };
  const run = async (name, fn) => {
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Something went wrong.");
    }
    setBusy("");
  };
  const onSave = () => run("save", async () => {
    await save();
    setNotice("Saved.");
  });
  const onTest = () => run("test", async () => {
    await save();
    const r = await newsletterAction({ action: "test", id });
    setNotice(`A test went to ${r.to}. It can take a minute to arrive.`);
  });
  const onSend = () => run("send", async () => {
    const n = count?.count;
    if (!window.confirm(`Send this to ${n != null ? `${n} people` : "everyone in the audience"} now? You can't take it back.`)) return;
    await save();
    const r = await newsletterAction({ action: "send", id });
    setNotice(`Sending to ${r.count} people.`);
    await load();
  });
  const onSchedule = () => run("schedule", async () => {
    if (!when) throw new Error("Pick a day and time first.");
    await save();
    const r = await newsletterAction({ action: "schedule", id, at: new Date(when).toISOString() });
    setNotice(`Scheduled for ${r.count} people.`);
    await load();
  });
  const onUnschedule = () => run("unschedule", async () => {
    await newsletterAction({ action: "unschedule", id });
    await load();
    setForm(null);
    setNotice("Back to a draft.");
  });
  useEffect(() => {
    if (!form && row) setForm(Object.fromEntries(FIELDS.map((k) => [k, row[k]])));
  }, [form, row]);

  if (loadError) return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  if (!row || !form) return <p className={`text-sm ${muted}`}>Loading…</p>;

  const tally = sends.reduce((a, s) => ({ sent: a.sent + (s.status === "sent"), failed: a.failed + (s.status === "failed"), opened: a.opened + Boolean(s.opened_at), clicked: a.clicked + Boolean(s.clicked_at), unsub: a.unsub + Boolean(s.unsubscribed_at) }), { sent: 0, failed: 0, opened: 0, clicked: 0, unsub: 0 });
  const pct = (n) => (tally.sent ? `${Math.round((n / tally.sent) * 100)}%` : "–");
  const toggleRel = (value) => {
    const cur = form.audience.relationships || [];
    set({ audience: { ...form.audience, relationships: cur.includes(value) ? cur.filter((r) => r !== value) : [...cur, value] } });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/dashboard/marketing/newsletters" className={`text-xs font-semibold hover:underline ${muted}`}>
            ← Newsletters
          </Link>
          <h1 className="mt-2 text-2xl font-display font-semibold">{locked ? form.subject || "Newsletter" : "Write a newsletter"}</h1>
        </div>
        {!locked && (
          <p className={`text-xs ${muted}`} aria-live="polite">
            {dirty ? "Not saved yet" : "All changes saved"}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,520px)_1fr] items-start">
        <div className="space-y-5">
          {locked && (
            <section className={card}>
              <h2 className="font-display text-base font-semibold">{row.status === "sending" ? "Sending…" : "Results"}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                {[
                  ["Sent", tally.sent],
                  ["Opened", pct(tally.opened)],
                  ["Clicked", pct(tally.clicked)],
                  ["Unsubscribed", tally.unsub],
                  ["Didn't send", tally.failed],
                ].map(([label, v]) => (
                  <div key={label} className="rounded-xl bg-black/[0.03] dark:bg-white/[0.05] py-3">
                    <p className="text-xl font-semibold">{v}</p>
                    <p className={`text-xs ${muted}`}>{label}</p>
                  </div>
                ))}
              </div>
              <p className={`text-xs ${muted}`}>Opens are counted when a reader's email app loads pictures, so the number is a little off in both directions. Clicks are the more reliable one.</p>
              {sends.length > 0 && (
                <div className="max-h-72 overflow-auto rounded-lg border border-black/10 dark:border-white/15">
                  <table className="w-full text-xs">
                    <thead className={`text-left ${muted}`}>
                      <tr>
                        <th className="px-3 py-2 font-medium">Who</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Opened</th>
                        <th className="px-3 py-2 font-medium">Clicked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sends.map((s) => (
                        <tr key={s.email} className="border-t border-black/5 dark:border-white/10">
                          <td className="px-3 py-1.5">{s.first_name ? `${s.first_name} · ` : ""}{s.email}</td>
                          <td className="px-3 py-1.5">{s.unsubscribed_at ? "Unsubscribed" : s.status === "failed" ? `Didn't send` : s.status === "sent" ? "Sent" : "Waiting"}</td>
                          <td className="px-3 py-1.5">{s.open_count || ""}</td>
                          <td className="px-3 py-1.5">{s.click_count || ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          <section className={card}>
            <div>
              <label className={labelClass} htmlFor="nl-subject">Subject</label>
              <input id="nl-subject" value={form.subject} onChange={(e) => set({ subject: e.target.value })} disabled={locked} maxLength={200} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="nl-pre">Preview line (the grey text next to the subject in most inboxes)</label>
              <input id="nl-pre" value={form.preheader} onChange={(e) => set({ preheader: e.target.value })} disabled={locked} maxLength={200} className={inputClass} />
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.greeting} onChange={(e) => set({ greeting: e.target.checked })} disabled={locked} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                Start with "Hi {"{first name}"},"
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={form.track} onChange={(e) => set({ track: e.target.checked })} disabled={locked} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                Count opens and clicks
              </label>
            </div>
          </section>

          <section className="space-y-3">
            {form.blocks.map((b, i) => (
              <div key={i} className={card}>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-semibold">{BLOCK_TYPES[b.type]?.label || "Block"}</h2>
                  {!locked && (
                    <div className="flex items-center">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={arrow} aria-label="Move up">↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === form.blocks.length - 1} className={arrow} aria-label="Move down">↓</button>
                      <button type="button" onClick={() => set({ blocks: form.blocks.filter((_, j) => j !== i) })} className={`${arrow} hover:!text-red-600`} aria-label="Remove">✕</button>
                    </div>
                  )}
                </div>
                <BlockFields block={b} set={(patch) => setBlock(i, patch)} listings={listings} posts={posts} disabled={locked} />
              </div>
            ))}
            {!locked && (
              <div className={card}>
                <p className="text-sm font-medium">Add to the newsletter</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(BLOCK_TYPES).map(([key, t]) => (
                    <button key={key} type="button" onClick={() => set({ blocks: [...form.blocks, t.make()] })} className={ghost}>
                      + {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="font-display text-base font-semibold">Who it goes to</h2>
            <p className={`text-xs ${muted}`}>Your own contacts only. Anyone archived, marked do not contact, or who has unsubscribed is always left out.</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2" role="group" aria-label="Relationships">
              {RELATIONSHIPS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={(form.audience.relationships || []).includes(r.value)} onChange={() => toggleRel(r.value)} disabled={locked} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                  {r.label}
                </label>
              ))}
            </div>
            {tags.length > 0 && (
              <div>
                <label className={labelClass} htmlFor="nl-tag">Only people with this tag (optional)</label>
                <select id="nl-tag" value={form.audience.tag_id || ""} onChange={(e) => set({ audience: { ...form.audience, tag_id: e.target.value || null } })} disabled={locked} className={inputClass}>
                  <option value="">Everyone in those groups</option>
                  {tags.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!locked && (
              <p className="text-sm font-medium" aria-live="polite">
                {count == null ? "Counting…" : count.count == null ? "Couldn't count right now." : `${count.count.toLocaleString()} ${count.count === 1 ? "person" : "people"}`}
                {count?.count > count?.max ? ` (more than the ${count.max.toLocaleString()} one newsletter can go to)` : ""}
              </p>
            )}
          </section>

          {!locked ? (
            <section className={card}>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={onSave} disabled={Boolean(busy) || !dirty} className={ghost}>
                  {busy === "save" ? "Saving…" : "Save draft"}
                </button>
                <button type="button" onClick={onTest} disabled={Boolean(busy)} className={ghost}>
                  {busy === "test" ? "Sending…" : "Send a test to me"}
                </button>
                <button type="button" onClick={onSend} disabled={Boolean(busy) || row.status === "scheduled"} className={solid}>
                  {busy === "send" ? "Sending…" : "Send now"}
                </button>
              </div>
              <div className="flex flex-wrap items-end gap-2 border-t border-black/5 dark:border-white/10 pt-4">
                {row.status === "scheduled" ? (
                  <>
                    <p className="text-sm">Scheduled for {new Date(row.scheduled_at).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.</p>
                    <button type="button" onClick={onUnschedule} disabled={Boolean(busy)} className={ghost}>
                      Cancel the schedule
                    </button>
                  </>
                ) : (
                  <>
                    <div>
                      <label className={labelClass} htmlFor="nl-when">Or send it later</label>
                      <input id="nl-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
                    </div>
                    <button type="button" onClick={onSchedule} disabled={Boolean(busy) || !when} className={ghost}>
                      {busy === "schedule" ? "Scheduling…" : "Schedule"}
                    </button>
                  </>
                )}
              </div>
              {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">{notice}</p>}
              {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </section>
          ) : (
            (notice || error) && (
              <p role={error ? "alert" : "status"} className={`text-sm ${error ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                {error || notice}
              </p>
            )
          )}
        </div>

        <div className="xl:sticky xl:top-6 space-y-2">
          <p className={`text-xs font-medium ${muted}`}>What they'll see (the name "Sam" is just a sample)</p>
          <iframe title="Newsletter preview" srcDoc={preview} className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-white" style={{ height: "78vh", minHeight: 520 }} />
        </div>
      </div>
    </div>
  );
}
