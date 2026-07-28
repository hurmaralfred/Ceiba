"use client";

/**
 * OrganicBranches — warm bark-colored bezier underlay for blood edges.
 *
 * Rendered BEHIND the existing colored connection lines so blood-relation
 * paths look like real wooden branches rather than glowing lines. The thin
 * colored lines remain on top to preserve genealogical color coding.
 *
 * Only blood edges are affected; peer (partner) and affinity edges keep their
 * existing rendering unchanged.
 */

interface EdgePath {
  d: string;
  kind: "blood" | "affinity" | "peer";
  isTrunk: boolean;  // touches the root node directly
}

interface Props {
  edgePaths: EdgePath[];
}

export default function OrganicBranches({ edgePaths }: Props) {
  return (
    <g style={{ pointerEvents: "none" }}>
      {edgePaths.map((ep, i) => {
        if (ep.kind !== "blood") return null;

        // Trunk edges (root ↔ parent/child) get thicker bark underlay
        const baseW = ep.isTrunk ? 5.5 : 5.0;
        const hiW   = ep.isTrunk ? 2.0 : 1.6;

        return (
          <g key={i}>
            {/* Dark base shadow — gives branch depth */}
            <path
              d={ep.d}
              fill="none"
              stroke="#1a0c04"
              strokeWidth={baseW + 3}
              strokeLinecap="round"
              opacity={0.35}
            />
            {/* Main bark tone */}
            <path
              d={ep.d}
              fill="none"
              stroke="#6a4018"
              strokeWidth={baseW}
              strokeLinecap="round"
              opacity={ep.isTrunk ? 0.82 : 0.70}
            />
            {/* Warm highlight (bark sheen) */}
            <path
              d={ep.d}
              fill="none"
              stroke="#a87040"
              strokeWidth={hiW}
              strokeLinecap="round"
              opacity={0.32}
            />
          </g>
        );
      })}
    </g>
  );
}
