import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import BrandLogo from "../../BrandLogo";
import FlyerQr from "../FlyerQr";

const STAT_ICONS = {
  beds: <path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6M3 18v2M21 18v2M3 12V9a2 2 0 0 1 2-2h3v5M9 7h6" />,
  baths: <path d="M4 12h16M6 12V6a2 2 0 0 1 2-2h1M6 12v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-6M9 18v2M15 18v2" />,
  sqft: <path d="M4 4h7v7H4zM13 13h7v7h-7zM4 20h4M20 4h-4" />,
  lot: <path d="M4 20 20 4M4 4h6M4 4v6M14 20h6M20 20v-6" />,
  year: <path d="M4 10h16M7 3v4M17 3v4M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />,
};

// The original flyer layout: a full-width hero photo with the headline over it, the price and logo, a stats card, the blurb and
// feature list, a photo row, and a footer with the agent, the office and the QR code. `f` is the stats (beds, baths, ...) already
// formatted by FlyerPage.
// The sheet is flex column, not fixed-height absolute blocks: the footer sits right after the content instead of being pinned to
// a positioned ancestor, and if the content runs long the sheet grows onto a second printed page instead of overlapping.
export default function ClassicSheet({ listing, agent, brokerage, headline, blurb, heroPhoto, printHeroUrl, galleryPhotos, includedFeatures, f, qrUrl, includeQr }) {
  return (
      <div
        id="flyer-sheet"
        className="relative mx-auto flex flex-col bg-[#faf9f7] text-[#1c1a17] overflow-hidden shadow-xl shadow-black/10"
        style={{ width: "8.5in", minHeight: "11in" }}
      >
        <div className="relative h-[4.2in] w-full shrink-0">
          {/* A CSS background-image, not an <img> — found live: Chrome's
              real print pipeline (window.print(), not just a screenshot
              or Playwright's page.pdf(), which don't reproduce this)
              reliably fails to rasterize an absolutely-positioned <img>
              using object-fit, even though absolutely-positioned <div>s
              (the badge/headline below) print fine. A background-image
              on a plain div is the standard, reliable workaround. */}
          <div
            className="absolute inset-0 bg-[#1c1a17] bg-cover bg-center"
            style={heroPhoto ? { backgroundImage: `url(${printHeroUrl || heroPhoto.url})` } : undefined}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
          <div className="absolute top-5 left-5 right-5">
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[10px] font-semibold tracking-wider-plus uppercase text-[#1c1a17]">
              {STATUS_LABELS[listing.status] || listing.status}
            </span>
          </div>
          <div className="absolute bottom-5 left-5 right-5">
            <h1 className="text-white text-3xl font-display font-semibold leading-tight">{headline}</h1>
            <p className="text-white/85 text-sm mt-1 tracking-wide">
              {listing.city}, {listing.state} {listing.zip}
            </p>
          </div>
        </div>

        <div className="px-6 pt-5 flex-1">
          {/* Logo centered between price and MLS# — a 3-column grid keeps
              it truly centered regardless of how wide either side is
              (unlike justify-between with a middle item), and still
              centers correctly when there's no MLS# to fill the right
              column. */}
          <div className="grid grid-cols-3 items-center">
            <span className="text-2xl font-display font-semibold text-[#1c1a17]">
              {formatPrice(listing.price)}
            </span>
            <BrandLogo src={brokerage.logo} name={brokerage.name} className="h-9 w-auto mx-auto" />
            {listing.mls_number && (
              <span className="text-[10px] tracking-wider-plus uppercase text-[#1c1a17]/40 justify-self-end">
                MLS# {listing.mls_number}
              </span>
            )}
          </div>

          <div className="mt-4 bg-white rounded-xl shadow-sm shadow-black/5 grid grid-cols-5 divide-x divide-black/5">
            {[
              { key: "beds", label: "Beds", value: f.beds },
              { key: "baths", label: "Baths", value: f.baths },
              { key: "sqft", label: "Sq Ft", value: f.sqft },
              { key: "lot", label: "Lot", value: f.lot },
              { key: "year", label: "Built", value: f.year },
            ].map((s) => (
              <div key={s.key} className="flex flex-col items-center justify-center gap-1 py-3 px-1 text-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="1.6">
                  {STAT_ICONS[s.key]}
                </svg>
                <span className="text-sm font-semibold text-[#1c1a17]">{s.value}</span>
                <span className="text-[9px] uppercase tracking-wider-plus text-[#1c1a17]/50">{s.label}</span>
              </div>
            ))}
          </div>

          {blurb && <p className="mt-4 text-[13px] leading-relaxed text-[#1c1a17]/75">{blurb}</p>}

          {includedFeatures.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1">
              {includedFeatures.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5 text-[11px] text-[#1c1a17]/75">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#ed2127" strokeWidth="2.5" className="shrink-0">
                    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="truncate">{item}</span>
                </div>
              ))}
            </div>
          )}

          {galleryPhotos.length > 0 && (
            <div className="mt-4 grid grid-cols-5 gap-2">
              {galleryPhotos.map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-black/5">
                  <img src={photo.url} alt="" className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 px-6 py-4 bg-white border-t border-black/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {agent?.photo_url && (
              <img src={agent.photo_url} alt="" className="h-[0.95in] w-[0.95in] rounded-full object-cover bg-black/5" />
            )}
            <div>
              <p className="text-xl font-display font-semibold leading-tight text-[#1c1a17]">{agent?.full_name}</p>
              <p className="mt-0.5 text-[13px] text-[#1c1a17]/70">{agent?.phone}</p>
              <p className="text-[13px] text-[#1c1a17]/70">{agent?.email}</p>
              {agent?.license && <p className="mt-0.5 text-[11px] text-[#1c1a17]/45">{agent.license}</p>}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] text-[#1c1a17]/50">
                {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state}{" "}
                {brokerage.address.zip}
              </p>
              <p className="text-[9px] text-[#1c1a17]/35 mt-0.5 max-w-[3in] ml-auto">{brokerage.disclaimer}</p>
              {includeQr && qrUrl && (
                <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-wider-plus text-[#1c1a17]/70">Scan for photos &amp; details</p>
              )}
            </div>
            {includeQr && qrUrl && (
              <div className="shrink-0 w-[0.95in] rounded-lg bg-white p-0.5 border border-black/10">
                <FlyerQr value={qrUrl} className="block w-full h-auto" label="QR code to the listing website" />
              </div>
            )}
          </div>
        </div>
      </div>
  );
}
