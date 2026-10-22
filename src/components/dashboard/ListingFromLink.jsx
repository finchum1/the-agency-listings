import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { useAuth } from "../../hooks/useAuth";
import { formatPrice } from "../../lib/format";

const inputClass =
  "w-full rounded-lg border border-black/10 dark:border-white/15 bg-transparent px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#ed2127]/40 dark:focus:ring-[#f2454b]/40";
const FIELD_NAMES = { price: "price", beds: "beds", baths: "baths", sqft: "square feet", description: "description", photos: "photos", address_line1: "street address", city: "city", state: "state", zip: "zip" };

async function call(body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const res = await fetch("/api/listing-from-link", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "That didn't work. Try again.");
  return json;
}

// Start a listing from a Zillow, Redfin or Realtor.com link, an MLS number or an address. It finds what it can (the
// address from the link, and price, rooms, description and photos from the office's MLS feed when the home is in it),
// shows what it found, and makes a DRAFT listing you can finish on the next screen.
export default function ListingFromLink() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [found, setFound] = useState(null);
  const [agents, setAgents] = useState([]);
  const [agentId, setAgentId] = useState("");
  const [mine, setMine] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name")
      .then(({ data }) => setAgents(data || []));
  }, [isAdmin]);
  useEffect(() => setAgentId((a) => a || user?.id || ""), [user?.id]);

  const request = () => {
    const v = value.trim();
    if (/^https?:\/\//i.test(v)) return { source_url: v };
    if (/^[A-Za-z]{0,4}\d{5,}$/.test(v.replace(/\s/g, ""))) return { mls_number: v.replace(/\s/g, "") };
    return null;
  };

  const lookUp = async (e) => {
    e.preventDefault();
    const body = request();
    if (!body) {
      setError("Paste a Zillow, Redfin or Realtor.com link, or an MLS number.");
      return;
    }
    setBusy(true);
    setError("");
    setFound(null);
    setMine(false);
    try {
      setFound({ ...(await call(body)), request: body });
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  const create = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await call({ ...found.request, create: true, agent_id: agentId, confirm_own_listing: mine || undefined });
      navigate(`/dashboard/listings/${r.listing.id}/edit`, { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const d = found?.draft;
  const address = d ? [d.address_line1, d.city, [d.state, d.zip].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "";
  const canCreate = d?.address_line1 && d?.city && d?.state && d?.zip;
  const notMine = found?.matched && found.own_listing === false;

  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-black/5 dark:border-white/10 rounded-2xl p-6 mb-6">
      <h2 className="font-display text-lg font-semibold">Start from a link</h2>
      <p className="text-sm text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mt-1">
        Paste a Zillow, Redfin or Realtor.com link, or an MLS number. We'll fill in what we can and make a draft you can finish. Or skip this and fill in the form below.
      </p>
      <form onSubmit={lookUp} className="mt-4 flex flex-wrap gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="https://www.zillow.com/homedetails/…  or  MLS number" aria-label="Listing link or MLS number" className={`${inputClass} flex-1 min-w-[16rem]`} />
        <button type="submit" disabled={!value.trim() || busy} className="rounded-full bg-[#1c1a17] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
          {busy && !found ? "Looking…" : "Look it up"}
        </button>
      </form>
      {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {found && (
        <div className="mt-5 rounded-xl border border-black/10 dark:border-white/15 p-4 space-y-3">
          {d?.address_line1 ? (
            <p className="font-semibold">{address}</p>
          ) : (
            <p className="font-semibold">Nothing found for that.</p>
          )}
          {found.matched ? (
            <p className="text-sm">
              Found in the MLS{found.listing_office ? ` (listed by ${found.listing_office})` : ""}: {[d.price ? formatPrice(d.price) : null, d.beds != null ? `${d.beds} bd` : null, d.baths != null ? `${d.baths} ba` : null, d.sqft ? `${Number(d.sqft).toLocaleString()} sqft` : null].filter(Boolean).join(" · ")}
              {found.photos?.length ? ` · ${found.photos.length} photos` : ""}
            </p>
          ) : (
            <p className="text-sm text-[#1c1a17]/70 dark:text-[#faf9f7]/70">Only the address from the link could be read. You'll add the rest on the next screen.</p>
          )}
          {found.photos?.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto">
              {found.photos.slice(0, 8).map((p) => (
                <img key={p} src={p} alt="" className="h-16 w-24 object-cover rounded-md shrink-0" loading="lazy" />
              ))}
            </div>
          )}
          {found.missing?.length > 0 && (
            <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">Still to fill in: {found.missing.map((m) => FIELD_NAMES[m] || m).join(", ")}</p>
          )}
          {found.notes?.length > 0 && <p className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">{found.notes.filter((n) => !/Fill the missing/.test(n)).join(" ")}</p>}

          {notMine && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ed2127]" />
              <span>The MLS shows another office listed this home. I confirm it's my listing.</span>
            </label>
          )}
          {isAdmin && agents.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-[#1c1a17]/60 dark:text-[#faf9f7]/60 mb-1.5">Listing agent</label>
              <select value={agentId} onChange={(e) => setAgentId(e.target.value)} className={inputClass}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={create} disabled={busy || !canCreate || (notMine && !mine)} className="rounded-full bg-[#ed2127] dark:bg-[#f2454b] text-white text-sm font-semibold px-6 py-2.5 disabled:opacity-50">
              {busy ? "Creating…" : "Create draft listing"}
            </button>
            {!canCreate && <span className="text-xs text-[#1c1a17]/55 dark:text-[#faf9f7]/55">Needs a street address, city, state and zip. Fill in the form below instead.</span>}
          </div>
          {found.matched && found.photos?.length > 0 && <p className="text-xs text-[#1c1a17]/50 dark:text-[#faf9f7]/50">The first 25 photos are copied into your listing. It's saved as a draft; it isn't public until you publish it.</p>}
        </div>
      )}
    </div>
  );
}
