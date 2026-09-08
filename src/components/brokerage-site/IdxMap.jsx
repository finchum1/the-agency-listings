import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet-draw/dist/leaflet.draw.css";
import { formatPrice, formatCompactPrice } from "../../lib/format";

const DEFAULT_CENTER = [35.4676, -97.5164]; // Oklahoma City — used only when no listing has coordinates
const DEFAULT_ZOOM = 11;

// One popup's contents for a marker/cluster-leaf click — a mini version
// of the listing card (see IdxListings.jsx's grid card), rendered into
// Leaflet's own popup DOM node via a React root, since Leaflet popups
// aren't React components themselves.
function ListingPopup({ listing }) {
  return (
    <a href={`/brokerage/listings/${listing.mlsNumber}`} className="block w-48 no-underline">
      {listing.hero_photo_url && (
        <img
          src={listing.hero_photo_url}
          alt=""
          className="mb-2 h-28 w-full rounded object-cover"
        />
      )}
      <p className="font-display text-base font-semibold text-[#1a1a1a]">{formatPrice(listing.price)}</p>
      <p className="text-xs text-[#1a1a1a]/70">
        {listing.address_line1}, {listing.city}
      </p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-[#a84e2b]">View Details →</p>
    </a>
  );
}

// Imperative layer: react-leaflet has no first-class clustering
// component, so this manages a leaflet.markercluster group directly via
// useMap(), rebuilding its markers whenever `listings` changes. Each
// marker is a price-bubble divIcon (not a pin) — matches the reference
// screenshot and sidesteps Leaflet's classic bundler-breaks-the-default-
// pin-icon problem entirely, since no default icon image is used.
function ClusterLayer({ listings }) {
  const map = useMap();
  const groupRef = useRef(null);

  const fitToMarkers = () => {
    const group = groupRef.current;
    if (group && group.getLayers().length > 0) {
      map.fitBounds(group.getBounds(), { padding: [40, 40], maxZoom: 14 });
    }
  };

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 50,
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        return L.divIcon({
          html: `<div class="idx-cluster-bubble">${count}</div>`,
          className: "",
          iconSize: [40, 40],
        });
      },
    });
    groupRef.current = group;
    map.addLayer(group);
    return () => {
      map.removeLayer(group);
      groupRef.current = null;
    };
  }, [map]);

  // The map pane is `display:none` on narrow screens until the List/Map
  // toggle switches to Map (see IdxListings.jsx) — Leaflet can't size or
  // fit bounds correctly against a 0×0 container, and doesn't recover on
  // its own once the container becomes visible. A ResizeObserver on the
  // container catches exactly that transition (0 -> real size, or any
  // later resize) and re-syncs Leaflet's internal size cache + refits to
  // the current markers, whatever caused the resize.
  useEffect(() => {
    const container = map.getContainer();
    let lastSize = 0;
    const ro = new ResizeObserver(([entry]) => {
      const size = entry.contentRect.width * entry.contentRect.height;
      if (size === 0) return;
      map.invalidateSize();
      if (lastSize === 0) fitToMarkers(); // became visible — refit once
      lastSize = size;
    });
    ro.observe(container);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();

    const located = listings.filter((l) => l.lat && l.lng);
    for (const listing of located) {
      const marker = L.marker([listing.lat, listing.lng], {
        icon: L.divIcon({
          html: `<div class="idx-price-bubble">${formatCompactPrice(listing.price)}</div>`,
          className: "",
          iconSize: [0, 0], // divIcon content sizes itself; see index.css
        }),
      });
      const popupNode = document.createElement("div");
      marker.bindPopup(popupNode, { minWidth: 200 });
      marker.on("popupopen", () => createRoot(popupNode).render(<ListingPopup listing={listing} />));
      group.addLayer(marker);
    }

    fitToMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listings, map]);

  return null;
}

// Draw-a-boundary search — matches the reference screenshot's "Draw"
// button. Uses leaflet-draw's polygon handler directly (triggered from
// our own button, not its default toolbar UI, which doesn't match this
// site's look). On completion, converts the drawn ring to the
// [lng, lat] coordinate format Repliers' `map` polygon filter expects
// (see api/repliers.js) and hands it up via onBoundaryChange.
function DrawControl({ onBoundaryChange, boundaryActive }) {
  const map = useMap();
  const [drawing, setDrawing] = useState(false);
  const drawnItemsRef = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => {
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);
    drawnItemsRef.current = drawnItems;
    handlerRef.current = new L.Draw.Polygon(map, {
      shapeOptions: { color: "#a84e2b", weight: 3, fillOpacity: 0.08 },
      showArea: false,
    });

    const onCreated = (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);
      setDrawing(false);

      const ring = e.layer.getLatLngs()[0].map(({ lat, lng }) => [lng, lat]);
      ring.push(ring[0]); // GeoJSON rings must close (first point === last point)
      onBoundaryChange([[ring]]);
    };
    const onStop = () => setDrawing(false);
    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.DRAWSTOP, onStop);
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.DRAWSTOP, onStop);
      map.removeLayer(drawnItems);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Clear the drawn shape from the map whenever the boundary filter is
  // cleared some other way (e.g. IdxListings.jsx's own "Clear boundary"
  // affordance, if the filter bar ever grows one) — keeps the drawn
  // outline and the active filter from disagreeing.
  useEffect(() => {
    if (!boundaryActive) drawnItemsRef.current?.clearLayers();
  }, [boundaryActive]);

  const toggleDrawing = () => {
    if (drawing) {
      handlerRef.current?.disable();
      setDrawing(false);
    } else {
      handlerRef.current?.enable();
      setDrawing(true);
    }
  };

  const clearBoundary = () => {
    drawnItemsRef.current?.clearLayers();
    onBoundaryChange(null);
  };

  return (
    <div className="absolute top-3 left-3 z-[1000] flex gap-2">
      <button
        type="button"
        onClick={toggleDrawing}
        className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracked shadow ${
          drawing ? "bg-[var(--as-accent)] text-white" : "bg-white text-[#1a1a1a] hover:bg-white/90"
        }`}
      >
        {drawing ? "Click map to draw…" : "Draw"}
      </button>
      {boundaryActive && (
        <button
          type="button"
          onClick={clearBoundary}
          className="rounded-full bg-white px-4 py-2 text-xs font-semibold uppercase tracked text-[#1a1a1a] shadow hover:bg-white/90"
        >
          Clear boundary
        </button>
      )}
    </div>
  );
}

export default function IdxMap({ listings, onBoundaryChange, boundaryActive }) {
  const hasLocated = listings.some((l) => l.lat && l.lng);

  return (
    <div className="relative h-full w-full">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} className="h-full w-full" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {hasLocated && <ClusterLayer listings={listings} />}
        <DrawControl onBoundaryChange={onBoundaryChange} boundaryActive={boundaryActive} />
      </MapContainer>
    </div>
  );
}
