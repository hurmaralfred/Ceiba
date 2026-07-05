"use client";
import { MapContainer, TileLayer, Marker, Popup, Circle } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { FamilyTreeNode } from "@/lib/types";

// Fix Leaflet default icons in Next.js
const myIcon = L.divIcon({
  className: "",
  html: `<div style="width:32px;height:32px;background:#4a6342;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -36],
});

const relativeIcon = (initials: string) => L.divIcon({
  className: "",
  html: `<div style="width:36px;height:36px;background:#3d5235;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:12px;">${initials}</div>`,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -40],
});

interface Props {
  myLocation: [number, number] | null;
  relatives: FamilyTreeNode[];
}

export default function MapView({ myLocation, relatives }: Props) {
  const center: [number, number] = myLocation ||
    (relatives[0] ? [relatives[0].latitude!, relatives[0].longitude!] : [20, 0]);

  return (
    <MapContainer center={center} zoom={myLocation ? 10 : 2} style={{ height: "100%", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      />

      {/* My location */}
      {myLocation && (
        <>
          <Circle center={myLocation} radius={2000} color="#5c7a52" fillOpacity={0.1} weight={1} />
          <Marker position={myLocation} icon={myIcon}>
            <Popup>
              <strong>Tú estás aquí</strong>
            </Popup>
          </Marker>
        </>
      )}

      {/* Relatives */}
      {relatives.map(r => {
        if (!r.latitude || !r.longitude) return null;
        const initials = `${r.first_name[0]}${r.last_name ? r.last_name[0] : ""}`;
        return (
          <Marker
            key={r.profile_id}
            position={[r.latitude, r.longitude]}
            icon={relativeIcon(initials)}
          >
            <Popup>
              <div className="text-sm">
                <div className="font-bold">{r.first_name} {r.last_name}</div>
                {r.city && <div className="text-gray-500">{r.city}</div>}
                <div className="text-ceiba-700 text-xs mt-1">{r.depth} grado(s) de separación</div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
