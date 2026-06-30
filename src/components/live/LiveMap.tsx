"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

interface Props {
  members: {
    id: string;
    first_name: string;
    avatar_url: string | null;
    live_lat: number | null;
    live_lng: number | null;
    live_location_at: string | null;
    relation_type: string;
  }[];
  myPos: { lat: number; lng: number } | null;
  myName: string;
  myAvatar: string | null;
}

function makeIcon(name: string, avatarUrl: string | null, isMe = false) {
  const size = isMe ? 44 : 38;
  const border = isMe ? "3px solid #4ade80" : "2px solid #374151";
  const html = avatarUrl
    ? `<img src="${avatarUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.5)" />`
    : `<div style="width:${size}px;height:${size}px;border-radius:50%;background:#1f2937;border:${border};display:flex;align-items:center;justify-content:center;font-size:${size * 0.4}px;font-weight:700;color:white;box-shadow:0 2px 8px rgba(0,0,0,0.5)">${name[0]}</div>`;

  return L.divIcon({
    html: `<div style="position:relative">${html}<div style="position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);background:${isMe ? "#4ade80" : "#6b7280"};color:white;font-size:9px;font-weight:600;padding:1px 5px;border-radius:4px;white-space:nowrap;max-width:70px;overflow:hidden;text-overflow:ellipsis">${name}</div></div>`,
    className: "",
    iconSize: [size, size + 18],
    iconAnchor: [size / 2, size / 2],
  });
}

export default function LiveMap({ members, myPos, myName, myAvatar }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const allPoints: L.LatLng[] = [];

    // My position
    const myKey = "__me__";
    if (myPos) {
      const latlng = L.latLng(myPos.lat, myPos.lng);
      allPoints.push(latlng);
      if (markersRef.current.has(myKey)) {
        markersRef.current.get(myKey)!.setLatLng(latlng);
      } else {
        const m = L.marker(latlng, { icon: makeIcon(myName, myAvatar, true) }).addTo(map);
        markersRef.current.set(myKey, m);
      }
    }

    // Family members
    for (const member of members) {
      if (!member.live_lat || !member.live_lng) continue;
      const latlng = L.latLng(member.live_lat, member.live_lng);
      allPoints.push(latlng);

      if (markersRef.current.has(member.id)) {
        markersRef.current.get(member.id)!.setLatLng(latlng);
      } else {
        const marker = L.marker(latlng, {
          icon: makeIcon(member.first_name, member.avatar_url),
        }).addTo(map);
        markersRef.current.set(member.id, marker);
      }
    }

    // Remove stale markers
    for (const [key, marker] of markersRef.current.entries()) {
      if (key === myKey && myPos) continue;
      if (members.some(m => m.id === key && m.live_lat)) continue;
      if (key !== myKey) { marker.remove(); markersRef.current.delete(key); }
    }

    if (allPoints.length > 0) {
      if (allPoints.length === 1) {
        map.setView(allPoints[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(allPoints), { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [members, myPos, myName, myAvatar]);

  return (
    <div ref={containerRef} style={{
      width: "100%",
      height: "100%",
      borderRadius: "50%",
      overflow: "hidden",
      maskImage: "radial-gradient(circle, black 49%, transparent 50%)",
      WebkitMaskImage: "radial-gradient(circle, black 49%, transparent 50%)",
    }} />
  );
}
