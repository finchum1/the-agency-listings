import { useState } from "react";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import { agentSiteHref } from "../../../lib/agentSiteLinks";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import SiteLink from "../SiteLink";

// "Listings first" layout (agent_sites.layout = 'listings'). For agents who sell a lot of homes: a short banner hero,
// then the listings straight away (HomeSections moves them to the top of the page), with the first one as a big
// feature, and everything else kept compact. Colors come from the same --as-* theme tokens, so every color theme, font
// pairing and button style still works with it.

const eyebrow = "text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]";
const h2Class = "font-display text-3xl sm:text-4xl font-semibold text-[var(--as-text)]";
const btn = "as-btn inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

export function ListingsHero() {
  const { site } = useAgentSiteContext();
  return (
    <section className="relative h-[62vh] min-h-[460px] w-full">
      {site.heroVideo ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={site.heroVideo} poster={site.heroPhoto} autoPlay muted loop playsInline />
      ) : site.heroPhoto ? (
        <img src={site.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[var(--as-dark)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-black/40" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/45 to-transparent" />
      <div className="relative z-10 h-full max-w-7xl mx-auto px-6 lg:px-10 pb-12 flex flex-col justify-end sm:flex-row sm:items-end sm:justify-between gap-8">
        <div>
          {site.region && <p className="text-white/75 text-xs tracked-wide uppercase mb-3">{site.region}</p>}
          <h1 className="text-white text-4xl sm:text-5xl lg:text-6xl font-display font-semibold leading-tight">{site.agent.name}</h1>
          {site.tagline && <p className="text-white/85 text-lg mt-3 max-w-xl">{site.tagline}</p>}
        </div>
        <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
          {site.agent.phone && (
            <a href={`tel:${site.agent.phone}`} className="text-white/90 text-lg font-display hover:text-white">
              {site.agent.phone}
            </a>
          )}
          <SiteLink slug={site.slug} path="/contact" className={btn}>
            Let&rsquo;s connect
          </SiteLink>
        </div>
      </div>
    </section>
  );
}

function specs(l) {
  return `${l.beds} bd | ${l.baths} ba | ${l.sqft?.toLocaleString()} sqft`;
}

export function ListingsListings() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const [filter, setFilter] = useState("all");
  if (site.listings.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  const statuses = [...new Set(site.listings.map((l) => l.status))];
  const shown = filter === "all" ? site.listings : site.listings.filter((l) => l.status === filter);
  const [feature, ...rest] = shown;
  const href = (l) => `/listings/${l.slug}?from=${encodeURIComponent(agentSiteHref(site.slug, "/listings"))}`;

  return (
    <section id="listings" className={`px-6 lg:px-10 pb-16 sm:pb-20 ${isStandalonePage ? "pt-24" : "pt-16 sm:pt-20"} bg-[var(--as-bg)]`}>
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <p className={eyebrow}>Portfolio</p>
            <Heading className={`${h2Class} mt-2`}>{statuses.length > 1 ? "Homes" : "Featured properties"}</Heading>
          </div>
          {statuses.length > 1 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
              {["all", ...statuses].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter(s)}
                  aria-pressed={filter === s}
                  className={`as-btn text-xs font-medium tracked-wide uppercase px-4 py-2 border transition-colors ${filter === s ? "bg-[var(--as-text)] text-[var(--as-bg)] border-[var(--as-text)]" : "border-[var(--as-text)]/25 text-[var(--as-text)]/70 hover:border-[var(--as-text)]"}`}
                >
                  {s === "all" ? "All" : STATUS_LABELS[s] || s}
                </button>
              ))}
            </div>
          )}
        </div>

        {feature && (
          <a href={href(feature)} className="group grid lg:grid-cols-[1.6fr_1fr] bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10 overflow-hidden">
            <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[16/10] lg:aspect-auto lg:min-h-[420px]">
              {feature.hero_photo_url && <img src={feature.hero_photo_url} alt={`${feature.address_line1}, ${feature.city}, ${feature.state}`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
              <span className="as-btn absolute top-4 left-4 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{STATUS_LABELS[feature.status] || feature.status}</span>
            </div>
            <div className="p-8 sm:p-10 flex flex-col justify-center">
              <p className="font-display text-4xl text-[var(--as-accent)]">{formatPrice(feature.price)}</p>
              <p className="mt-4 font-display text-2xl font-semibold text-[var(--as-text)]">{feature.address_line1}</p>
              <p className="mt-1 text-[var(--as-text)]/60">
                {feature.city}, {feature.state} {feature.zip}
              </p>
              <p className="mt-5 pt-5 border-t border-[var(--as-text)]/10 text-sm text-[var(--as-text)]/60">{specs(feature)}</p>
              <span className="mt-7 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] border-b border-[var(--as-text)] pb-1 w-fit group-hover:text-[var(--as-accent)] group-hover:border-[var(--as-accent)] transition-colors">View property &rarr;</span>
            </div>
          </a>
        )}

        {rest.length > 0 && (
          <div className="mt-6 grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {rest.map((l) => (
              <a key={l.id} href={href(l)} className="group block">
                <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                  {l.hero_photo_url && <img src={l.hero_photo_url} alt={`${l.address_line1}, ${l.city}, ${l.state}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                  <span className="as-btn absolute top-3 left-3 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{STATUS_LABELS[l.status] || l.status}</span>
                </div>
                <div className="mt-3 flex items-baseline justify-between gap-4">
                  <p className="font-medium text-[var(--as-text)] truncate">{l.address_line1}</p>
                  <p className="font-display text-lg text-[var(--as-accent)] shrink-0">{formatPrice(l.price)}</p>
                </div>
                <p className="text-sm text-[var(--as-text)]/55">
                  {l.city}, {l.state} · {specs(l)}
                </p>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// A slim strip on Home: a small portrait, the first few lines of the bio, and the numbers. The full bio is the
// regular About page.
export function ListingsBio() {
  const { site } = useAgentSiteContext();
  if (!site.bioHtml && site.stats.length === 0) return null;
  const first = site.agent.name.split(" ")[0];
  return (
    <section id="bio" className="px-6 lg:px-10 py-14 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-14">
        <div className="flex items-center gap-5 shrink-0">
          <div className="h-24 w-24 rounded-full overflow-hidden bg-[var(--as-surface)] shrink-0">{site.agent.photo && <img src={site.agent.photo} alt={site.agent.name} className="h-full w-full object-cover object-top" />}</div>
          <div>
            <p className="font-display text-2xl font-semibold text-[var(--as-text)]">{site.agent.name}</p>
            <p className="text-xs tracked-wide uppercase text-[var(--as-text)]/55 mt-1">{site.agent.title}</p>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="rich-text line-clamp-3 text-[15px] leading-relaxed text-[var(--as-text)]/75" dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.bioHtml) }} />
          <SiteLink slug={site.slug} path="/about" className="mt-3 inline-block text-xs font-medium tracked-wide uppercase text-[var(--as-accent)] hover:underline">
            More about {first} &rarr;
          </SiteLink>
        </div>
        {site.stats.length > 0 && (
          <div className="flex gap-8 shrink-0">
            {site.stats.slice(0, 3).map((stat, i) => (
              <div key={i}>
                <p className="font-display text-3xl font-semibold text-[var(--as-text)]">{stat.value}</p>
                <p className="text-[11px] tracked-wide uppercase text-[var(--as-text)]/50 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function ListingsTestimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;
  return (
    <section className="px-6 lg:px-10 py-16 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>Testimonials</p>
        <div className="mt-6 grid md:grid-cols-3 gap-6">
          {site.testimonials.slice(0, 3).map((t) => (
            <figure key={t.id} className="border-l-4 border-[var(--as-accent)] pl-5">
              <blockquote className="font-display text-lg leading-snug text-[var(--as-text)]">
                &ldquo;
                <div className="rich-text inline [&>*]:inline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }} />
                &rdquo;
              </blockquote>
              <figcaption className="mt-3 text-xs tracked-wide uppercase text-[var(--as-text)]/50">— {t.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ListingsAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.areas.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  return (
    <section id="areas" className={`px-6 lg:px-10 pb-16 ${isStandalonePage ? "pt-24" : "pt-16"} bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10`}>
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>Areas of expertise</p>
        <Heading className={`${h2Class} mt-2 mb-8`}>Find your area</Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {site.areas.map((area) => (
            <SiteLink key={area.id} slug={site.slug} path={`/areas/${area.slug}`} className="group flex items-center gap-4 bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-3 pr-5 transition-colors hover:border-[var(--as-accent)]">
              <div className="h-16 w-16 shrink-0 rounded-full overflow-hidden bg-[var(--as-surface)]">{area.photo_url && <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover" />}</div>
              <div className="min-w-0">
                <p className="font-display text-lg font-semibold text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{area.name}</p>
                {area.blurb && <p className="text-sm text-[var(--as-text)]/55 truncate">{area.blurb}</p>}
              </div>
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ListingsBlog({ posts, hasMore, standalone }) {
  const { site } = useAgentSiteContext();
  const Heading = standalone ? "h1" : "h2";
  const shown = standalone ? posts : posts.slice(0, 3);
  return (
    <section id="blog" className={`px-6 lg:px-10 pb-16 ${standalone ? "pt-24" : "pt-16"} bg-[var(--as-bg)]`}>
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>From the blog</p>
        <Heading className={`${h2Class} mt-2 mb-8`}>Market insights</Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {shown.map((post) => (
            <SiteLink key={post.id} slug={site.slug} path={`/blog/${post.slug}`} className="group flex gap-4">
              <div className="w-28 shrink-0 overflow-hidden bg-[var(--as-surface)] aspect-square">{post.image_url && <img src={post.image_url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}</div>
              <div className="min-w-0">
                {post.category && <p className="text-[11px] font-medium tracked-wide uppercase text-[var(--as-accent)]">{post.category}</p>}
                <p className="mt-1.5 font-medium leading-snug text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{post.title}</p>
              </div>
            </SiteLink>
          ))}
        </div>
        {(hasMore || (!standalone && posts.length > 3)) && (
          <div className="mt-10">
            <SiteLink slug={site.slug} path="/blog" className={btn}>
              All posts
            </SiteLink>
          </div>
        )}
      </div>
    </section>
  );
}
