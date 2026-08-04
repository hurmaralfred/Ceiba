"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, FamilyMember } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";

// ── Orbit cold-start seed ────────────────────────────────────────────────────
const ORBIT_1 = new Set([
  "father","mother","spouse","partner","son","daughter",
  "stepson","stepdaughter","step_son","step_daughter",
]);
const ORBIT_2 = new Set([
  "brother","sister","half_brother","half_sister","step_brother","step_sister",
  "grandfather","grandmother",
  "grandfather_paternal","grandmother_paternal",
  "grandfather_maternal","grandmother_maternal",
  "uncle","aunt","nephew","niece",
  "grandson","granddaughter","great_grandson","great_granddaughter",
]);
function seedOrbit(rel: string, kind?: string | null): 1 | 2 | 3 {
  if (ORBIT_1.has(rel)) return 1;
  if (ORBIT_2.has(rel)) return 2;
  if (kind === "affinity") return 3;
  return 2;
}

// ── Types ────────────────────────────────────────────────────────────────────
interface OrbitNode {
  id: string;
  name: string;
  firstName: string;
  orbit: 1 | 2 | 3;
  angle: number;
  baseSpeed: number;
  speed: number;        // 0 when selected/paused
  deceased: boolean;
  joined: boolean;
  relationType: string;
  avatarUrl: string | null;
}

export interface GalaxyOrbitViewProps {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers: ExtendedEntry[];
  memberLinks: MemberLink[];
  onEditMember: (id: string) => void;
  onInviteMember: (id: string) => void;
  onAddMember: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────
const GOLD   = "#d4af37";
const BG     = "#030208";
const TILT   = 0.68;
const SPEEDS = [0.009, 0.006, 0.003] as const;
const SIGNS  = [1, -1, 1] as const;

function orbitR(orbit: 1 | 2 | 3, w: number): number {
  return [0.19, 0.34, 0.47][orbit - 1] * w;
}
function nodeR(orbit: 1 | 2 | 3): number {
  return [17, 14, 11][orbit - 1];
}

// ── Image cache ───────────────────────────────────────────────────────────────
const imgCache = new Map<string, HTMLImageElement | null>();
function loadImg(url: string): HTMLImageElement | null {
  if (imgCache.has(url)) return imgCache.get(url)!;
  imgCache.set(url, null);
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload  = () => imgCache.set(url, img);
  img.onerror = () => imgCache.set(url, null);
  img.src = url;
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function GalaxyOrbitView({
  profile, members, extendedMembers,
  onEditMember, onInviteMember, onAddMember,
}: GalaxyOrbitViewProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const animRef     = useRef<number>(0);
  const nodesRef    = useRef<OrbitNode[]>([]);
  const tRef        = useRef(0);
  const mouseRef    = useRef({ x: -9999, y: -9999 });
  const selectedRef = useRef<string | null>(null);

  const [selectedNode, setSelectedNode] = useState<OrbitNode | null>(null);
  const [overrides, setOverrides] = useState<Record<string, 1 | 2 | 3>>({});

  // Pre-load profile photo
  useEffect(() => {
    if (profile.avatar_url) loadImg(profile.avatar_url);
  }, [profile.avatar_url]);

  // ── Build nodes ──────────────────────────────────────────────────────────
  useEffect(() => {
    const seen = new Set<string>();
    const raw: OrbitNode[] = [];

    members.forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const orbit: 1 | 2 | 3 = overrides[m.id] ?? seedOrbit(m.relation_type, m.relation_kind);
      const spd = SPEEDS[orbit - 1] * SIGNS[orbit - 1];
      const avatarUrl = m.profile?.avatar_url ?? null;
      if (avatarUrl) loadImg(avatarUrl);
      raw.push({
        id: m.id,
        name: `${m.first_name}${m.last_name ? " " + m.last_name : ""}`,
        firstName: m.first_name,
        orbit, angle: 0,
        baseSpeed: spd, speed: spd,
        deceased: !!m.is_deceased,
        joined: !!m.profile_id,
        relationType: m.relation_type,
        avatarUrl,
      });
    });

    extendedMembers.forEach(e => {
      if (seen.has(e.member.id)) return;
      seen.add(e.member.id);
      const orbit: 1 | 2 | 3 = overrides[e.member.id] ??
        seedOrbit(e.inferredRelation || "other", e.member.relation_kind);
      const spd = SPEEDS[orbit - 1] * SIGNS[orbit - 1];
      const avatarUrl = (e.member as any).profile?.avatar_url ?? null;
      if (avatarUrl) loadImg(avatarUrl);
      raw.push({
        id: e.member.id,
        name: `${e.member.first_name}${e.member.last_name ? " " + e.member.last_name : ""}`,
        firstName: e.member.first_name,
        orbit, angle: 0,
        baseSpeed: spd, speed: spd,
        deceased: !!(e.member as any).is_deceased,
        joined: !!e.member.profile_id,
        relationType: e.inferredRelation || "other",
        avatarUrl,
      });
    });

    // Spread evenly within each orbit
    const groups: Record<number, OrbitNode[]> = { 1: [], 2: [], 3: [] };
    raw.forEach(n => groups[n.orbit].push(n));
    [1, 2, 3].forEach(o => {
      const g = groups[o];
      if (!g.length) return;
      const step = (Math.PI * 2) / g.length;
      g.forEach((n, i) => { n.angle = -Math.PI / 2 + step * i; });
    });

    // Preserve paused state for the currently-selected node
    if (selectedRef.current) {
      const prev = nodesRef.current.find(n => n.id === selectedRef.current);
      if (prev) {
        const next = raw.find(n => n.id === prev.id);
        if (next) { next.speed = 0; next.angle = prev.angle; }
      }
    }

    nodesRef.current = raw;
  }, [members, extendedMembers, overrides]);

  // ── Animation loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.offsetWidth  * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      const cx = w / 2, cy = h / 2;
      const t = ++tRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // ─ Nebulae (rich, visible)
      const nebulae = [
        { x: .18, y: .26, r: .52, c0: "rgba(90,12,210,0.20)",  c1: "rgba(60,5,140,0.06)"  },
        { x: .82, y: .72, r: .44, c0: "rgba(10,52,185,0.17)",  c1: "rgba(5,30,120,0.05)"  },
        { x: .54, y: .44, r: .30, c0: "rgba(200,100,8,0.13)",  c1: "rgba(140,60,0,0.04)"  },
        { x: .28, y: .78, r: .32, c0: "rgba(180,10,80,0.09)",  c1: "rgba(120,5,50,0.02)"  },
        { x: .72, y: .24, r: .26, c0: "rgba(5,165,120,0.08)",  c1: "transparent"           },
      ] as const;
      nebulae.forEach(n => {
        const g = ctx.createRadialGradient(w * n.x, h * n.y, 0, w * n.x, h * n.y, w * n.r);
        g.addColorStop(0, n.c0); g.addColorStop(1, n.c1);
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });

      // ─ Stars (two sizes, deterministic, some twinkling)
      for (let i = 0; i < 120; i++) {
        const sx = ((i * 137.508) % 100) / 100 * w;
        const sy = ((i * 97.318)  % 100) / 100 * h;
        const big = i % 11 === 0;
        const sr = big ? 1.3 : 0.5 + (i % 5) * 0.13;
        const baseAlpha = big ? 0.55 : 0.10 + (i % 9) * 0.045;
        const twinkle = big ? (Math.sin(t * 0.03 + i) * 0.25 + 0.75) : 1;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${(baseAlpha * twinkle).toFixed(2)})`; ctx.fill();
      }

      // ─ Shooting star (rare, deterministic)
      const shotPhase = Math.floor(t / 300) % 5;
      const shotT = t % 300;
      if (shotT < 45) {
        const starts = [[.15,.10],[.72,.20],[.33,.60],[.88,.40],[.45,.05]];
        const [bx, by] = starts[shotPhase];
        const prog = shotT / 45;
        const len = 90, ang = Math.PI / 4;
        const ex = bx * w + prog * len * Math.cos(ang);
        const ey = by * h + prog * len * Math.sin(ang);
        const alpha = Math.sin(prog * Math.PI) * 0.75;
        const sg = ctx.createLinearGradient(ex - 30, ey - 30, ex + 5, ey + 5);
        sg.addColorStop(0, "rgba(255,255,255,0)");
        sg.addColorStop(1, `rgba(255,255,255,${alpha.toFixed(2)})`);
        ctx.save(); ctx.strokeStyle = sg; ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(ex - len * .45 * Math.cos(ang), ey - len * .45 * Math.sin(ang));
        ctx.lineTo(ex, ey); ctx.stroke(); ctx.restore();
      }

      // ─ Orbit rings
      ([1, 2, 3] as const).forEach(orbit => {
        const r = orbitR(orbit, w);
        const alpha = [0.22, 0.13, 0.08][orbit - 1];
        ctx.save();
        ctx.strokeStyle = `rgba(212,175,55,${alpha})`;
        ctx.lineWidth = 1; ctx.setLineDash([3, 10]);
        ctx.beginPath(); ctx.ellipse(cx, cy, r, r * TILT, 0, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(212,175,55,${alpha * 1.2})`;
        ctx.font = "7px -apple-system,sans-serif"; ctx.textAlign = "center";
        ctx.fillText(["DIRECTA", "EXTENDIDA", "AFINIDAD"][orbit - 1], cx, cy - r * TILT - 6);
        ctx.restore();
      });

      // ─ Nodes back-to-front (3 → 2 → 1)
      ([3, 2, 1] as const).forEach(orbit => {
        nodesRef.current.filter(n => n.orbit === orbit).forEach(n => {
          n.angle += n.speed;
          const r  = orbitR(n.orbit, w);
          const nx = cx + r * Math.cos(n.angle);
          const ny = cy + r * TILT * Math.sin(n.angle);
          const nr = nodeR(n.orbit);
          const hov = Math.hypot(mouseRef.current.x - nx, mouseRef.current.y - ny) < nr + 18;
          const sel = selectedRef.current === n.id;

          if (n.deceased) {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.setLineDash([3, 4]);
            ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(212,175,55,0.07)";
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.22)";
            ctx.font = `bold ${Math.round(nr * .68)}px -apple-system,sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
            // Name below
            ctx.globalAlpha = 0.18;
            ctx.font = "8px -apple-system,sans-serif"; ctx.textBaseline = "top";
            ctx.fillText(n.firstName, nx, ny + nr + 4);
            ctx.restore();
          } else {
            // Glow
            ctx.save();
            ctx.globalAlpha = hov || sel ? 0.70 : 0.30;
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * 3.5);
            g.addColorStop(0, n.joined ? "rgba(212,175,55,0.58)" : "rgba(140,110,240,0.48)");
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(nx, ny, nr * 3.5, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // Pulse ring when selected
            if (sel) {
              const pf = (Math.sin(t * 0.12) + 1) / 2;
              ctx.save(); ctx.globalAlpha = 0.55 + pf * 0.25;
              ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
              ctx.beginPath(); ctx.arc(nx, ny, nr + 7 + pf * 4, 0, Math.PI * 2); ctx.stroke();
              ctx.restore();
            }

            // Circle (clip for photo)
            ctx.save();
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = "rgba(8,5,18,0.92)";
            ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
            const img = n.avatarUrl ? loadImg(n.avatarUrl) : null;
            if (img) {
              ctx.globalAlpha = hov || sel ? 1.0 : 0.90;
              ctx.drawImage(img, nx - nr, ny - nr, nr * 2, nr * 2);
            } else {
              const fill = ctx.createRadialGradient(nx - nr * .3, ny - nr * .3, 0, nx, ny, nr);
              fill.addColorStop(0, n.joined ? "rgba(212,175,55,0.30)" : "rgba(120,100,220,0.22)");
              fill.addColorStop(1, "rgba(8,5,18,0.96)");
              ctx.fillStyle = fill; ctx.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
              ctx.fillStyle = n.joined ? GOLD : "rgba(184,160,216,0.88)";
              ctx.font = `bold ${Math.round(nr * .68)}px -apple-system,sans-serif`;
              ctx.textAlign = "center"; ctx.textBaseline = "middle";
              ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
            }
            ctx.restore();

            // Border ring
            ctx.save();
            ctx.strokeStyle = n.joined
              ? (hov || sel ? "#f5dd80" : GOLD)
              : (hov || sel ? "rgba(200,180,255,0.95)" : "rgba(184,160,216,0.55)");
            ctx.lineWidth = hov || sel ? 2.5 : 1.8;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // First name — always visible with legibility shadow
            ctx.save();
            ctx.shadowColor = "rgba(3,2,8,0.98)"; ctx.shadowBlur = 8;
            ctx.font = `${hov || sel ? "600" : "400"} ${hov || sel ? 11 : 9}px -apple-system,sans-serif`;
            ctx.textAlign = "center"; ctx.textBaseline = "top";
            ctx.fillStyle = hov || sel ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.62)";
            ctx.fillText(n.firstName, nx, ny + nr + 4);
            ctx.restore();
          }
        });
      });

      // ─ Nucleus (user)
      const pulse = (Math.sin(t * 0.045) + 1) / 2;
      ctx.save(); ctx.globalAlpha = 0.14 + pulse * 0.12;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 36 + pulse * 6, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const hg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 40);
      hg.addColorStop(0, "rgba(212,175,55,0.42)"); hg.addColorStop(1, "transparent");
      ctx.fillStyle = hg; ctx.fillRect(cx - 40, cy - 40, 80, 80);
      const profileImg = profile.avatar_url ? loadImg(profile.avatar_url) : null;
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = "rgba(30,18,6,0.98)"; ctx.fillRect(cx - 22, cy - 22, 44, 44);
      if (profileImg) {
        ctx.drawImage(profileImg, cx - 22, cy - 22, 44, 44);
      } else {
        ctx.fillStyle = BG;
        ctx.font = "bold 11px -apple-system,sans-serif";
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText(profile.first_name[0]?.toUpperCase() || "?", cx, cy);
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = "#f0d060"; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.shadowColor = "rgba(3,2,8,0.95)"; ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(212,175,55,0.55)";
      ctx.font = "9px -apple-system,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.fillText(profile.first_name, cx, cy + 27); ctx.restore();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect(); };
  }, [profile]);

  // ── Interaction ───────────────────────────────────────────────────────────
  const getNodeAt = useCallback((mx: number, my: number): OrbitNode | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const w = c.offsetWidth, h = c.offsetHeight;
    const cx = w / 2, cy = h / 2;
    return nodesRef.current.find(n => {
      const r  = orbitR(n.orbit, w);
      const nx = cx + r * Math.cos(n.angle);
      const ny = cy + r * TILT * Math.sin(n.angle);
      return Math.hypot(mx - nx, my - ny) < nodeR(n.orbit) + 16;
    }) ?? null;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit  = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      // Pause hit node, resume previously selected
      nodesRef.current.forEach(n => {
        if (n.id === hit.id)              n.speed = 0;
        else if (n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      selectedRef.current = hit.id;
      setSelectedNode({ ...hit, speed: 0 });
    } else {
      nodesRef.current.forEach(n => {
        if (n.id === selectedRef.current) n.speed = n.baseSpeed;
      });
      selectedRef.current = null;
      setSelectedNode(null);
    }
  }, [getNodeAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const shift = useCallback((nodeId: string, dir: "in" | "out") => {
    const node = nodesRef.current.find(n => n.id === nodeId);
    if (!node) return;
    const next = (dir === "in" ? node.orbit - 1 : node.orbit + 1) as 1 | 2 | 3;
    if (next < 1 || next > 3) return;
    setOverrides(prev => ({ ...prev, [nodeId]: next }));
    setSelectedNode(prev => prev?.id === nodeId ? { ...prev, orbit: next } : prev);
  }, []);

  const close = useCallback(() => {
    nodesRef.current.forEach(n => {
      if (n.id === selectedRef.current) n.speed = n.baseSpeed;
    });
    selectedRef.current = null;
    setSelectedNode(null);
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <style>{`
        @keyframes gov-up {
          from { opacity:0; transform:translateX(-50%) translateY(16px); }
          to   { opacity:1; transform:translateX(-50%) translateY(0);    }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none", cursor: "pointer" }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => { mouseRef.current = { x: -9999, y: -9999 }; }}
      />

      {/* ── Floating member panel ── */}
      {selectedNode && (
        <div style={{
          position: "absolute", bottom: 84, left: "50%",
          transform: "translateX(-50%)",
          width: "min(300px, calc(100vw - 36px))",
          background: "rgba(6,3,14,0.97)",
          backdropFilter: "blur(28px)", WebkitBackdropFilter: "blur(28px)",
          border: "0.5px solid rgba(212,175,55,0.30)",
          borderTop: "1px solid rgba(212,175,55,0.55)",
          borderRadius: 22, padding: "16px 18px",
          boxShadow: "0 24px 64px rgba(0,0,0,0.92)",
          animation: "gov-up 0.20s cubic-bezier(.22,.8,.36,1)",
          zIndex: 30,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
              border: `1.5px solid rgba(212,175,55,${selectedNode.joined ? "0.55" : "0.22"})`,
              background: "rgba(212,175,55,0.08)",
            }}>
              {selectedNode.avatarUrl
                ? <img src={selectedNode.avatarUrl} alt={selectedNode.firstName}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <div style={{
                    width: "100%", height: "100%", display: "flex",
                    alignItems: "center", justifyContent: "center",
                    fontSize: 18, fontWeight: 700,
                    color: selectedNode.joined ? GOLD : "rgba(184,160,216,0.85)",
                  }}>
                    {selectedNode.firstName[0]?.toUpperCase()}
                  </div>
              }
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 15, fontWeight: 700, color: "#fff",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {selectedNode.name}
              </div>
              <div style={{
                fontSize: 9, color: "rgba(212,175,55,0.45)",
                letterSpacing: "0.11em", textTransform: "uppercase", marginTop: 3,
              }}>
                {["Órbita directa", "Órbita extendida", "Órbita afinidad"][selectedNode.orbit - 1]}
                {selectedNode.deceased ? " · En memoria" : ""}
                {selectedNode.joined && !selectedNode.deceased ? " · Conectado" : ""}
              </div>
            </div>

            <button onClick={close} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(255,255,255,0.22)", fontSize: 22, lineHeight: 1, padding: 0, flexShrink: 0,
            }}>×</button>
          </div>

          {/* Acercar / alejar */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, justifyContent: "center" }}>
            <button onClick={() => shift(selectedNode.id, "in")} disabled={selectedNode.orbit === 1}
              style={{
                padding: "4px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                cursor: selectedNode.orbit > 1 ? "pointer" : "default",
                color: selectedNode.orbit > 1 ? "rgba(212,175,55,0.75)" : "rgba(212,175,55,0.18)",
                background: "transparent",
                border: `0.5px solid rgba(212,175,55,${selectedNode.orbit > 1 ? "0.22" : "0.08"})`,
                borderRadius: 8,
              }}>
              ← acercar
            </button>

            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {([1, 2, 3] as const).map(o => (
                <div key={o} style={{
                  width: o === selectedNode.orbit ? 8 : 5,
                  height: o === selectedNode.orbit ? 8 : 5,
                  borderRadius: "50%",
                  background: o === selectedNode.orbit ? GOLD : "rgba(212,175,55,0.18)",
                  transition: "all 0.2s ease",
                }} />
              ))}
            </div>

            <button onClick={() => shift(selectedNode.id, "out")} disabled={selectedNode.orbit === 3}
              style={{
                padding: "4px 12px", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                cursor: selectedNode.orbit < 3 ? "pointer" : "default",
                color: selectedNode.orbit < 3 ? "rgba(212,175,55,0.75)" : "rgba(212,175,55,0.18)",
                background: "transparent",
                border: `0.5px solid rgba(212,175,55,${selectedNode.orbit < 3 ? "0.22" : "0.08"})`,
                borderRadius: 8,
              }}>
              alejar →
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => { onEditMember(selectedNode.id); close(); }} style={{
              flex: 1, padding: "11px 0", borderRadius: 13, cursor: "pointer",
              fontSize: 13, fontWeight: 600, letterSpacing: "0.03em",
              background: "rgba(212,175,55,0.08)",
              border: "0.5px solid rgba(212,175,55,0.28)",
              color: GOLD,
            }}>
              Ver perfil
            </button>
            {!selectedNode.joined && (
              <button onClick={() => { onInviteMember(selectedNode.id); close(); }} style={{
                flex: 1, padding: "11px 0", borderRadius: 13, cursor: "pointer",
                fontSize: 13, fontWeight: 700,
                background: "#c9a820",
                borderTop: "1.5px solid #f5e060",
                borderBottom: "2.5px solid #6a5600",
                border: "none", color: "#030208",
              }}>
                Invitar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Add member ── */}
      <button onClick={onAddMember} aria-label="Agregar familiar" style={{
        position: "absolute", bottom: 24, right: 20,
        width: 48, height: 48, borderRadius: "50%",
        background: "#c9a820",
        borderTop: "2px solid #f5e060",
        borderLeft: "1.5px solid rgba(255,240,100,0.4)",
        borderBottom: "4px solid #6a5600",
        borderRight: "1.5px solid rgba(0,0,0,0.4)",
        boxShadow: "0 6px 0 #4a3c00, 0 10px 22px rgba(0,0,0,0.75)",
        color: "#030208", fontSize: 26, fontWeight: 800,
        cursor: "pointer", display: "flex",
        alignItems: "center", justifyContent: "center",
        zIndex: 20, lineHeight: 1,
      }}>
        +
      </button>
    </div>
  );
}
