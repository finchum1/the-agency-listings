import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useOrg } from "../../context/OrgContext";
import { brandFromOrg } from "../../lib/brand";
import { FORMATS, HOLIDAYS, LAYOUTS, drawHoliday, isLight, loadPicture, loadPostFonts, paletteFor, upcomingHolidays } from "../../lib/holidayPost";

const muted = "text-[#1c1a17]/55 dark:text-[#faf9f7]/55";
const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const labelClass = `block text-xs font-medium mb-1.5 ${muted}`;
const card = "bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-5 space-y-4";
const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

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

// A holiday greeting on a solid brand color, as an Instagram square or a Story. Not tied to a listing. Drawn by lib/holidayPost.js on a canvas, so what the
// preview shows is what downloads. Nothing is saved.
export default function HolidayPostPage() {
  const { profile } = useAuth();
  const { org } = useOrg();
  const brokerage = brandFromOrg(org);
  const today = localToday();
  const holidays = useMemo(() => upcomingHolidays(today), [today]);
  const palette = useMemo(() => paletteFor(brokerage.accentColors), [brokerage.accentColors]);

  const first = holidays[0];
  const [holidayId, setHolidayId] = useState(first.id);
  const [custom, setCustom] = useState(false);
  const [format, setFormat] = useState("square");
  const [layout, setLayout] = useState("centered");
  const [bg, setBg] = useState(palette[0]?.hex || "#ed2127");
  const [text, setText] = useState({
    greeting: first.greeting,
    message: first.message,
    showSign: true,
    signoff: [profile?.full_name, profile?.phone].filter(Boolean).join("  ·  "),
    showPhoto: true,
  });
  const [pictures, setPictures] = useState({ logo: null, photo: null });
  const [logos, setLogos] = useState({ onLight: null, onDark: null });
  const [fontsReady, setFontsReady] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef(null);

  // Keep the sign-off in step with the profile once it loads (until it has been edited by hand).
  const signTouched = useRef(false);
  useEffect(() => {
    if (signTouched.current || !profile) return;
    setText((t) => ({ ...t, signoff: [profile.full_name, profile.phone].filter(Boolean).join("  ·  ") }));
  }, [profile]);

  useEffect(() => {
    loadPostFonts().then(() => setFontsReady(true));
  }, []);
  // The organization's colors can arrive after the page opens: keep the chosen color one the palette still has.
  useEffect(() => {
    if (!palette.some((c) => c.hex === bg)) setBg(palette[0].hex);
  }, [palette, bg]);
  useEffect(() => {
    let live = true;
    const get = (u) => (u ? loadPicture(u).catch(() => null) : Promise.resolve(null));
    Promise.all([get(brokerage.logos?.white || brokerage.logo), get(brokerage.logos?.red || brokerage.logos?.black || brokerage.logo), get(profile?.photo_url)]).then(([onDark, onLight, photo]) => {
      if (!live) return;
      setLogos({ onDark, onLight });
      setPictures({ logo: onDark || onLight, photo });
    });
    return () => {
      live = false;
    };
  }, [brokerage.logos, brokerage.logo, profile?.photo_url]);

  useEffect(() => {
    if (!canvasRef.current || !fontsReady) return;
    try {
      drawHoliday(canvasRef.current, { format, layout, bg, text }, pictures, logos);
    } catch (err) {
      setError(err.message);
    }
  }, [format, layout, bg, text, pictures, logos, fontsReady]);

  const pick = (id) => {
    setHolidayId(id);
    setCustom(false);
    const h = HOLIDAYS.find((x) => x.id === id);
    setText((t) => ({ ...t, greeting: h.greeting, message: h.message }));
  };
  const edit = (k) => (e) => setText((t) => ({ ...t, [k]: e.target.value }));
  const flag = (k) => (e) => setText((t) => ({ ...t, [k]: e.target.checked }));

  const download = () => {
    canvasRef.current?.toBlob((blob) => {
      if (!blob) {
        setError("The picture couldn't be saved.");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const name = (custom ? "greeting" : holidayId) || "holiday";
      a.download = `${name}-${layout}-${format}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  const { w, h } = FORMATS[format];
  return (
    <div className="space-y-6">
      <div>
        <Link to="/dashboard/marketing" className={`text-xs font-semibold hover:underline ${muted}`}>
          ← Marketing
        </Link>
        <h1 className="mt-2 text-2xl font-display font-semibold">Holiday post</h1>
        <p className={`mt-1 text-sm ${muted}`}>A greeting on your brand colors. Pick a holiday, a color and a layout, change the words, then download it.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,420px)_1fr] items-start">
        <div className="lg:sticky lg:top-6 space-y-3">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Holiday post preview"
            className="w-full rounded-xl border border-black/10 dark:border-white/15"
            style={{ aspectRatio: `${w} / ${h}`, maxHeight: "78vh", width: format === "story" ? "auto" : "100%", maxWidth: "100%" }}
          />
          <button type="button" onClick={download} className="w-full rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-5 py-3 hover:opacity-90 transition-opacity">
            Download PNG ({w} × {h})
          </button>
          {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="space-y-5">
          <section className={card}>
            <div>
              <label className={labelClass}>Holiday</label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Holiday">
                {holidays.map((hd) => (
                  <button
                    key={hd.id}
                    type="button"
                    aria-pressed={!custom && holidayId === hd.id}
                    onClick={() => pick(hd.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      !custom && holidayId === hd.id
                        ? "border-[#1c1a17] dark:border-[#faf9f7] bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17] font-semibold"
                        : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"
                    }`}
                  >
                    {hd.name}
                    <span className="ml-1.5 text-[11px] opacity-60">{dayLabel(hd.date)}</span>
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={custom}
                  onClick={() => setCustom(true)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${custom ? "border-[#1c1a17] dark:border-[#faf9f7] bg-[#1c1a17] dark:bg-[#faf9f7] text-white dark:text-[#1c1a17] font-semibold" : "border-black/15 dark:border-white/20 hover:bg-black/5 dark:hover:bg-white/10"}`}
                >
                  My own greeting
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Size</label>
              <Segments label="Size" value={format} onChange={setFormat} options={Object.entries(FORMATS).map(([k, f]) => [k, f.label, f.note])} />
            </div>
          </section>

          <section className={card}>
            <h2 className="font-display text-base font-semibold">Words</h2>
            <div>
              <label className={labelClass} htmlFor="hp-greeting">Greeting</label>
              <input id="hp-greeting" value={text.greeting} onChange={edit("greeting")} maxLength={60} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="hp-message">Line under it</label>
              <textarea id="hp-message" value={text.message} onChange={edit("message")} rows={2} maxLength={160} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="hp-sign">Your line</label>
              <input
                id="hp-sign"
                value={text.signoff}
                onChange={(e) => {
                  signTouched.current = true;
                  edit("signoff")(e);
                }}
                className={inputClass}
              />
              <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={text.showSign} onChange={flag("showSign")} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                Show it
              </label>
            </div>
          </section>

          <section className={card}>
            <div>
              <label className={labelClass}>Layout</label>
              <Segments label="Layout" value={layout} onChange={setLayout} options={Object.entries(LAYOUTS).map(([k, l]) => [k, l.label])} />
              <p className={`mt-1.5 text-xs ${muted}`}>{LAYOUTS[layout].note}</p>
              {layout === "portrait" && (
                <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
                  <input type="checkbox" checked={text.showPhoto} onChange={flag("showPhoto")} className="accent-[#ed2127] dark:accent-[#f2454b]" />
                  Show my photo {profile?.photo_url ? "" : "(add one in My Profile first)"}
                </label>
              )}
            </div>
            <div>
              <label className={labelClass}>Color</label>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Color">
                {palette.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setBg(c.hex)}
                    aria-pressed={bg === c.hex}
                    aria-label={c.name}
                    title={c.name}
                    className={`h-10 w-10 rounded-full border-2 ${bg === c.hex ? "border-[#1c1a17] dark:border-[#faf9f7] ring-2 ring-offset-2 ring-[#1c1a17]/30 dark:ring-[#faf9f7]/40 ring-offset-white dark:ring-offset-[#1a1a1a]" : "border-black/15 dark:border-white/20"}`}
                    style={{ background: c.hex }}
                  >
                    {isLight(c.hex) ? null : null}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
