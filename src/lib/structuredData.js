// Schema.org JSON-LD builders — pure functions returning plain objects,
// no DOM/Node-specific APIs, so this file works both in the browser
// bundle (injected via lib/pageMeta.js's applyStructuredData) and in the
// Vercel serverless functions (api/meta-*.js, embedded directly into the
// crawler-facing HTML snapshot's <head>). Same "one source of truth"
// reasoning as lib/seo.js, which this file deliberately mirrors.
//
// Every builder takes explicit named params rather than a raw Supabase
// row or an adapted client-side shape, since those two shapes differ
// (see adaptAgentSite.js/adaptListing.js) and callers on both sides
// already have to pull the right fields out anyway. JSON.stringify drops
// `undefined` values on its own, so passing `undefined` for a field that
// isn't known (e.g. a listing with no price yet) is enough — no need to
// strip anything before serializing.
//
// Real estate has no Google-blessed "rich result" the way Recipe/Product
// do — this is standard schema.org vocabulary for semantic-web value:
// helps Bing, aggregators, and AI-answer-style crawlers understand the
// page, and costs nothing if a given consumer ignores it.

const STATUS_AVAILABILITY = {
  for_sale: "https://schema.org/InStock",
  coming_soon: "https://schema.org/PreOrder",
  pending: "https://schema.org/LimitedAvailability",
  closed: "https://schema.org/SoldOut",
  off_market: "https://schema.org/OutOfStock",
};

export function buildListingSchema({
  url,
  address1,
  city,
  state,
  zip,
  price,
  status,
  beds,
  baths,
  sqft,
  description,
  images,
  datePosted,
}) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    url,
    name: [address1, city, state].filter(Boolean).join(", "),
    description: description || undefined,
    image: images?.length ? images : undefined,
    datePosted: datePosted || undefined,
    about: {
      "@type": "Residence",
      name: address1,
      address: {
        "@type": "PostalAddress",
        streetAddress: address1,
        addressLocality: city,
        addressRegion: state,
        postalCode: zip,
        addressCountry: "US",
      },
      numberOfBedrooms: beds ?? undefined,
      numberOfBathroomsTotal: baths ?? undefined,
      floorSize: sqft
        ? { "@type": "QuantitativeValue", value: sqft, unitCode: "FTK" }
        : undefined,
    },
    offers: {
      "@type": "Offer",
      price: price ?? undefined,
      priceCurrency: "USD",
      availability: STATUS_AVAILABILITY[status] || undefined,
      url,
    },
  };
}

export function buildAgentSchema({
  url,
  name,
  image,
  phone,
  email,
  jobTitle,
  region,
  license,
  brokerageName,
  brokerageAddress,
  sameAs,
}) {
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateAgent",
    name: name || undefined,
    url,
    image: image || undefined,
    telephone: phone || undefined,
    email: email || undefined,
    jobTitle: jobTitle || undefined,
    areaServed: region || undefined,
    hasCredential: license
      ? { "@type": "EducationalOccupationalCredential", name: `Real Estate License ${license}` }
      : undefined,
    worksFor: brokerageName
      ? {
          "@type": "Organization",
          name: brokerageName,
          address: brokerageAddress
            ? {
                "@type": "PostalAddress",
                streetAddress: brokerageAddress.line1,
                addressLocality: brokerageAddress.city,
                addressRegion: brokerageAddress.state,
                postalCode: brokerageAddress.zip,
                addressCountry: "US",
              }
            : undefined,
        }
      : undefined,
    sameAs: sameAs?.length ? sameAs : undefined,
  };
}

export function buildBlogPostSchema({
  url,
  headline,
  description,
  image,
  datePublished,
  dateModified,
  authorName,
  publisherName,
  publisherLogo,
}) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    url,
    headline,
    description: description || undefined,
    image: image || undefined,
    datePublished: datePublished || undefined,
    dateModified: dateModified || datePublished || undefined,
    author: authorName ? { "@type": "Person", name: authorName } : undefined,
    publisher: publisherName
      ? {
          "@type": "Organization",
          name: publisherName,
          logo: publisherLogo ? { "@type": "ImageObject", url: publisherLogo } : undefined,
        }
      : undefined,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
  };
}

// items: [{ name, url }], in order from the site root.
export function buildBreadcrumbSchema(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
