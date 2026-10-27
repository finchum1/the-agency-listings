import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import { agentSiteHref } from "../../../lib/agentSiteLinks";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import SiteLink from "../SiteLink";
import FeaturedTag from "../FeaturedTag";

// "Portrait split" layout (agent_sites.layout = 'portrait'). Leads with the agent: a tall portrait next to their name,
// tagline and a way to connect, then warm, card-based sections underneath. Colors come from the same --as-* theme
// tokens, so every color theme, font pairing and button style still works with it.

const eyebrow = "text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]";
const h2Class = "font-display text-3xl sm:text-4xl font-semibold text-[var(--as-text)]";
const card = "bg-[var(--as-bg-alt)] border border-[var(--as-text)]/10";
const btn = "as-btn inline-block text-xs font-medium tracked-wide uppercase px-8 py-4 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

export function PortraitHero() {
  const { site } = useAgentSiteContext();
  const photo = site.agent.photo || site.heroPhoto;
  const first = site.agent.name.split(" ")[0];
  return (
    <section className="bg-[var(--as-bg)] pt-24">
      <div className="mx-auto max-w-7xl grid lg:grid-cols-2 lg:min-h-[calc(100vh-96px)]">
        <div className="relative bg-[var(--as-surface)] aspect-[4/5] lg:aspect-auto lg:min-h-[640px] overflow-hidden">
          {photo && <img src={photo} alt={site.agent.name} className="absolute inset-0 h-full w-full object-cover object-top" />}
        </div>
        <div className="flex flex-col justify-center px-6 sm:px-10 lg:px-16 py-14 lg:py-20">
          {site.region && <p className={eyebrow}>{site.region}</p>}
          <h1 className="mt-5 font-display text-5xl sm:text-6xl xl:text-7xl font-semibold leading-[1.02] text-[var(--as-text)]">{site.agent.name}</h1>
          {site.agent.title && (
            <p className="mt-4 text-sm tracked-wide uppercase text-[var(--as-text)]/55">
              {site.agent.title}
              {site.agent.license ? ` · ${site.agent.license}` : ""}
            </p>
          )}
          {site.tagline && <p className="mt-7 text-xl sm:text-2xl leading-snug text-[var(--as-text)]/75 max-w-md">{site.tagline}</p>}
          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-4">
            <SiteLink slug={site.slug} path="/contact" className={btn}>
              Let&rsquo;s connect
            </SiteLink>
            {site.homeSections.includes("listings") && (
              <SiteLink slug={site.slug} path="/listings" className="text-xs font-medium tracked-wide uppercase text-[var(--as-text)] border-b border-[var(--as-text)] pb-1 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]">
                See {first}&rsquo;s listings &rarr;
              </SiteLink>
            )}
          </div>
          {site.agent.phone && (
            <a href={`tel:${site.agent.phone}`} className="mt-8 text-[var(--as-text)]/60 hover:text-[var(--as-accent)] transition-colors w-fit">
              {site.agent.phone}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

// The hero already shows the portrait, so the bio is text-first: a heading on the left, the story on the right, and the
// numbers as a row of cards.
export function PortraitBio() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (!site.bioHtml && site.stats.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  const first = site.agent.name.split(" ")[0];
  return (
    <section id="bio" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-[0.8fr_1.2fr] gap-10 lg:gap-20">
          <div>
            <p className={eyebrow}>About {first}</p>
            <Heading className={`${h2Class} mt-3`}>
              {site.brokerage.name}
              {site.region ? ` — ${site.region}` : ""}
            </Heading>
          </div>
          <div className="rich-text space-y-5 text-[17px] leading-8 text-[var(--as-text)]/75" dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.bioHtml) }} />
        </div>
        {site.stats.length > 0 && (
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {site.stats.map((stat, i) => (
              <div key={i} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 px-6 py-6">
                <p className="font-display text-3xl font-semibold text-[var(--as-text)]">{stat.value}</p>
                <p className="mt-1 text-xs tracked-wide uppercase text-[var(--as-text)]/50">{stat.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function PortraitListings() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.listings.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  return (
    <section id="listings" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>Portfolio</p>
        <Heading className={`${h2Class} mt-3 mb-10`}>Featured properties</Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.listings.map((listing) => (
            <a key={listing.id} href={`/listings/${listing.slug}?from=${encodeURIComponent(agentSiteHref(site.slug, "/listings"))}`} className={`group block ${card} transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.45)]`}>
              <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                {listing.hero_photo_url && <img src={listing.hero_photo_url} alt={`${listing.address_line1}, ${listing.city}, ${listing.state}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                <span className="as-btn absolute top-3 left-3 bg-[var(--as-dark)] text-[var(--as-on-dark)] text-[10px] font-medium tracked-wide uppercase px-3 py-1.5">{STATUS_LABELS[listing.status] || listing.status}</span>
              </div>
              <div className="p-5">
                <div className="flex items-baseline justify-between gap-4">
                  <p className="font-medium text-[var(--as-text)] truncate">{listing.address_line1}</p>
                  <p className="font-display text-lg text-[var(--as-accent)] shrink-0">{formatPrice(listing.price)}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--as-text)]/60">
                  {listing.city}, {listing.state} {listing.zip}
                </p>
                <p className="mt-3 pt-3 border-t border-[var(--as-text)]/10 text-xs text-[var(--as-text)]/50">
                  {listing.beds} bd &nbsp;|&nbsp; {listing.baths} ba &nbsp;|&nbsp; {listing.sqft?.toLocaleString()} sqft
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PortraitTestimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;
  return (
    <section className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-6xl">
        <p className={`${eyebrow} text-center`}>Kind words</p>
        <h2 className={`${h2Class} text-center mt-3 mb-12`}>What clients say</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {site.testimonials.map((t) => (
            <figure key={t.id} className="bg-[var(--as-bg)] border border-[var(--as-text)]/10 p-7 flex flex-col">
              <span className="font-display text-5xl leading-none text-[var(--as-accent)] h-7 block" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="mt-3 font-display text-lg leading-snug text-[var(--as-text)] flex-1">
                <div className="rich-text inline [&>*]:inline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }} />
              </blockquote>
              <figcaption className="mt-6 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--as-accent)] text-white text-sm font-semibold">{(t.author || "?").trim().charAt(0).toUpperCase()}</span>
                <span className="text-xs tracked-wide uppercase text-[var(--as-text)]/55">{t.author}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PortraitAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.areas.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  return (
    <section id="areas" className="px-6 lg:px-10 py-24 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-6xl">
        <p className={eyebrow}>Areas of expertise</p>
        <Heading className={`${h2Class} mt-3 mb-10`}>Find your area</Heading>
        <div className="grid md:grid-cols-2 gap-5">
          {site.areas.map((area) => (
            <SiteLink key={area.id} slug={site.slug} path={`/areas/${area.slug}`} className={`group flex ${card} overflow-hidden transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.45)]`}>
              <div className="w-32 sm:w-44 shrink-0 bg-[var(--as-surface)] overflow-hidden">
                {area.photo_url && <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              </div>
              <div className="p-5 sm:p-6 flex flex-col justify-center min-w-0">
                <p className="font-display text-xl font-semibold text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{area.name}</p>
                {area.blurb && <p className="mt-1.5 text-sm leading-relaxed text-[var(--as-text)]/60">{area.blurb}</p>}
              </div>
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PortraitBlog({ posts, hasMore, standalone }) {
  const { site } = useAgentSiteContext();
  const Heading = standalone ? "h1" : "h2";
  return (
    <section id="blog" className="px-6 lg:px-10 py-24 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <p className={eyebrow}>From the blog</p>
        <Heading className={`${h2Class} mt-3 mb-10`}>Market insights</Heading>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {posts.map((post) => (
            <SiteLink key={post.id} slug={site.slug} path={`/blog/${post.slug}`} className="group block bg-[var(--as-bg)] border border-[var(--as-text)]/10 transition-shadow hover:shadow-[0_18px_40px_-22px_rgba(0,0,0,0.45)]">
              <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[16/10]">
                {post.featured && <FeaturedTag />}
                {post.image_url && <img src={post.image_url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              </div>
              <div className="p-5">
                {post.category && <p className="text-xs font-medium tracked-wide uppercase text-[var(--as-accent)]">{post.category}</p>}
                <p className="mt-2 font-medium leading-snug text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{post.title}</p>
              </div>
            </SiteLink>
          ))}
        </div>
        {hasMore && (
          <div className="mt-12 text-center">
            <SiteLink slug={site.slug} path="/blog" className={btn}>
              Read more
            </SiteLink>
          </div>
        )}
      </div>
    </section>
  );
}
