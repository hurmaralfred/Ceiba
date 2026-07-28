"use client";

/**
 * LivingTreeBackdrop — golden ambient aura centered on the user node.
 * Renders behind trunk, branches, and nodes. Pointer-events: none.
 */
interface Props {
  cx: number;     // user node center X
  rootY: number;  // user node center Y
  auraRx: number; // horizontal radius of the aura ellipse
  auraRy: number; // vertical radius of the aura ellipse
}

const GRAD_ID = "lt-user-aura";

export default function LivingTreeBackdrop({ cx, rootY, auraRx, auraRy }: Props) {
  return (
    <g style={{ pointerEvents: "none" }}>
      <defs>
        <radialGradient id={GRAD_ID} cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#d4a030" stopOpacity="0.28" />
          <stop offset="55%"  stopColor="#a07020" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#040c06" stopOpacity="0"    />
        </radialGradient>
      </defs>
      <ellipse
        cx={cx}
        cy={rootY}
        rx={auraRx}
        ry={auraRy}
        fill={`url(#${GRAD_ID})`}
        opacity={0.85}
      />
    </g>
  );
}
