import useShowMore from "../../../hooks/useShowMore";
import ShowMoreButton from "../ShowMoreButton";
import { useAgentSiteContext } from "../../../context/AgentSiteContext";
import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import { agentSiteHref } from "../../../lib/agentSiteLinks";
import { sanitizeHtml } from "../../../lib/sanitizeHtml";
import SiteLink from "../SiteLink";
import FeaturedTag from "../FeaturedTag";

// "Bold statement" layout (agent_sites.layout = 'bold'). The same sections and data as the classic layout with the
// volume turned up: oversized uppercase type, full-bleed photos with text laid over them, solid blocks of the theme's
// accent color, big numbers. Colors come from the same --as-* theme tokens, so every color theme, font pairing and
// button style still works with it. Text that sits on a photo overlay stays hardcoded white (see Hero.jsx).

const label = "text-xs font-bold tracked-wide uppercase text-[var(--as-accent)]";
const bigHeading = "font-display font-bold uppercase tracking-tight leading-[0.92] text-5xl sm:text-6xl lg:text-7xl";

function Head({ eyebrow, children, Heading, onDark }) {
  const H = Heading || "h2";
  return (
    <div className="mb-12 sm:mb-16">
      <p className={label}>{eyebrow}</p>
      <H className={`${bigHeading} mt-4 ${onDark ? "text-[var(--as-on-dark)]" : "text-[var(--as-text)]"}`}>{children}</H>
      <div className="mt-6 h-2 w-24 bg-[var(--as-accent)]" />
    </div>
  );
}

const ctaClass = "as-btn inline-block text-sm font-bold tracked-wide uppercase px-10 py-5 bg-[var(--as-accent)] text-white transition duration-150 hover:opacity-90 active:scale-[0.98]";

export function BoldHero() {
  const { site } = useAgentSiteContext();
  const words = (site.agent.name || "").split(" ").filter(Boolean);
  return (
    <section className="relative h-screen min-h-[700px] w-full overflow-hidden">
      {site.heroVideo ? (
        <video className="absolute inset-0 h-full w-full object-cover" src={site.heroVideo} poster={site.heroPhoto} autoPlay muted loop playsInline />
      ) : site.heroPhoto ? (
        <img src={site.heroPhoto} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 bg-[var(--as-dark)]" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/25" />
      {/* A soft shade behind the nav so its white links stay readable over a bright sky. */}
      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="relative z-10 flex h-full flex-col justify-end px-6 lg:px-10 pb-28 max-w-7xl mx-auto">
        <h1 className="font-display font-bold uppercase tracking-tighter leading-[0.88] text-white text-6xl sm:text-8xl lg:text-[9.5rem]">
          {words.map((w, i) => (
            <span key={i} className="block">
              {w}
            </span>
          ))}
        </h1>
        {site.tagline && <p className="mt-8 max-w-xl border-l-4 border-[var(--as-accent)] pl-5 text-white/90 text-lg sm:text-xl leading-snug">{site.tagline}</p>}
        <div className="mt-10">
          <SiteLink slug={site.slug} path="/contact" className={ctaClass}>
            Let&rsquo;s connect
          </SiteLink>
        </div>
      </div>
      {(site.region || site.agent.title || site.agent.license) && (
        <div className="absolute bottom-0 inset-x-0 z-10 border-t-4 border-[var(--as-accent)] bg-black/70 backdrop-blur-sm">
          <div className="mx-auto max-w-7xl px-6 lg:px-10 py-3.5 flex flex-wrap gap-x-8 gap-y-1 text-[11px] font-bold tracked-wide uppercase text-white/85">
            {site.agent.title && <span>{site.agent.title}</span>}
            {site.region && <span>{site.region}</span>}
            {site.agent.license && <span>{site.agent.license}</span>}
          </div>
        </div>
      )}
    </section>
  );
}

export function BoldBio() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (!site.bioHtml && site.stats.length === 0) return null;
  const Heading = isStandalonePage ? "h1" : "h2";
  const first = site.agent.name.split(" ")[0];
  return (
    <section id="bio" className="px-6 lg:px-10 py-24 sm:py-32 bg-[var(--as-dark)] text-[var(--as-on-dark)]">
      <div className="mx-auto max-w-7xl grid lg:grid-cols-[0.9fr_1.1fr] gap-16 lg:gap-24 items-center">
        <div className="relative max-w-md mx-auto lg:mx-0 w-full">
          <div className="absolute -bottom-5 -right-5 inset-0 bg-[var(--as-accent)]" aria-hidden="true" />
          <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/5]">
            {site.agent.photo && <img src={site.agent.photo} alt={site.agent.name} className="h-full w-full object-cover" />}
          </div>
        </div>
        <div>
          <p className={label}>About {first}</p>
          <Heading className={`${bigHeading} mt-4 text-[var(--as-on-dark)] text-4xl sm:text-5xl lg:text-6xl`}>
            {site.brokerage.name}
            {site.region ? ` — ${site.region}` : ""}
          </Heading>
          <div className="mt-6 h-2 w-24 bg-[var(--as-accent)]" />
          <div className="rich-text mt-8 space-y-4 text-lg leading-relaxed text-[var(--as-on-dark)]/80 max-w-xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(site.bioHtml) }} />
        </div>
      </div>
      {site.stats.length > 0 && (
        <div className="mx-auto max-w-7xl mt-20 sm:mt-28 grid grid-cols-2 lg:grid-cols-4 gap-px bg-[var(--as-on-dark)]/15 border-y border-[var(--as-on-dark)]/15">
          {site.stats.map((stat, i) => (
            <div key={i} className="bg-[var(--as-dark)] py-8 px-2 sm:px-6">
              <p className="font-display font-bold text-5xl sm:text-6xl tracking-tight text-[var(--as-accent)]">{stat.value}</p>
              <p className="mt-2 text-xs font-bold tracked-wide uppercase text-[var(--as-on-dark)]/60">{stat.label}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function BoldListings() {
  const { site, isStandalonePage } = useAgentSiteContext();
  if (site.listings.length === 0) return null;
  return (
    <section id="listings" className="px-6 lg:px-10 py-24 sm:py-32 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <Head eyebrow="Portfolio" Heading={isStandalonePage ? "h1" : "h2"}>
          Featured
          <br />
          properties
        </Head>
        <div className="grid sm:grid-cols-2 gap-5">
          {site.listings.map((listing) => (
            <a key={listing.id} href={`/listings/${listing.slug}?from=${encodeURIComponent(agentSiteHref(site.slug, "/listings"))}`} className="group relative block overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
              {listing.hero_photo_url && <img src={listing.hero_photo_url} alt={`${listing.address_line1}, ${listing.city}, ${listing.state}`} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
              <span className="as-btn absolute top-5 left-5 bg-black/75 text-white text-[10px] font-bold tracked-wide uppercase px-3 py-1.5">{STATUS_LABELS[listing.status] || listing.status}</span>
              <span className="as-btn absolute top-5 right-5 bg-[var(--as-accent)] text-white font-display text-lg font-bold px-4 py-1.5">{formatPrice(listing.price)}</span>
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-7">
                <p className="font-display text-2xl sm:text-3xl font-bold uppercase leading-tight text-white">{listing.address_line1}</p>
                <p className="mt-1 text-sm text-white/80">
                  {listing.city}, {listing.state} · {listing.beds} bd · {listing.baths} ba · {listing.sqft?.toLocaleString()} sqft
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BoldTestimonials() {
  const { site } = useAgentSiteContext();
  if (site.testimonials.length === 0) return null;
  return (
    <section className="px-6 lg:px-10 py-24 sm:py-32 bg-[var(--as-accent)] text-white">
      <div className="mx-auto max-w-7xl">
        <p className="text-xs font-bold tracked-wide uppercase text-white/75">What clients say</p>
        <div className="mt-10 grid md:grid-cols-2 lg:grid-cols-3 gap-x-12 gap-y-16">
          {site.testimonials.map((t) => (
            <figure key={t.id}>
              <span className="font-display font-bold text-8xl leading-[0.6] text-white/35 block h-10" aria-hidden="true">
                &ldquo;
              </span>
              <blockquote className="font-display text-2xl font-semibold leading-snug">
                <div className="rich-text inline [&>*]:inline" dangerouslySetInnerHTML={{ __html: sanitizeHtml(t.quote) }} />
              </blockquote>
              <figcaption className="mt-6 text-xs font-bold tracked-wide uppercase text-white/75">— {t.author}</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

export function BoldAreas() {
  const { site, isStandalonePage } = useAgentSiteContext();
  const more = useShowMore(site.areas);
  if (site.areas.length === 0) return null;
  return (
    <section id="areas" className="px-6 lg:px-10 py-24 sm:py-32 bg-[var(--as-bg-alt)] border-y border-[var(--as-text)]/10">
      <div className="mx-auto max-w-7xl">
        <Head eyebrow="Areas of expertise" Heading={isStandalonePage ? "h1" : "h2"}>
          Find your
          <br />
          area
        </Head>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {more.shown.map((area, i) => (
            <SiteLink key={area.id} slug={site.slug} path={`/areas/${area.slug}`} className="group relative block overflow-hidden bg-[var(--as-surface)] aspect-[3/4]">
              {area.photo_url && <img src={area.photo_url} alt={area.name} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/10" />
              <span className="absolute top-5 left-5 font-display text-4xl font-bold text-white/80">{String(i + 1).padStart(2, "0")}</span>
              <div className="absolute inset-x-0 bottom-0 p-7">
                <p className="font-display text-3xl sm:text-4xl font-bold uppercase leading-none text-white">{area.name}</p>
                {area.blurb && <p className="mt-3 text-sm text-white/80 max-w-xs">{area.blurb}</p>}
                <div className="mt-5 h-1.5 w-12 bg-[var(--as-accent)] transition-all duration-300 group-hover:w-24" />
              </div>
            </SiteLink>
          ))}
        </div>
        <ShowMoreButton more={more} />
      </div>
    </section>
  );
}

export function BoldBlog({ posts, hasMore, standalone }) {
  const { site } = useAgentSiteContext();
  return (
    <section id="blog" className="px-6 lg:px-10 py-24 sm:py-32 bg-[var(--as-bg)]">
      <div className="mx-auto max-w-7xl">
        <Head eyebrow="From the blog" Heading={standalone ? "h1" : "h2"}>
          Market
          <br />
          insights
        </Head>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-14">
          {posts.map((post, i) => (
            <SiteLink key={post.id} slug={site.slug} path={`/blog/${post.slug}`} className="group block">
              <div className="relative overflow-hidden bg-[var(--as-surface)] aspect-[4/3]">
                {post.featured && <FeaturedTag />}
                {post.image_url && <img src={post.image_url} alt={post.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />}
                <span className="absolute bottom-0 left-0 bg-[var(--as-accent)] text-white font-display text-2xl font-bold px-4 py-2">{String(i + 1).padStart(2, "0")}</span>
              </div>
              {post.category && <p className="mt-5 text-xs font-bold tracked-wide uppercase text-[var(--as-accent)]">{post.category}</p>}
              <p className="mt-2 font-display text-2xl font-bold leading-tight text-[var(--as-text)] group-hover:text-[var(--as-accent)] transition-colors">{post.title}</p>
            </SiteLink>
          ))}
        </div>
        {hasMore && (
          <div className="mt-16">
            <SiteLink slug={site.slug} path="/blog" className={ctaClass}>
              Read more
            </SiteLink>
          </div>
        )}
      </div>
    </section>
  );
}
