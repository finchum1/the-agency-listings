import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import BrandLogo from "../../BrandLogo";
import FlyerQr from "../FlyerQr";

const MAX_SIDE_PHOTOS = 3;

// Minimal editorial: white space, a large serif address, one unframed hero photo, the facts set in a single quiet line, then
// the story on the left with a column of photos on the right. The hero is a CSS background (not an <img>) for the same print
// reason as the Classic layout.
export default function EditorialSheet({ listing, agent, brokerage, headline, blurb, heroPhoto, printHeroUrl, galleryPhotos, includedFeatures, f, qrUrl, includeQr }) {
  const facts = [
    { label: "Beds", value: f.beds },
    { label: "Baths", value: f.baths },
    { label: "Sq Ft", value: f.sqft },
    { label: "Lot", value: f.lot },
    { label: "Built", value: f.year },
  ].filter((x) => x.value && x.value !== "—");
  const side = galleryPhotos.slice(0, MAX_SIDE_PHOTOS);

  return (
    <div id="flyer-sheet" className="relative mx-auto flex flex-col bg-[#faf9f7] text-[#1c1a17] overflow-hidden shadow-xl shadow-black/10" style={{ width: "8.5in", minHeight: "11in" }}>
      <div className="px-[0.6in] pt-[0.4in] flex items-center justify-between">
        <span className="text-[10px] font-semibold tracking-[0.28em] uppercase text-[#1c1a17]/60">
          {STATUS_LABELS[listing.status] || listing.status}
          {listing.mls_number ? <span className="text-[#1c1a17]/35"> &nbsp;·&nbsp; MLS# {listing.mls_number}</span> : null}
        </span>
        <BrandLogo src={brokerage.logo} name={brokerage.name} className="h-11 w-auto" />
      </div>

      <div className="px-[0.6in] pt-[0.26in]">
        <h1 className="font-display text-[40px] leading-[1.05] font-semibold tracking-tight">{headline}</h1>
        <p className="mt-2 text-[11px] tracking-[0.22em] uppercase text-[#1c1a17]/55">
          {listing.city}, {listing.state} {listing.zip}
        </p>
      </div>

      <div className="px-[0.6in] pt-[0.22in]">
        <div className="h-[3.4in] w-full bg-[#1c1a17]/10 bg-cover bg-center" style={heroPhoto ? { backgroundImage: `url(${printHeroUrl || heroPhoto.url})` } : undefined} />
      </div>

      <div className="px-[0.6in] pt-[0.22in]">
        <div className="flex items-end justify-between gap-6 border-b border-[#1c1a17]/15 pb-3">
          <span className="font-display text-[30px] leading-none font-semibold">{formatPrice(listing.price)}</span>
          <div className="flex items-center divide-x divide-[#1c1a17]/15">
            {facts.map((x) => (
              <div key={x.label} className="px-4 first:pl-0 last:pr-0 text-center">
                <p className="text-[15px] font-semibold leading-none">{x.value}</p>
                <p className="mt-1 text-[8px] tracking-[0.22em] uppercase text-[#1c1a17]/50">{x.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-[0.6in] pt-[0.22in] flex-1 flex gap-[0.35in]">
        <div className="min-w-0 flex-1">
          {blurb && <p className="font-display text-[15px] leading-[1.6] text-[#1c1a17]/85">{blurb}</p>}
          {includedFeatures.length > 0 && (
            <ul className="mt-4 columns-2 gap-6 text-[11px] leading-[1.9] text-[#1c1a17]/75">
              {includedFeatures.map((item, i) => (
                <li key={i} className="break-inside-avoid flex gap-2">
                  <span className="text-[#ed2127]">—</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {side.length > 0 && (
          <div className="shrink-0 w-[2.1in] flex flex-col gap-2">
            {side.map((photo) => (
              <div key={photo.id} className="h-[0.9in] w-full bg-[#1c1a17]/10 bg-cover bg-center" style={{ backgroundImage: `url(${photo.url})` }} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-[0.15in] px-[0.6in] pb-[0.3in]">
        <div className="border-t border-[#1c1a17]/15 pt-4 flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            {agent?.photo_url && <img src={agent.photo_url} alt="" className="h-[0.9in] w-[0.9in] rounded-full object-cover bg-black/5 shrink-0" />}
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold leading-tight">{agent?.full_name}</p>
              <p className="mt-0.5 text-[13px] text-[#1c1a17]/70">{agent?.phone}</p>
              <p className="text-[13px] text-[#1c1a17]/70">{agent?.email}</p>
              {agent?.license && <p className="mt-0.5 text-[10px] text-[#1c1a17]/45">{agent.license}</p>}
            </div>
          </div>
          {includeQr && qrUrl && (
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-[8px] font-semibold tracking-[0.22em] uppercase text-[#1c1a17]/60 text-right leading-snug">
                Scan for
                <br />
                photos &amp; details
              </p>
              <div className="w-[0.9in] bg-white p-0.5 border border-[#1c1a17]/15">
                <FlyerQr value={qrUrl} className="block w-full h-auto" label="QR code to the listing website" />
              </div>
            </div>
          )}
        </div>
        <p className="mt-3 text-[8px] leading-snug text-[#1c1a17]/40">
          {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}. {brokerage.disclaimer}
        </p>
      </div>
    </div>
  );
}
