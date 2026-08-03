"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Person { name: string; birth_year: string | null; }
interface Pin { lat: number; lng: number; city: string; country: string; people: Person[]; }

// ── Gold galaxy pin icon ──────────────────────────────────────────────────────
function makePin(count: number): L.DivIcon {
  const size = count > 1 ? 44 : 36;
  const badge = count > 1
    ? `<div style="position:absolute;top:-4px;right:-4px;width:18px;height:18px;border-radius:50%;
        background:#d4af37;border:2px solid #030208;display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:900;color:#030208;z-index:2;">${count}</div>`
    : "";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;">
        ${badge}
        <div style="
          width:${size}px;height:${size}px;border-radius:50% 50% 50% 4px;
          background:radial-gradient(circle at 35% 30%,#f5e060 0%,#c9a820 45%,#7a5c00 100%);
          border:2px solid rgba(255,240,100,0.8);
          box-shadow:0 4px 16px rgba(212,175,55,0.6),0 0 0 3px rgba(212,175,55,0.15),inset 0 1px 0 rgba(255,255,255,0.3);
          display:flex;align-items:center;justify-content:center;
          transform:rotate(-45deg);
        ">
          <div style="transform:rotate(45deg);color:#030208;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
          </div>
        </div>
      </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -(size + 4)],
  });
}

// ── Markers layer (uses map context) ─────────────────────────────────────────
function Markers({ pins, onSelect }: { pins: Pin[]; onSelect: (p: Pin) => void }) {
  const map = useMap();

  useEffect(() => {
    const markers: L.Marker[] = [];
    for (const pin of pins) {
      const m = L.marker([pin.lat, pin.lng], { icon: makePin(pin.people.length) })
        .on("click", () => onSelect(pin));
      m.addTo(map);
      markers.push(m);
    }

    // Fit bounds if we have pins
    if (pins.length > 0) {
      const bounds = L.latLngBounds(pins.map(p => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [48, 48], maxZoom: 8 });
    }

    return () => { markers.forEach(m => m.remove()); };
  }, [map, pins, onSelect]);

  return null;
}

// ── Dark tile styling override ────────────────────────────────────────────────
const DARK_CSS = `
  .leaflet-tile-pane { filter: invert(1) hue-rotate(190deg) saturate(0.6) brightness(0.85); }
  .leaflet-container { background: #030208 !important; }
  .leaflet-control-attribution { background: rgba(3,2,8,0.7) !important; color: rgba(212,175,55,0.35) !important; font-size: 9px !important; }
  .leaflet-control-attribution a { color: rgba(212,175,55,0.5) !important; }
  .leaflet-control-zoom a { background: #0c0a18 !important; color: #d4af37 !important; border-color: rgba(212,175,55,0.2) !important; }
  .leaflet-control-zoom a:hover { background: #18102a !important; }
`;

// ── Main exported component ───────────────────────────────────────────────────
export default function FamilyMapInner({ pins, onSelect }: { pins: Pin[]; onSelect: (p: Pin) => void }) {
  // World center, zoom 2 as initial fallback; fitBounds corrects it once markers load
  const center: [number, number] = [20, 10];

  return (
    <>
      <style>{DARK_CSS}</style>
      <MapContainer
        center={center}
        zoom={2}
        style={{ height: "100%", width: "100%", background: "#030208" }}
        zoomControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
        />
        <Markers pins={pins} onSelect={onSelect} />
      </MapContainer>
    </>
  );
}
