import { formatPrice, STATUS_LABELS } from "../../../lib/format";
import BrandLogo from "../../BrandLogo";
import FlyerQr from "../FlyerQr";

// Luxury dark: a near-black page, a cinematic hero photo that fades into it, white serif type, and the brand red used sparingly
// (a short rule, the feature dashes). No gold: it isn't a brand color. The office's white logo is used so it reads on black.
export default function LuxurySheet({ listing, agent, brokerage, headline, blurb, heroPhoto, printHeroUrl, galleryPhotos, includedFeatures, f, qrUrl, includeQr }) {
  const facts = [
    { label: "Beds", value: f.beds },
    { label: "Baths", value: f.baths },
    { label: "Sq Ft", value: f.sqft },
    { label: "Lot", value: f.lot },
    { label: "Built", value: f.year },
  ].filter((x) => x.value && x.value !== "—");
  const logo = brokerage.logos?.white || brokerage.logo;
  const strip = galleryPhotos.slice(0, 5);

  return (
    <div id="flyer-sheet" className="relative mx-auto flex flex-col bg-[#0f0e0c] text-[#f7f4ee] overflow-hidden shadow-xl shadow-black/30" style={{ width: "8.5in", minHeight: "11in" }}>
      <div className="relative h-[4.1in] w-full shrink-0">
        <div className="absolute inset-0 bg-[#1c1a17] bg-cover bg-center" style={heroPhoto ? { backgroundImage: `url(${printHeroUrl || heroPhoto.url})` } : undefined} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0c] via-[#0f0e0c]/25 to-black/30" />
        <div className="absolute top-[0.4in] left-[0.55in] right-[0.55in] flex items-center justify-between">
          <span className="text-[10px] font-semibold tracking-[0.3em] uppercase text-white border border-white/50 px-3 py-1.5">{STATUS_LABELS[listing.status] || listing.status}</span>
          <BrandLogo src={logo} name={brokerage.name} className="h-11 w-auto" />
        </div>
        <div className="absolute bottom-[0.1in] left-[0.55in] right-[0.55in]">
          <h1 className="font-display text-[38px] leading-[1.05] font-semibold tracking-tight text-white">{headline}</h1>
          <p className="mt-2 text-[11px] tracking-[0.24em] uppercase text-white/70">
            {listing.city}, {listing.state} {listing.zip}
          </p>
        </div>
      </div>

      <div data-flyer-body data-flyer-grow className="flex-1 px-[0.55in] pt-[0.2in]">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="h-[2px] w-10 bg-[#ed2127]" />
            <p className="mt-3 font-display text-[32px] leading-none font-semibold text-white">{formatPrice(listing.price)}</p>
          </div>
          {listing.mls_number && <span className="text-[10px] tracking-[0.24em] uppercase text-white/45">MLS# {listing.mls_number}</span>}
        </div>

        {facts.length > 0 && (
          <div className="mt-4 grid border-y border-white/20" style={{ gridTemplateColumns: `repeat(${facts.length}, minmax(0, 1fr))` }}>
            {facts.map((x, i) => (
              <div key={x.label} className={`py-3 text-center ${i > 0 ? "border-l border-white/15" : ""}`}>
                <p className="text-[17px] font-semibold leading-none text-white">{x.value}</p>
                <p className="mt-1.5 text-[8px] tracking-[0.24em] uppercase text-white/55">{x.label}</p>
              </div>
            ))}
          </div>
        )}

        {blurb && <p className="mt-4 font-display text-[14px] leading-[1.65] text-white/85">{blurb}</p>}

        {includedFeatures.length > 0 && (
          <ul className="mt-3 columns-2 gap-8 text-[11px] leading-[1.9] text-white/75">
            {includedFeatures.map((item, i) => (
              <li key={i} className="break-inside-avoid flex gap-2">
                <span className="text-[#ed2127]">—</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        )}

        {strip.length > 0 && (
          <div className="mt-4 grid gap-2" style={{ gridTemplateColumns: `repeat(${strip.length}, minmax(0, 1fr))` }}>
            {strip.map((photo) => (
              <div key={photo.id} className="h-[0.85in] w-full bg-white/10 bg-cover bg-center" style={{ backgroundImage: `url(${photo.url})` }} />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 mt-[0.15in] px-[0.55in] py-[0.2in] bg-[#1a1917] border-t border-white/15">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4 min-w-0">
            {agent?.photo_url && <img src={agent.photo_url} alt="" className="h-[0.9in] w-[0.9in] rounded-full object-cover bg-white/10 shrink-0" />}
            <div className="min-w-0">
              <p className="font-display text-xl font-semibold leading-tight text-white">{agent?.full_name}</p>
              <p className="mt-0.5 text-[13px] text-white/80">{agent?.phone}</p>
              <p className="text-[13px] text-white/80">{agent?.email}</p>
              {agent?.license && <p className="mt-0.5 text-[10px] text-white/45">{agent.license}</p>}
            </div>
          </div>
          {includeQr && qrUrl && (
            <div className="flex items-center gap-3 shrink-0">
              <p className="text-[8px] font-semibold tracking-[0.22em] uppercase text-white/70 text-right leading-snug">
                Scan for
                <br />
                photos &amp; details
              </p>
              <div className="w-[0.9in] bg-white p-1">
                <FlyerQr value={qrUrl} className="block w-full h-auto" label="QR code to the listing website" />
              </div>
            </div>
          )}
        </div>
        <p className="mt-3 text-[8px] leading-snug text-white/40">
          {brokerage.address.line1}, {brokerage.address.city}, {brokerage.address.state} {brokerage.address.zip}. {brokerage.disclaimer}
        </p>
      </div>
    </div>
  );
}
