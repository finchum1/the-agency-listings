import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useListing } from "../../hooks/useListing";
import { brandFromOrg } from "../../lib/brand";
import { FORMATS, POST_TYPES, defaultType, drawPost, loadPicture, loadPostFonts, startingText } from "../../lib/socialPost";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = `block text-xs font-medium mb-1.5 ${muted}`;
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5 space-y-4";

function Segments({ options, value, onChange, label }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map(([key, text, note]) => (
        <button
          key={key}
          type="button"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            value === key
              ? "border-[#1c1a17] dark:border-[#faf9f7] bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17] font-semibold"
              : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
          }`}
        >
          {text}
          {note && <span className="ml-1.5 text-[11px] opacity-60">{note}</span>}
        </button>
      ))}
    </div>
  );
}

// Social posts for a listing: pick Instagram square or Story, and New Listing, Under Contract, Open House or Closed; change the photo and the words;
// download a PNG. The post is drawn by lib/socialPost.js on a canvas, so what the preview shows is what downloads. Nothing here is saved to the listing.
export default function SocialPostPage() {
  const { id } = useParams();
  const { user, isAdmin } = useAuth();
  const { listing, agent, photos, openHouses, loading } = useListing({ id });
  const brokerage = brandFromOrg(listing?.org);
  const noAccess = listing && !isAdmin && listing.agent_id !== user?.id;

  const [format, setFormat] = useState("square");
  const [type, setType] = useState("new");
  const [text, setText] = useState(null);
  const [photoId, setPhotoId] = useState(null);
  const [upload, setUpload] = useState(null); // { url, name } for a picture added from the computer
  const [zoom, setZoom] = useState(1);
  const [ox, setOx] = useState(0);
  const [oy, setOy] = useState(0);
  const [logoKey, setLogoKey] = useState("white");
  const [pictures, setPictures] = useState({ photo: null, logo: null });
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef(null);
  const cache = useRef(new Map());

  // Start from where the listing stands: its kind of post, and its words.
  useEffect(() => {
    if (loading || !listing || text) return;
    const first = defaultType(listing);
    setType(first);
    setText(startingText(listing, agent, first, openHouses));
  }, [loading, listing, agent, openHouses, text]);
  useEffect(() => {
    if (photoId || upload || photos.length === 0) return;
    setPhotoId((photos.find((p) => p.is_hero) || photos[0]).id);
  }, [photos, photoId, upload]);
  useEffect(() => {
    loadPostFonts().then(() => setFontsReady(true));
  }, []);

  const photoUrl = upload?.url || photos.find((p) => p.id === photoId)?.url || "";
  const logoUrl = brokerage.logos?.[logoKey] || brokerage.logo || "";

  const picture = useCallback(async (url) => {
    if (!url) return null;
    if (!cache.current.has(url)) cache.current.set(url, loadPicture(url));
    try {
      return await cache.current.get(url);
    } catch (err) {
      cache.current.delete(url);
      throw err;
    }
  }, []);
  useEffect(() => {
    let live = true;
    setError("");
    Promise.all([picture(photoUrl), picture(logoUrl).catch(() => null)])
      .then(([photo, logo]) => live && setPictures({ photo, logo }))
      .catch((err) => live && setError(err.message || "Couldn't load the picture."));
    return () => {
      live = false;
    };
  }, [photoUrl, logoUrl, picture]);

  // Redraw whenever anything the post shows changes.
  useEffect(() => {
    if (!canvasRef.current || !text || !fontsReady) return;
    drawPost(canvasRef.current, { format, type, zoom, ox, oy, text }, pictures);
  }, [format, type, zoom, ox, oy, text, pictures, fontsReady]);

  const pickType = (next) => {
    setType(next);
    // The kind of post sets the big word, the price and (for an open house) the date line; the rest of the words stay as edited.
    const fresh = startingText(listing, agent, next, openHouses);
    setText((t) => ({ ...t, badge: fresh.badge, showPrice: fresh.showPrice, detailDay: fresh.detailDay, detailTime: fresh.detailTime }));
  };
  const edit = (key) => (e) => setText((t) => ({ ...t, [key]: e.target.value }));
  const flag = (key) => (e) => setText((t) => ({ ...t, [key]: e.target.checked }));

  const onUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (upload?.url) URL.revokeObjectURL(upload.url);
    setUpload({ url: URL.createObjectURL(file), name: file.name });
    setZoom(1);
    setOx(0);
    setOy(0);
    e.target.value = "";
  };
  const choosePhoto = (pid) => {
    setUpload(null);
    setPhotoId(pid);
    setZoom(1);
    setOx(0);
    setOy(0);
  };

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("The picture couldn't be saved. Try another photo.");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const slug = (listing.address_line1 || "listing").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      a.download = `${slug}-${type}-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  if (loading || !text) return <p className={`text-sm ${muted}`}>Loading…</p>;
  if (!listing) return <p className={`text-sm ${muted}`}>Listing not found.</p>;
  if (noAccess) return <p className={`text-sm ${muted}`}>You can only make posts for your own listings.</p>;

  const { w, h } = FORMATS[format];
  return (
    <div className="space-y-6">
      <div>
        <Link to={`/dashboard/listings/${listing.id}`} className={`text-xs font-semibold hover:underline ${muted}`}>
          ← {listing.address_line1}
        </Link>
        <h1 className="mt-2 text-2xl font-display font-semibold">Social post</h1>
        <p className={`mt-1 text-sm ${muted}`}>Pick a size and a kind of post, change the photo or the words, then download it to post.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        <div className="lg:sticky lg:top-6 space-y-3">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`${POST_TYPES[type].label} post preview`}
            className="w-full rounded-xl border border-black/10 dark:border-white/15 bg-[#14130f]"
            style={{ aspectRatio: `${w} / ${h}`, maxHeight: "78vh", width: format === "story" ? "auto" : "100%", maxWidth: "100%" }}
          />
          <button
            type="button"
            onClick={download}
            disabled={!pictures.photo}
            className="w-full rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-3 hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Download PNG ({w} × {h})
          </button>
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="space-y-5">
          <section className={card}>
            <div>
              <label className={labelClass}>Size</label>
              <Segments label="Size" value={format} onChange={setFormat} options={Object.entries(FORMATS).map(([k, f]) => [k, f.label, f.note])} />
            </div>
            <div>
              <label className={labelClass}>Kind of post</label>
              <Segments label="Kind of post" value={type} onChange={pickType} options={Object.entries(POST_TYPES).map(([k, t]) => [k, t.label])} />
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display text-base font-semibold">Words</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass} htmlFor="sp-badge">Big word</label>
                <input id="sp-badge" value={text.badge} onChange={edit("badge")} maxLength={28} className={inputClass} />
              </div>
              {type === "open" && (
                <>
                  <div>
                    <label className={labelClass} htmlFor="sp-day">Open house day</label>
                    <input id="sp-day" value={text.detailDay} onChange={edit("detailDay")} placeholder="Sunday, November 8" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor="sp-time">Time</label>
                    <input id="sp-time" value={text.detailTime} onChange={edit("detailTime")} placeholder="1 – 3 PM" className={inputClass} />
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <label className={labelClass} htmlFor="sp-address">Address</label>
                <input id="sp-address" value={text.address} onChange={edit("address")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="sp-place">City line</label>
                <input id="sp-place" value={text.place} onChange={edit("place")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="sp-specs">Details</label>
                <input id="sp-specs" value={text.specs} onChange={edit("specs")} className={inputClass} />
              </div>
              <div>
                <label className={labelClass} htmlFor="sp-price">Price</label>
                <input id="sp-price" value={text.price} onChange={edit("price")} className={inputClass} />
                <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={text.showPrice} onChange={flag("showPrice")} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                  Show the price
                </label>
              </div>
              <div>
                <label className={labelClass} htmlFor="sp-agent">Your line</label>
                <input id="sp-agent" value={text.agent} onChange={edit("agent")} className={inputClass} />
                <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={text.showAgent} onChange={flag("showAgent")} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                  Show it
                </label>
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display text-base font-semibold">Photo</h2>
            {photos.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2" role="group" aria-label="Listing photos">
                {photos.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => choosePhoto(p.id)}
                    aria-pressed={!upload && photoId === p.id}
                    aria-label="Use this photo"
                    className={`aspect-square overflow-hidden rounded-lg border-2 ${!upload && photoId === p.id ? "border-[#ed2127] dark:border-[#f2454b]" : "border-transparent hover:border-black/20 dark:hover:border-white/30"}`}
                  >
                    <img src={p.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <label className="cursor-pointer rounded-full border border-black/15 dark:border-white/20 px-4 py-1.5 text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10">
                Use a photo from my computer
                <input type="file" accept="image/*" onChange={onUpload} className="sr-only" />
              </label>
              {upload && <span className={`text-xs ${muted}`}>{upload.name}</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Zoom", zoom, setZoom, 1, 2.5, 0.05],
                ["Move left / right", ox, setOx, -1, 1, 0.02],
                ["Move up / down", oy, setOy, -1, 1, 0.02],
              ].map(([name, value, set, min, max, step]) => (
                <label key={name} className="block">
                  <span className={labelClass}>{name}</span>
                  <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(Number(e.target.value))} className="w-full accent-[#ed2127] dark:accent-[#f2454b]" />
                </label>
              ))}
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display text-base font-semibold">Logo</h2>
            <Segments
              label="Logo color"
              value={logoKey}
              onChange={setLogoKey}
              options={["white", "red", "black"].filter((k) => brokerage.logos?.[k]).map((k) => [k, k[0].toUpperCase() + k.slice(1)])}
            />
            <p className={`text-xs ${muted}`}>White reads best on most photos. Try another if the photo is very light.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
