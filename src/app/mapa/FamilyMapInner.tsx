"use client";
import { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Person { name: string; birth_year: string | null; }
interface Pin { lat: number; lng: number; city: string; country: string; people: Person[]; }

// ── Luminous orb pin — same planet visual language as the tree universe ───────
function makePin(count: number): L.DivIcon {
  // Scale orb by population density
  const sz = count >= 20 ? 52 : count >= 10 ? 46 : count >= 5 ? 40 : count >= 2 ? 34 : 28;
  const badge = count > 1
    ? `<div style="position:absolute;top:-7px;right:-7px;min-width:18px;height:18px;border-radius:9px;
        background:#d4af37;border:2px solid #030208;display:flex;align-items:center;justify-content:center;
        font-size:9px;font-weight:900;color:#030208;padding:0 4px;z-index:3;
        box-shadow:0 0 8px rgba(212,175,55,0.7);">${count}</div>`
    : "";
  return L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${sz}px;height:${sz}px;">
        ${badge}
        <!-- Ambient pulse glow -->
        <div style="position:absolute;inset:-${Math.round(sz * 0.35)}px;border-radius:50%;
          background:radial-gradient(circle,rgba(242,180,60,0.30) 0%,transparent 62%);
          filter:blur(${Math.round(sz * 0.18)}px);
          animation:pin-orb-pulse 3.2s ease-in-out infinite;pointer-events:none;"></div>
        <!-- Orb core -->
        <div style="width:${sz}px;height:${sz}px;border-radius:50%;position:relative;overflow:hidden;
          background:radial-gradient(circle at 33% 27%,#f5e060 0%,#c9a820 46%,#7a5c00 100%);
          border:1.5px solid rgba(255,240,100,0.60);
          box-shadow:0 0 ${Math.round(sz*0.55)}px rgba(212,175,55,0.72),
                     0 4px 14px rgba(0,0,0,0.70),
                     inset 0 1px 0 rgba(255,255,255,0.25);">
          <!-- Specular highlight -->
          <div style="position:absolute;top:${Math.round(sz*0.11)}px;left:${Math.round(sz*0.16)}px;
            width:${Math.round(sz*0.32)}px;height:${Math.round(sz*0.22)}px;border-radius:50%;
            background:rgba(255,255,255,0.52);filter:blur(1.5px);"></div>
        </div>
      </div>`,
    iconSize: [sz, sz],
    iconAnchor: [sz / 2, sz / 2],
    popupAnchor: [0, -(sz / 2 + 14)],
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
  @keyframes pin-orb-pulse { 0%,100%{opacity:0.55;transform:scale(1)} 50%{opacity:1;transform:scale(1.12)} }
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
