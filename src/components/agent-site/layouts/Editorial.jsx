import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import { agentSiteHref } from "../../../lib/agentSiteLinks";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import SiteLink from "../SiteLink";

// "Minimal editorial" layout (agent_sites.layout = 'editorial'). The same sections and data as the classic layout,
// arranged like a magazine: light and airy, big quiet serif type, thin rules, photos captioned underneath instead of
// covered with text, and testimonials as pull-quotes. Colors come from the same --as-* theme tokens, so every color
// theme, font pairing and button style still works with it.

const eyebrow = "text-[11px] font-medium tracked-wide uppercase text-[var(--as-text)]/50";
const h2Class = "font-display text-4xl sm:text-5xl font-normal tracking-tight leading-[1.05] text-[var(--as-text)]";

function SectionHead({ label, children, center, Heading }) {
  const H = Heading || "h2";
  return (
    <div className={`${center ? "text-center" : ""} mb-14`}>
      <p className={eyebrow}>{label}</p>
      <H className={`${h2Class} mt-4`}>{children}</H>
      <div className={`mt-6 h-px w-16 bg-[var(--as-accent)] ${center ? "mx-auto" : ""}`} />
    </div>
  );
}

export function EditorialHero() {
  const { site } = useAgentSiteContext();
  return (
    <section className="px-6 lg:px-10 pt-36 sm:pt-44 pb-20 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-6xl">
        <div className="mx-auto max-w-3xl text-center">
          {site.region && <p className={eyebrow}>{site.region}</p>}
          <h1 className="font-display text-5xl sm:text-6xl lg:text-7xl font-normal tracking-tight leading-[1.02] text-[var(--as-text)] mt-6">{site.agent.name}</h1>
          {site.tagline && <p className="font-display italic text-xl sm:text-2xl leading-snug text-[var(--as-text)]/65 mt-6">{site.tagline}</p>}
          <div className="mx-auto mt-9 h-px w-16 bg-[var(--as-accent)]" />
          <SiteLink
            slug={site.slug}
            path="/contact"
            className="inline-block mt-8 text-xs font-medium tracked-wide uppercase text-[var(--as-text)] border-b border-[var(--as-text)] pb-1 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]"
          >
            Let&rsquo;s connect &rarr;
          </SiteLink>
        </div>
        <div className="mt-16 overflow-hidden bg-[var(--as-surface)] aspect-[4/3] sm:aspect-[16/9]">
          {site.heroVideo ? (
            <video className="h-full w-full object-cover" src={site.heroVideo} poster={site.heroPhoto} autoPlay muted loop playsInline />
          ) : site.heroPhoto ? (
            <img src={site.heroPhoto} alt="" className="h-full w-full object-cover object-top" />
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function EditorialBio() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (!site.bioHtml && site.stats.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  const first = site.agent.name.split(" ")[0];
  const drop =
    "[&>p:first-child]:first-letter:float-left [&>p:first-child]:first-letter:font-display [&>p:first-child]:first-letter:text-6xl [&>p:first-child]:first-letter:leading-[0.85] [&>p:first-child]:first-letter:pr-3 [&>p:first-child]:first-letter:pt-1 [&>p:first-child]:first-letter:text-[var(--as-accent)]";

  return (
    <section id="bio" className="px-6 lg:px-10 py-28 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-6xl grid lg:grid-cols-[0.8fr_1.2fr] gap-14 lg:gap-24 items-center">
        <figure>
          <div className="overflow-hidden bg-[var(--as-surface)] aspect-[3/4] max-w-sm mx-auto lg:mx-0">
            {site.agent.photo && <img src={site.agent.photo} alt={site.agent.name} className="h-full w-full object-cover" />}
          </div>
          <figcaption className="mt-4 max-w-sm mx-auto lg:mx-0 text-[11px] tracked-wide uppercase text-[var(--as-text)]/45">
            {site.agent.name}
            {site.agent.title ? ` · ${site.agent.title}` : ""}
          </figcaption>
        </figure>

        <div>
          <p className={eyebrow}>About {first}</p>
          <Heading className={`${h2Class} mt-4`}>
            {site.brokerage.name}
            {site.region ? ` — ${site.region}` : ""}
          </Heading>
          <div className="mt-6 h-px w-16 bg-[var(--as-accent)]" />
          <div className={`rich-text mt-8 space-y-5 text-[17px] leading-8 text-[var(--as-text)]/75 max-w-xl ${drop}`} dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.bioHtml) }} />

          {site.stats.length > 0 && (
            <div className="mt-12 flex flex-wrap border-t border-[var(--as-text)]/10 pt-8 max-w-xl">
              {site.stats.map((stat, i) => (
                <div key={i} className={`pr-8 mr-8 ${i < site.stats.length - 1 ? "border-r border-[var(--as-text)]/15" : ""}`}>
                  <p className="font-display text-4xl font-normal text-[var(--as-text)]">{stat.value}</p>
                  <p className="text-[11px] tracked-wide uppercase text-[var(--as-text)]/50 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function EditorialListings() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.listings.length === 0) return null;
  return (
    <section id="listings" className="px-6 lg:px-10 py-28 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-6xl">
        <SectionHead label="Portfolio" Heading={isStandalonePage ? "h1" : "h2"}>
          Featured properties
        </SectionHead>
        <div className="grid sm:grid-cols-2 gap-x-12 gap-y-16">
          {site.listings.map((listing) => (
            <a key={listing.id} href={`/listings/${listing.slug}?from=${encodeURIComponent(agentSiteHref(site.slug, "/listings"))}`} className="group block">
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[3/2]">
                {listing.hero_photo_url && (
                  <img src={listing.hero_photo_url} alt={`${listing.address_line1}, ${listing.city}, ${listing.state}`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                )}
              </div>
              <div className="mt-5 flex items-baseline justify-between gap-6 border-b border-[var(--as-text)]/15 pb-4">
                <div className="min-w-0">
                  <p className="font-display text-2xl text-[var(--as-text)] truncate">{listing.address_line1}</p>
                  <p className="text-sm text-[var(--as-text)]/55 mt-1">
                    {listing.city}, {listing.state} {listing.zip}
                  </p>
                </div>
                <p className="font-display text-xl text-[var(--as-accent)] shrink-0">{formatPrice(listing.price)}</p>
              </div>
              <p className="mt-3 text-[11px] tracked-wide uppercase text-[var(--as-text)]/50">
                {STATUS_LABELS[listing.status] || listing.status} &nbsp;·&nbsp; {listing.beds} bd &nbsp;·&nbsp; {listing.baths} ba &nbsp;·&nbsp; {listing.sqft?.toLocaleString()} sqft
              </p>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialTestimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;
  return (
    <section className="px-6 lg:px-10 py-28 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-3xl">
        <p className={`${eyebrow} text-center mb-14`}>Kind words</p>
        <div className="divide-y divide-[var(--as-text)]/15">
          {site.testimonials.map((t) => (
            <figure key={t.id} className="py-14 first:pt-0 last:pb-0 text-center">
              <span className="font-display text-6xl leading-none text-[var(--as-accent)] block h-8" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="font-display italic text-2xl sm:text-3xl leading-snug text-[var(--as-text)] mt-4">
                <div className="rich-text inline [&>*]:inline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }} />
              </blockquote>
              <figcaption className="mt-6 text-[11px] tracked-wide uppercase text-[var(--as-text)]/50">{t.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.areas.length === 0) return null;
  return (
    <section id="areas" className="px-6 lg:px-10 py-28 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-6xl">
        <SectionHead label="Areas of expertise" Heading={isStandalonePage ? "h1" : "h2"}>
          Find your area
        </SectionHead>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-14">
          {site.areas.map((area) => (
            <SiteLink key={area.id} slug={site.slug} path={`/areas/${area.slug}`} className="group block">
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[4/5]">
                {area.photo_url && <img src={area.photo_url} alt={area.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
              </div>
              <p className="mt-5 font-display text-2xl text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{area.name}</p>
              {area.blurb && <p className="mt-2 text-sm leading-relaxed text-[var(--as-text)]/60 max-w-xs">{area.blurb}</p>}
            </SiteLink>
          ))}
        </div>
      </div>
    </section>
  );
}

export function EditorialBlog({ posts, hasMore, standalone }) {
  const { site } = useAgentSiteContext();
  return (
    <section id="blog" className="px-6 lg:px-10 py-28 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-4xl">
        <SectionHead label="From the blog" Heading={standalone ? "h1" : "h2"}>
          Market insights
        </SectionHead>
        <div className="border-b border-[var(--as-text)]/15">
          {posts.map((post) => (
            <SiteLink key={post.id} slug={site.slug} path={`/blog/${post.slug}`} className="group grid sm:grid-cols-[1fr_200px] gap-6 sm:gap-10 items-center py-8 border-t border-[var(--as-text)]/15">
              <div>
                {post.category && <p className="text-[11px] font-medium tracked-wide uppercase text-[var(--as-accent)]">{post.category}</p>}
                <p className="mt-2 font-display text-2xl sm:text-3xl leading-snug text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{post.title}</p>
              </div>
              <div className="overflow-hidden bg-[var(--as-surface)] aspect-[4/3] order-first sm:order-none">
                {post.image_url && <img src={post.image_url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />}
              </div>
            </SiteLink>
          ))}
        </div>
        {hasMore && (
          <div className="mt-12 text-center">
            <SiteLink slug={site.slug} path="/blog" className="inline-block text-xs font-medium tracked-wide uppercase text-[var(--as-text)] border-b border-[var(--as-text)] pb-1 transition-colors hover:text-[var(--as-accent)] hover:border-[var(--as-accent)]">
              Read more &rarr;
            </SiteLink>
          </div>
        )}
      </div>
    </section>
  );
}
