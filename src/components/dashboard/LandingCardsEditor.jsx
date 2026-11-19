import { useEffect, useState } from "react";
import { fetchFeed, FEED_HOST } from "../../lib/instagramFeed";
import { LANDING_DEFAULTS, resolveLanding } from "../../lib/landingPages";
import ImageUploadField from "./ImageUploadField";
import AreaMapEditor from "./AreaMapEditor";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const arrow =
  "text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 px-1";

// The three cards that lead from the home page to the Sellers, Home Value and Buyers pages: their order, whether each shows, their wording and
// photo, and the two switches around them. `value` is agent_sites.landing; `onChange` gets the whole new object (SiteForm saves it with the
// rest of the form). Where the whole group sits on the home page is the "Buyer & seller cards" row in Home Page Sections above.
export default function LandingCardsEditor({ siteId, siteSlug, value, onChange, areas = [] }) {
  const landing = resolveLanding(value, "your agent");
  const saved = value && typeof value === "object" ? value : {};
  const patch = (changes) => onChange({ ...saved, ...changes });
  const patchCard = (key, changes) => patch({ [key]: { ...(saved[key] || {}), ...changes } });
  const move = (i, d) => {
    const order = [...landing.order];
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    patch({ order });
  };

  return (
    <div className="space-y-4">
      <p className={`text-xs ${muted}`}>
        Cards that sit together on your home page and lead to a page of their own. Reorder them, turn any off, or change the photo and wording. Relocation
        (for clients moving to Oklahoma) starts turned off: tick Show to add it to your site and menu. Until you add your own photos, the pages use photos
        from The Agency's guides.
      </p>
      <div className="space-y-3">
        {landing.cards.map((c, i) => {
          const d = LANDING_DEFAULTS[c.key];
          const mine = saved[c.key] || {};
          return (
            <div key={c.key} className={`rounded-xl border border-black/10 dark:border-white/15 bg-white dark:bg-[#1a1a1a] p-4 space-y-3 ${c.on ? "" : "opacity-60"}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className={arrow} title="Move earlier" aria-label={`Move ${c.kind} earlier`}>
                  ↑
                </button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === landing.cards.length - 1} className={arrow} title="Move later" aria-label={`Move ${c.kind} later`}>
                  ↓
                </button>
                <span className="flex-1 text-sm font-semibold">{c.kind}</span>
                <a href={`/sites/${siteSlug}${c.path}`} target="_blank" rel="noreferrer" className="text-xs text-[#D8091B] dark:text-[#f2454b] hover:underline">
                  View page
                </a>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={c.on} onChange={(e) => patchCard(c.key, { on: e.target.checked })} className="accent-[#D8091B] dark:accent-[#f2454b]" />
                  Show
                </label>
              </div>
              <div className="grid sm:grid-cols-[180px_1fr] gap-4">
                <ImageUploadField bucket="agent-site-photos" folder={siteId} value={mine.photo_url || c.photo} onChange={(url) => patchCard(c.key, { photo_url: url || "" })} label="Card photo" />
                <div className="space-y-2">
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${muted}`}>Title</label>
                    <input value={mine.title || ""} onChange={(e) => patchCard(c.key, { title: e.target.value })} placeholder={d.title} maxLength={80} className={inputClass} />
                  </div>
                  <div>
                    <label className={`block text-xs font-medium mb-1 ${muted}`}>Blurb</label>
                    <textarea
                      value={mine.blurb || ""}
                      onChange={(e) => patchCard(c.key, { blurb: e.target.value })}
                      placeholder={d.blurb.replace("{first}", "Your agent")}
                      maxLength={240}
                      rows={2}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
              {mine.photo_url && (
                <button type="button" onClick={() => patchCard(c.key, { photo_url: "" })} className={`text-xs hover:underline ${muted}`}>
                  Use the default photo
                </button>
              )}
            </div>
          );
        })}
      </div>

      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.menu} onChange={(e) => patch({ menu: e.target.checked })} className="mt-0.5 accent-[#D8091B] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Show these pages in the menu</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>Sellers, Home Value and Buyers links in your site's navigation and footer.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.panels} onChange={(e) => patch({ panels: e.target.checked })} className="mt-0.5 accent-[#D8091B] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Photo panels</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>
            The cards become tall photo panels beside a short heading. On a computer, the panel under the pointer opens to nearly full view and shows its wording
            (the Home Value panel opens with its address box). On a phone they stack as ordinary cards, and the wording is also listed below the panels. Replaces
            the route-line cards above; the area map below is unaffected.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.animated} onChange={(e) => patch({ animated: e.target.checked })} className="mt-0.5 accent-[#D8091B] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Animated cards and area map</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>
            A route line links the cards above as it draws itself, and Areas of Expertise becomes a map you can point at. The map appears once at least three
            of your areas have a place on the map (you place them below). Visitors who ask their device for less motion see it without the animation. For the
            route line to carry on from the cards into the map, put Areas right under these cards in Home Page Sections.
          </span>
        </span>
      </label>
      {landing.animated && (areas.length > 0 ? <AreaMapEditor areas={areas} value={saved.map} onChange={(m) => patch({ map: m })} /> : <p className={`text-xs ${muted}`}>Add your areas of expertise first, then place them on the map here.</p>)}
      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.compsTask} onChange={(e) => patch({ comps_task: e.target.checked })} className="mt-0.5 accent-[#D8091B] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Add a "Pull comps" task for each home value request</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>
            Every request is emailed to you and lands in People › Leads tagged by the page it came from. This also adds a task due the next day.
          </span>
        </span>
      </label>
      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.paperclip} onChange={(e) => patch({ paperclip: e.target.checked })} className="mt-0.5 accent-[#D8091B] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Paperclip A in the background</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>
            The Agency's paperclip, large and faint, running off the right edge of one section per page: Contact on the home page, the About page, and the closing
            form band of the Sellers, Buyers, Home Value and Relocation pages (The Agency offices only).
          </span>
        </span>
      </label>
      <InstagramSettings value={saved.instagram || {}} onChange={(instagram) => patch({ instagram })} />
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D8091B]/40 dark:focus:ring-[#f2454b]/40";

// The Instagram strip's settings: a short how-to for getting a Behold feed address, the address itself, and a live check that the address works.
function InstagramSettings({ value, onChange }) {
  const url = (value.feed_url || "").trim();
  const set = (changes) => onChange({ ...value, ...changes });
  const [check, setCheck] = useState({ state: "idle" }); // idle | checking | ok | error
  const [tick, setTick] = useState(0);

  // Checks the address a moment after it stops changing (or when "Check again" is pressed).
  useEffect(() => {
    if (!url) {
      setCheck({ state: "idle" });
      return undefined;
    }
    if (!FEED_HOST.test(url)) {
      setCheck({ state: "error", message: "That isn't a Behold feed address. It should start with https://feeds.behold.so/" });
      return undefined;
    }
    const ctl = new AbortController();
    setCheck({ state: "checking" });
    const t = setTimeout(() => {
      fetchFeed(url, ctl.signal)
        .then((feed) =>
          setCheck(
            feed.tiles.length === 0
              ? { state: "error", message: "The feed works, but it has no posts yet. Behold shows posts once your Instagram has some, and it can take a minute after you connect." }
              : { state: "ok", feed },
          ),
        )
        .catch((e) => e?.name !== "AbortError" && setCheck({ state: "error", message: e.message }));
    }, 500);
    return () => {
      clearTimeout(t);
      ctl.abort();
    };
  }, [url, tick]);

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 space-y-2.5">
      <div>
        <p className="text-sm font-medium">Instagram strip</p>
        <p className={`text-xs mt-0.5 ${muted}`}>
          Your latest posts as a row of photos above the footer, updating by themselves when you post. Leave the feed address empty to hide the strip.
        </p>
      </div>

      <details className="rounded-lg border border-black/10 dark:border-white/15 px-3 py-2 text-xs">
        <summary className="cursor-pointer font-medium">How to get your feed address (about 5 minutes, free)</summary>
        <ol className={`mt-2 list-decimal space-y-1.5 pl-4 leading-relaxed ${muted}`}>
          <li>
            <span className="font-medium text-[#1c1a17] dark:text-[#faf9f7]">Check your Instagram account type.</span> Behold works with Business and Creator accounts. In the Instagram app: Settings,
            then Account type and tools, then switch to a Professional account (it's free, and your posts and followers stay the same).
          </li>
          <li>
            <span className="font-medium text-[#1c1a17] dark:text-[#faf9f7]">Make a free account at behold.so</span> and choose to connect Instagram. Log in to your own
            Instagram when it asks. Behold only reads your public posts.
          </li>
          <li>
            <span className="font-medium text-[#1c1a17] dark:text-[#faf9f7]">Create a feed</span> for that account. Any layout will do: we only use the posts, not Behold's look.
          </li>
          <li>
            <span className="font-medium text-[#1c1a17] dark:text-[#faf9f7]">Copy the feed's JSON address.</span> It starts with <code>https://feeds.behold.so/</code>.
          </li>
          <li>
            <span className="font-medium text-[#1c1a17] dark:text-[#faf9f7]">Paste it below.</span> The check underneath shows your latest posts if it worked. Then save the page.
          </li>
        </ol>
      </details>

      <input value={value.feed_url || ""} onChange={(e) => set({ feed_url: e.target.value.trim() })} placeholder="https://feeds.behold.so/…" className={fieldClass} aria-label="Behold feed address" />

      {check.state === "checking" && <p className={`text-xs ${muted}`}>Checking the feed…</p>}
      {check.state === "error" && <p className="text-xs text-red-600 dark:text-red-400">{check.message}</p>}
      {check.state === "ok" && (
        <div className="space-y-2">
          <p className="text-xs text-emerald-700 dark:text-emerald-400">
            The feed works: {check.feed.tiles.length} recent posts{check.feed.username ? ` from @${check.feed.username}` : ""}. This is what visitors will see.
          </p>
          <div className="flex gap-1.5 overflow-x-auto">
            {check.feed.tiles.slice(0, 6).map((t) => (
              <img key={t.id} src={t.src} alt="" className="h-14 w-14 shrink-0 rounded object-cover bg-black/5" />
            ))}
          </div>
        </div>
      )}
      {url && check.state !== "checking" && (
        <button type="button" onClick={() => setTick((n) => n + 1)} className="text-xs font-medium text-[#D8091B] dark:text-[#f2454b] hover:underline">
          Check again
        </button>
      )}

      <input value={value.label || ""} onChange={(e) => set({ label: e.target.value })} maxLength={40} placeholder='The line above your handle (default: "Follow along")' className={fieldClass} aria-label="Line above your handle" />
      <input value={value.handle || ""} onChange={(e) => set({ handle: e.target.value.trim() })} placeholder="Handle to show (optional, taken from your Instagram link otherwise)" className={fieldClass} aria-label="Instagram handle" />
    </div>
  );
}
