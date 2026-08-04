"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import type { Profile, FamilyMember } from "@/lib/types";
import type { ExtendedEntry, MemberLink } from "@/components/tree/FamilyTreeGraph";

// ── Orbit seed (cold start — no behavioral signals yet) ───────────────────────
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
// Everything else → orbit 3 (in-laws, cousins, affinity, chosen)

function seedOrbit(rel: string, kind?: string | null): 1 | 2 | 3 {
  if (ORBIT_1.has(rel)) return 1;
  if (ORBIT_2.has(rel)) return 2;
  if (kind === "affinity") return 3;
  return 2; // unknown blood defaults to extended
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface OrbitNode {
  id: string;
  name: string;
  firstName: string;
  orbit: 1 | 2 | 3;
  angle: number;   // current radians, mutated each frame
  speed: number;   // rad/frame, alternates sign per orbit
  deceased: boolean;
  joined: boolean;
  relationType: string;
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

// ── Constants ─────────────────────────────────────────────────────────────────
const GOLD   = "#d4af37";
const BG     = "#030208";
const TILT   = 0.68;  // vertical squeeze → perspective feel
const SPEEDS = [0.009, 0.006, 0.003] as const;
const SIGNS  = [1, -1, 1] as const;  // alternate rotation directions

function orbitR(orbit: 1 | 2 | 3, w: number): number {
  return [0.19, 0.34, 0.47][orbit - 1] * w;
}
function nodeR(orbit: 1 | 2 | 3): number {
  return [15, 12, 10][orbit - 1];
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
  // Manual orbit overrides — weight > any behavioral signal
  const [overrides, setOverrides] = useState<Record<string, 1 | 2 | 3>>({});

  // ── Build orbit nodes whenever members or overrides change ────────────────
  useEffect(() => {
    const seen = new Set<string>();
    const raw: OrbitNode[] = [];

    members.forEach(m => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      const orbit: 1 | 2 | 3 = overrides[m.id] ?? seedOrbit(m.relation_type, (m as any).relation_kind);
      raw.push({
        id: m.id,
        name: `${m.first_name} ${m.last_name || ""}`.trim(),
        firstName: m.first_name,
        orbit,
        angle: 0,
        speed: SPEEDS[orbit - 1] * SIGNS[orbit - 1],
        deceased: !!(m as any).is_deceased,
        joined: !!m.profile_id,
        relationType: m.relation_type,
      });
    });

    extendedMembers.forEach(e => {
      if (seen.has(e.member.id)) return;
      seen.add(e.member.id);
      const defaultOrbit: 1 | 2 | 3 = seedOrbit(e.inferredRelation || "other", e.member.relation_kind);
      const orbit: 1 | 2 | 3 = overrides[e.member.id] ?? defaultOrbit;
      raw.push({
        id: e.member.id,
        name: `${e.member.first_name} ${e.member.last_name || ""}`.trim(),
        firstName: e.member.first_name,
        orbit,
        angle: 0,
        speed: SPEEDS[orbit - 1] * SIGNS[orbit - 1],
        deceased: !!(e.member as any).is_deceased,
        joined: !!e.member.profile_id,
        relationType: e.inferredRelation || "other",
      });
    });

    // Distribute starting angles evenly within each orbit
    const groups: Record<number, OrbitNode[]> = { 1: [], 2: [], 3: [] };
    raw.forEach(n => groups[n.orbit].push(n));
    [1, 2, 3].forEach(o => {
      const g = groups[o];
      if (!g.length) return;
      const step = (Math.PI * 2) / g.length;
      g.forEach((n, i) => { n.angle = -Math.PI / 2 + step * i; });
    });

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
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      const w = canvas.offsetWidth, h = canvas.offsetHeight;
      const cx = w / 2, cy = h / 2;
      const t = ++tRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, w, h);

      // — Nebulae
      ([
        { x: .28, y: .30, r: .38, c: "rgba(80,20,180,0.09)"  },
        { x: .72, y: .65, r: .30, c: "rgba(20,60,150,0.08)"  },
        { x: .50, y: .50, r: .22, c: "rgba(180,100,10,0.07)" },
      ] as const).forEach(n => {
        const g = ctx.createRadialGradient(w*n.x, h*n.y, 0, w*n.x, h*n.y, w*n.r);
        g.addColorStop(0, n.c); g.addColorStop(1, "transparent");
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      });

      // — Stars (deterministic)
      for (let i = 0; i < 65; i++) {
        const sx = ((i * 137.5) % 100) / 100 * w;
        const sy = ((i * 97.3)  % 100) / 100 * h;
        const sr = 0.5 + (i % 5) * 0.18;
        const so = 0.14 + (i % 7) * 0.055;
        ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${so})`; ctx.fill();
      }

      // — Orbit rings
      ([1, 2, 3] as const).forEach(orbit => {
        const r = orbitR(orbit, w);
        ctx.save();
        ctx.strokeStyle = `rgba(212,175,55,${[0.18, 0.10, 0.06][orbit - 1]})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 9]);
        ctx.beginPath();
        ctx.ellipse(cx, cy, r, r * TILT, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = `rgba(212,175,55,${[0.22, 0.13, 0.08][orbit - 1]})`;
        ctx.font = "7px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(["DIRECTA", "EXTENDIDA", "AFINIDAD"][orbit - 1], cx, cy - r * TILT - 5);
        ctx.restore();
      });

      // — Advance angles + draw back-to-front
      ([3, 2, 1] as const).forEach(orbit => {
        nodesRef.current.filter(n => n.orbit === orbit).forEach(n => {
          n.angle += n.speed;
          const r  = orbitR(n.orbit, w);
          const nx = cx + r * Math.cos(n.angle);
          const ny = cy + r * TILT * Math.sin(n.angle);
          const nr = nodeR(n.orbit);
          const hov = Math.hypot(mouseRef.current.x - nx, mouseRef.current.y - ny) < nr + 14;
          const sel = selectedRef.current === n.id;

          if (n.deceased) {
            // Dimmed — stays in orbit
            ctx.save();
            ctx.globalAlpha = 0.22;
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = "rgba(212,175,55,0.07)";
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.18)";
            ctx.font = `bold ${Math.round(nr * .72)}px system-ui`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
            ctx.restore();
          } else {
            // Glow halo
            ctx.save();
            ctx.globalAlpha = hov || sel ? 0.55 : 0.22;
            const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, nr * 3);
            g.addColorStop(0, n.joined ? "rgba(212,175,55,0.45)" : "rgba(120,120,210,0.35)");
            g.addColorStop(1, "transparent");
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(nx, ny, nr * 3, 0, Math.PI * 2); ctx.fill();
            ctx.restore();

            // Pulse ring when selected
            if (sel) {
              const pf = (Math.sin(t * 0.12) + 1) / 2;
              ctx.save();
              ctx.globalAlpha = 0.45 + pf * 0.2;
              ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
              ctx.beginPath(); ctx.arc(nx, ny, nr + 7 + pf * 3, 0, Math.PI * 2); ctx.stroke();
              ctx.restore();
            }

            // Circle body
            ctx.save();
            const fill = ctx.createRadialGradient(nx - nr * .3, ny - nr * .3, 0, nx, ny, nr);
            fill.addColorStop(0, n.joined ? "rgba(212,175,55,0.25)" : "rgba(100,100,200,0.15)");
            fill.addColorStop(1, "rgba(8,5,18,0.92)");
            ctx.fillStyle = fill;
            ctx.strokeStyle = n.joined ? GOLD : "rgba(184,160,216,0.65)";
            ctx.lineWidth = hov || sel ? 1.8 : 1.2;
            ctx.beginPath(); ctx.arc(nx, ny, nr, 0, Math.PI * 2);
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = n.joined ? GOLD : "rgba(184,160,216,0.85)";
            ctx.font = `bold ${Math.round(nr * .72)}px system-ui`;
            ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillText(n.firstName[0]?.toUpperCase() || "?", nx, ny);
            ctx.restore();

            // Name on hover/select
            if (hov || sel) {
              ctx.save();
              ctx.fillStyle = "rgba(255,255,255,0.9)";
              ctx.font = "10px system-ui";
              ctx.textAlign = "center"; ctx.textBaseline = "top";
              ctx.fillText(n.firstName, nx, ny + nr + 5);
              ctx.restore();
            }
          }
        });
      });

      // — Nucleus (user)
      const pulse = (Math.sin(t * 0.045) + 1) / 2;
      ctx.save();
      ctx.globalAlpha = 0.09 + pulse * 0.08;
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, 30 + pulse * 5, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      const ng = ctx.createRadialGradient(cx, cy, 0, cx, cy, 32);
      ng.addColorStop(0, "rgba(212,175,55,0.35)"); ng.addColorStop(1, "transparent");
      ctx.fillStyle = ng; ctx.fillRect(cx - 32, cy - 32, 64, 64);
      ctx.fillStyle = GOLD; ctx.strokeStyle = "#f5e070"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = BG;
      ctx.font = "bold 10px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(profile.first_name[0]?.toUpperCase() || "?", cx, cy);
      ctx.fillStyle = "rgba(212,175,55,0.5)";
      ctx.font = "8px system-ui"; ctx.textBaseline = "top";
      ctx.fillText(profile.first_name, cx, cy + 24);

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [profile]);

  // ── Pointer interaction ───────────────────────────────────────────────────
  const getNodeAt = useCallback((mx: number, my: number): OrbitNode | null => {
    const c = canvasRef.current;
    if (!c) return null;
    const w = c.offsetWidth, h = c.offsetHeight;
    const cx = w / 2, cy = h / 2;
    let hit: OrbitNode | null = null;
    nodesRef.current.forEach(n => {
      const r  = orbitR(n.orbit, w);
      const nx = cx + r * Math.cos(n.angle);
      const ny = cy + r * TILT * Math.sin(n.angle);
      if (Math.hypot(mx - nx, my - ny) < nodeR(n.orbit) + 12) hit = n;
    });
    return hit;
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const hit  = getNodeAt(e.clientX - rect.left, e.clientY - rect.top);
    if (hit) {
      selectedRef.current = hit.id;
      setSelectedNode({ ...hit });
    } else {
      selectedRef.current = null;
      setSelectedNode(null);
    }
  }, [getNodeAt]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }, []);

  const shift = useCallback((nodeId: string, dir: "in" | "out") => {
    setOverrides(prev => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      if (!node) return prev;
      const cur  = prev[nodeId] ?? node.orbit;
      const next = (dir === "in" ? cur - 1 : cur + 1) as 1 | 2 | 3;
      if (next < 1 || next > 3 || next === cur) return prev;
      return { ...prev, [nodeId]: next };
    });
    // Reflect immediately in the panel
    setSelectedNode(prev => {
      if (!prev || prev.id !== nodeId) return prev;
      const cur  = prev.orbit;
      const next = (dir === "in" ? cur - 1 : cur + 1) as 1 | 2 | 3;
      if (next < 1 || next > 3) return prev;
      return { ...prev, orbit: next };
    });
  }, []);

  const close = useCallback(() => {
    selectedRef.current = null;
    setSelectedNode(null);
  }, []);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <style>{`
        @keyframes gov-up {
          from { opacity:0; transform: translateX(-50%) translateY(10px); }
          to   { opacity:1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <canvas
        ref={canvasRef}
        style={{ width: "100%", height: "100%", display: "block", touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onPointerLeave={() => { mouseRef.current = { x: -9999, y: -9999 }; }}
      />

      {/* ── Node panel ── */}
      {selectedNode && (
        <div style={{
          position: "absolute", bottom: 80, left: "50%",
          transform: "translateX(-50%)",
          width: "min(296px, calc(100vw - 40px))",
          background: "rgba(8,5,18,0.96)", backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          border: "0.5px solid rgba(212,175,55,0.28)",
          borderTop: "0.5px solid rgba(212,175,55,0.48)",
          borderRadius: 20, padding: "16px 18px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.88)",
          animation: "gov-up 0.18s ease",
          zIndex: 30,
        }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: "rgba(212,175,55,0.10)", border: "1px solid rgba(212,175,55,0.28)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 700, color: GOLD,
            }}>
              {selectedNode.firstName[0]?.toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {selectedNode.name}
              </div>
              <div style={{ fontSize: 9, color: "rgba(212,175,55,0.45)", letterSpacing: "0.12em",
                textTransform: "uppercase", marginTop: 2 }}>
                {["Órbita directa", "Órbita extendida", "Órbita afinidad"][selectedNode.orbit - 1]}
                {selectedNode.deceased ? " · En memoria" : ""}
                {selectedNode.joined && !selectedNode.deceased ? " · Conectado" : ""}
              </div>
            </div>
            <button onClick={close}
              style={{ background: "none", border: "none", cursor: "pointer",
                color: "rgba(255,255,255,0.25)", fontSize: 20, lineHeight: 1,
                padding: 0, flexShrink: 0 }}>
              ×
            </button>
          </div>

          {/* Acercar / alejar — the micro-action */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12, justifyContent: "center" }}>
            <button
              onClick={() => shift(selectedNode.id, "in")}
              disabled={selectedNode.orbit === 1}
              style={{
                padding: "4px 11px", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", cursor: selectedNode.orbit > 1 ? "pointer" : "default",
                color: selectedNode.orbit > 1 ? "rgba(212,175,55,0.7)" : "rgba(212,175,55,0.18)",
                background: "transparent",
                border: `0.5px solid rgba(212,175,55,${selectedNode.orbit > 1 ? "0.20" : "0.08"})`,
                borderRadius: 8, transition: "color 0.15s, border-color 0.15s",
              }}>
              ← acercar
            </button>
            {/* Orbit indicator dots */}
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              {([1, 2, 3] as const).map(o => (
                <div key={o} style={{
                  width: o === selectedNode.orbit ? 7 : 5,
                  height: o === selectedNode.orbit ? 7 : 5,
                  borderRadius: "50%",
                  background: o === selectedNode.orbit
                    ? GOLD
                    : "rgba(212,175,55,0.18)",
                  transition: "all 0.2s ease",
                }} />
              ))}
            </div>
            <button
              onClick={() => shift(selectedNode.id, "out")}
              disabled={selectedNode.orbit === 3}
              style={{
                padding: "4px 11px", fontSize: 10, fontWeight: 600,
                letterSpacing: "0.06em", cursor: selectedNode.orbit < 3 ? "pointer" : "default",
                color: selectedNode.orbit < 3 ? "rgba(212,175,55,0.7)" : "rgba(212,175,55,0.18)",
                background: "transparent",
                border: `0.5px solid rgba(212,175,55,${selectedNode.orbit < 3 ? "0.20" : "0.08"})`,
                borderRadius: 8, transition: "color 0.15s, border-color 0.15s",
              }}>
              alejar →
            </button>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { onEditMember(selectedNode.id); close(); }}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                fontSize: 13, fontWeight: 600, letterSpacing: "0.04em",
                background: "rgba(212,175,55,0.09)",
                border: "0.5px solid rgba(212,175,55,0.25)",
                color: GOLD,
              }}>
              Ver perfil
            </button>
            {!selectedNode.joined && (
              <button
                onClick={() => { onInviteMember(selectedNode.id); close(); }}
                style={{
                  flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer",
                  fontSize: 13, fontWeight: 700,
                  background: "#c9a820",
                  borderTop: "1.5px solid #f5e060",
                  borderBottom: "2px solid #6a5600",
                  border: "none", color: "#030208",
                }}>
                Invitar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Add member ── */}
      <button
        onClick={onAddMember}
        aria-label="Agregar familiar"
        style={{
          position: "absolute", bottom: 24, right: 20,
          width: 46, height: 46, borderRadius: "50%",
          background: "#c9a820",
          borderTop: "2px solid #f5e060",
          borderLeft: "1.5px solid rgba(255,240,100,0.4)",
          borderBottom: "4px solid #6a5600",
          borderRight: "1.5px solid rgba(0,0,0,0.4)",
          boxShadow: "0 6px 0 #4a3c00, 0 10px 20px rgba(0,0,0,0.7)",
          color: "#030208", fontSize: 24, fontWeight: 800,
          cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center",
          zIndex: 20, lineHeight: 1,
        }}>
        +
      </button>
    </div>
  );
}
