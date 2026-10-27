import { LANDING_DEFAULTS, resolveLanding } from "../../lib/landingPages";
import ImageUploadField from "./ImageUploadField";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const muted = "text-[#1c1a17]/50 dark:text-[#faf9f7]/50";
const arrow =
  "text-[#1c1a17]/40 dark:text-[#faf9f7]/40 hover:text-[#1c1a17] dark:hover:text-[#faf9f7] disabled:opacity-20 px-1";

// The three cards that lead from the home page to the Sellers, Home Value and Buyers pages: their order, whether each shows, their wording and
// photo, and the two switches around them. `value` is agent_sites.landing; `onChange` gets the whole new object (SiteForm saves it with the
// rest of the form). Where the whole group sits on the home page is the "Buyer & seller cards" row in Home Page Sections above.
export default function LandingCardsEditor({ siteId, siteSlug, value, onChange }) {
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
        Three cards that sit together on your home page and lead to a page of their own. Reorder them, turn any off, or change the photo and wording. Until you
        add your own photos, the pages use photos from The Agency's guides.
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
                <a href={`/sites/${siteSlug}${c.path}`} target="_blank" rel="noreferrer" className="text-xs text-[#ed2127] dark:text-[#f2454b] hover:underline">
                  View page
                </a>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={c.on} onChange={(e) => patchCard(c.key, { on: e.target.checked })} className="accent-[#ed2127] dark:accent-[#f2454b]" />
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
        <input type="checkbox" checked={landing.menu} onChange={(e) => patch({ menu: e.target.checked })} className="mt-0.5 accent-[#ed2127] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Show these pages in the menu</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>Sellers, Home Value and Buyers links in your site's navigation and footer.</span>
        </span>
      </label>
      <label className="flex items-start gap-3 bg-white dark:bg-[#1a1a1a] border border-black/10 dark:border-white/15 rounded-lg px-3.5 py-3 cursor-pointer">
        <input type="checkbox" checked={landing.compsTask} onChange={(e) => patch({ comps_task: e.target.checked })} className="mt-0.5 accent-[#ed2127] dark:accent-[#f2454b]" />
        <span>
          <span className="block text-sm font-medium">Add a "Pull comps" task for each home value request</span>
          <span className={`block text-xs mt-0.5 ${muted}`}>
            Every request is emailed to you and lands in People › Leads tagged by the page it came from. This also adds a task due the next day.
          </span>
        </span>
      </label>
    </div>
  );
}
