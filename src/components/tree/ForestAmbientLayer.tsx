"use client";
import { useEffect, useState } from "react";

/**
 * F3.0 — Respiración del Bosque.
 *
 * Solo transmite que el bosque está VIVO, nunca que ocurre un evento.
 * Contenido exclusivo: respiración muy sutil del fondo, rayos de luz y
 * luciérnagas. (La hoja que cruza pertenece a F3.4 — Ciclos naturales —
 * porque cuenta una historia; deliberadamente no está aquí.)
 *
 * Capa de AMBIENTE independiente del grafo. Vive detrás de los nodos y de
 * las líneas (se renderiza antes que `<g ref={gRef}>` en FamilyTreeGraph) y
 * nunca captura eventos (`pointer-events: none`), así que:
 *   - jamás dibuja movimiento sobre nodos ni líneas (P2);
 *   - los clics siguen llegando al fondo/nodos (no interfiere con A2).
 *
 * Contrato F3.0:
 *   - solo `transform` y `opacity` (compositor). Nunca filter/blur/sombra
 *     animados, ni layout/width/height/stroke (P3).
 *   - animaciones CSS declarativas: sin requestAnimationFrame, sin timers.
 *   - `document.hidden` → pausa total (un único listener, no por elemento).
 *   - `prefers-reduced-motion` → todas las animaciones off, estado final
 *     legible (rayos y luciérnagas quedan estáticos; la respiración queda
 *     invisible por su estado base).
 *   - Móvil (<768px) reduce cantidad e intensidad solo con media queries
 *     (sin JS de resize): 2 luciérnagas en vez de 4, un solo grupo de rayos.
 *
 * La deriva de las luciérnagas en coordenadas del lienzo se "hornea" con
 * `width`/`height` reales en las keyframes, para que sea estable sin importar
 * el tamaño de pantalla (el SVG escala por viewBox; estas son coords de
 * lienzo, no de viewport).
 */
export default function ForestAmbientLayer({
  width,
  height,
}: {
  width: number;
  height: number;
}) {
  const W = width;
  const H = height;

  // Único mecanismo JS: pausar cuando la pestaña no está visible. Un solo
  // listener global, no uno por elemento; sin timers ni rAF.
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Deriva de luciérnagas: pequeños desplazamientos en px de lienzo.
  const d = Math.round(Math.min(W, H) * 0.04); // ~ amplitud de deriva

  // Luciérnagas: posiciones sesgadas a la periferia/parte alta, lejos del
  // centro donde se agrupan los nodos (además quedan detrás por z-order).
  const fireflies = [
    { x: W * 0.16, y: H * 0.16, cls: "fa-ff-a" },
    { x: W * 0.82, y: H * 0.13, cls: "fa-ff-b" },
    { x: W * 0.24, y: H * 0.30, cls: "fa-ff-c" }, // oculta en móvil
    { x: W * 0.88, y: H * 0.34, cls: "fa-ff-d" }, // oculta en móvil
  ];

  return (
    <g
      className={`fa-root${paused ? " fa-paused" : ""}`}
      style={{ pointerEvents: "none" }}
      aria-hidden="true"
    >
      <defs>
        {/* Glow SIN filtro: gradiente radial de relleno (barato al moverse) */}
        <radialGradient id="fa-ff-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bbf7d0" stopOpacity="0.9" />
          <stop offset="45%" stopColor="#86efac" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#86efac" stopOpacity="0" />
        </radialGradient>
        {/* Respiración: overlay muy tenue, verde cálido, centrado */}
        <radialGradient id="fa-breath-grad" cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#4ade80" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#4ade80" stopOpacity="0" />
        </radialGradient>

        <style>{`
          /* ── F3.0 keyframes — solo transform/opacity ─────────────── */
          @keyframes fa-rays-a { 0%,100%{opacity:0.7} 50%{opacity:1} }
          @keyframes fa-rays-b { 0%,100%{opacity:0.8} 50%{opacity:0.95} }
          @keyframes fa-breath { 0%,100%{opacity:0} 50%{opacity:0.55} }

          /* Luciérnagas: aparecen, derivan lento, desaparecen; los 0%/100%
             en opacity:0 producen el "desaparecer y reaparecer". */
          @keyframes fa-ff-a {
            0%,100% { opacity:0; transform:translate(0,0); }
            18%     { opacity:0.55; }
            45%     { opacity:0.6; transform:translate(${d}px, ${-d * 0.7}px); }
            70%     { opacity:0.3; transform:translate(${d * 1.4}px, ${d * 0.3}px); }
            88%     { opacity:0.4; transform:translate(${d * 0.6}px, ${d}px); }
          }
          @keyframes fa-ff-b {
            0%,100% { opacity:0; transform:translate(0,0); }
            20%     { opacity:0.5; }
            50%     { opacity:0.55; transform:translate(${-d}px, ${d * 0.5}px); }
            75%     { opacity:0.25; transform:translate(${-d * 1.3}px, ${-d * 0.4}px); }
          }
          @keyframes fa-ff-c {
            0%,100% { opacity:0; transform:translate(0,0); }
            22%     { opacity:0.5; }
            55%     { opacity:0.5; transform:translate(${d * 0.8}px, ${d * 0.9}px); }
            82%     { opacity:0.3; transform:translate(${-d * 0.4}px, ${d * 1.2}px); }
          }
          @keyframes fa-ff-d {
            0%,100% { opacity:0; transform:translate(0,0); }
            16%     { opacity:0.45; }
            48%     { opacity:0.55; transform:translate(${-d * 0.9}px, ${-d}px); }
            80%     { opacity:0.25; transform:translate(${-d * 0.3}px, ${-d * 1.4}px); }
          }

          .fa-rays-a { opacity:0.85; animation: fa-rays-a 21s ease-in-out infinite; }
          .fa-rays-b { opacity:0.9;  animation: fa-rays-b 17s ease-in-out infinite; }
          .fa-breath { opacity:0; animation: fa-breath 24s ease-in-out infinite; }

          .fa-ff { transform-box: fill-box; transform-origin: center; opacity:0.4; }
          .fa-ff-a { animation: fa-ff-a 19s ease-in-out infinite 0s; }
          .fa-ff-b { animation: fa-ff-b 23s ease-in-out infinite 3s; }
          .fa-ff-c { animation: fa-ff-c 21s ease-in-out infinite 6s; }
          .fa-ff-d { animation: fa-ff-d 25s ease-in-out infinite 9s; }

          /* Pausa total cuando la pestaña no está visible */
          .fa-paused, .fa-paused * { animation-play-state: paused !important; }

          /* Móvil: 2 luciérnagas, un solo grupo de rayos (menos intensidad).
             Se reduce por CANTIDAD (display:none), no por opacity: la
             keyframe de opacidad de los rayos sobrescribiría cualquier
             opacity estática, así que ocultar un grupo es lo que realmente
             baja la intensidad. */
          @media (max-width: 767px) {
            .fa-ff-c, .fa-ff-d, .fa-rays-b { display: none; }
          }

          /* Accesibilidad: sin movimiento; estado base legible */
          @media (prefers-reduced-motion: reduce) {
            .fa-root, .fa-root * { animation: none !important; }
          }
        `}</style>
      </defs>

      {/* Respiración del fondo — overlay muy sutil, detrás de todo lo demás */}
      <rect
        className="fa-breath"
        x={0}
        y={0}
        width={W}
        height={H}
        fill="url(#fa-breath-grad)"
      />

      {/* Rayos de luz — dos grupos con periodos distintos (intensidad viva).
          Opacidad de grupo multiplica la de cada rayo, preservando su
          gradación de profundidad. Solo se anima la opacidad. */}
      <g className="fa-rays-a">
        {[-28, -6, 16].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={`fa-ray-a-${deg}`}
              x1={W / 2}
              y1={0}
              x2={W / 2 + Math.sin(rad) * H * 1.6}
              y2={H * 1.4}
              stroke="#4ade80"
              strokeWidth={Math.max(18, 50 - Math.abs(deg) * 0.8)}
              opacity={0.03 - Math.abs(deg) * 0.0004}
              strokeLinecap="butt"
            />
          );
        })}
      </g>
      <g className="fa-rays-b">
        {[-16, 6, 28].map((deg) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <line
              key={`fa-ray-b-${deg}`}
              x1={W / 2}
              y1={0}
              x2={W / 2 + Math.sin(rad) * H * 1.6}
              y2={H * 1.4}
              stroke="#4ade80"
              strokeWidth={Math.max(18, 50 - Math.abs(deg) * 0.8)}
              opacity={0.03 - Math.abs(deg) * 0.0004}
              strokeLinecap="butt"
            />
          );
        })}
      </g>

      {/* Luciérnagas — glow por gradiente de relleno (sin filtro). Detrás de
          los nodos y sesgadas a la periferia → no se acercan a las personas. */}
      {fireflies.map((f, i) => (
        <circle
          key={`fa-ff-${i}`}
          className={`fa-ff ${f.cls}`}
          cx={f.x}
          cy={f.y}
          r={3.2}
          fill="url(#fa-ff-grad)"
        />
      ))}
    </g>
  );
}
