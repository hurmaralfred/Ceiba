"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";

export interface ExtendedEntry {
  member: FamilyMember;
  parentMemberId: string; // family_members.id of the level-1 node
  inferredRelation?: string | null; // relation from MY perspective (e.g. "nephew" instead of "son")
}

interface Props {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers?: ExtendedEntry[];
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "root" | "blood" | "affinity";
  relation: string;
  level: 0 | 1 | 2;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  source: string | NodeDatum;
  target: string | NodeDatum;
  kind: "blood" | "affinity";
}

const COLORS = {
  root: "#15803d",
  blood: "#166534",
  affinity: "#92400e",
  blood2: "#4ade80",   // level-2 blood (lighter)
  affinity2: "#fbbf24", // level-2 affinity (lighter)
};

const LINK_COLORS = {
  blood: "#86efac",
  affinity: "#fcd34d",
};

export default function FamilyTreeGraph({ profile, members, extendedMembers = [] }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 520;

    // Build nodes
    const nodes: NodeDatum[] = [
      { id: "root", name: profile.first_name, type: "root", relation: "Tú", level: 0 },
      ...members.map((m) => ({
        id: m.id,
        name: m.first_name,
        type: m.relation_kind as "blood" | "affinity",
        relation: RELATION_LABELS[m.relation_type] ?? m.relation_type,
        level: 1 as const,
      })),
      ...extendedMembers.map(({ member: m, inferredRelation }) => ({
        id: m.id,
        name: m.first_name,
        type: m.relation_kind as "blood" | "affinity",
        relation: inferredRelation
          ? (RELATION_LABELS[inferredRelation] ?? inferredRelation)
          : (RELATION_LABELS[m.relation_type] ?? m.relation_type),
        level: 2 as const,
      })),
    ];

    // Build links
    const links: LinkDatum[] = [
      ...members.map((m) => ({
        source: "root",
        target: m.id,
        kind: m.relation_kind as "blood" | "affinity",
      })),
      ...extendedMembers.map(({ member: m, parentMemberId }) => ({
        source: parentMemberId,
        target: m.id,
        kind: m.relation_kind as "blood" | "affinity",
      })),
    ];

    // Clear
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    svg.append("rect")
      .attr("width", width).attr("height", height)
      .attr("fill", "#f9fafb").attr("rx", 16);

    const g = svg.append("g");

    svg.call(
      d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.3, 3])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    const simulation = d3
      .forceSimulation<NodeDatum>(nodes)
      .force("link",
        d3.forceLink<NodeDatum, LinkDatum>(links)
          .id((d) => d.id)
          .distance((d) => {
            const target = d.target as NodeDatum;
            return target.level === 2 ? 110 : 150;
          })
      )
      .force("charge", d3.forceManyBody().strength(-350))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide((d: NodeDatum) => d.level === 2 ? 45 : 55));

    // Links
    const link = g.append("g")
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => LINK_COLORS[d.kind])
      .attr("stroke-width", (d) => {
        const target = d.target as NodeDatum;
        return target.level === 2 ? 1.5 : 2.5;
      })
      .attr("stroke-opacity", (d) => {
        const target = d.target as NodeDatum;
        return target.level === 2 ? 0.5 : 0.7;
      })
      .attr("stroke-dasharray", (d) => {
        const target = d.target as NodeDatum;
        return target.level === 2 ? "5,3" : "none";
      });

    // Drag
    const drag = d3.drag<SVGGElement, NodeDatum>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    const node = g.append("g")
      .selectAll<SVGGElement, NodeDatum>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      .call(drag);

    // Glow for root
    node.filter((d) => d.type === "root")
      .append("circle")
      .attr("r", 38)
      .attr("fill", "#bbf7d0")
      .attr("opacity", 0.5);

    // Main circle
    node.append("circle")
      .attr("r", (d) => d.level === 0 ? 30 : d.level === 1 ? 22 : 16)
      .attr("fill", (d) => {
        if (d.level === 0) return COLORS.root;
        if (d.level === 2) return d.type === "blood" ? COLORS.blood2 : COLORS.affinity2;
        return d.type === "blood" ? COLORS.blood : COLORS.affinity;
      })
      .attr("stroke", "white")
      .attr("stroke-width", (d) => d.level === 2 ? 1.5 : 2.5)
      .attr("opacity", (d) => d.level === 2 ? 0.85 : 1);

    // Initials
    node.append("text")
      .text((d) => d.name[0]?.toUpperCase() ?? "?")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", (d) => d.level === 2 ? "#1f2937" : "white")
      .attr("font-size", (d) => d.level === 0 ? "15px" : d.level === 1 ? "12px" : "10px")
      .attr("font-weight", "700")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Name
    node.append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("y", (d) => d.level === 0 ? 45 : d.level === 1 ? 36 : 28)
      .attr("fill", "#111827")
      .attr("font-size", (d) => d.level === 2 ? "10px" : "11px")
      .attr("font-weight", "600")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Relation label
    node.append("text")
      .text((d) => d.relation)
      .attr("text-anchor", "middle")
      .attr("y", (d) => d.level === 0 ? 58 : d.level === 1 ? 49 : 39)
      .attr("fill", "#6b7280")
      .attr("font-size", "10px")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Level-2 badge
    node.filter((d) => d.level === 2)
      .append("text")
      .text("2°")
      .attr("text-anchor", "middle")
      .attr("y", (d) => 49)
      .attr("fill", "#9ca3af")
      .attr("font-size", "9px")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => { simulation.stop(); };
  }, [profile, members, extendedMembers]);

  const hasExtended = extendedMembers.length > 0;

  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-white text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-800 inline-block" /> Sangre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-800 inline-block" /> Política
        </span>
        {hasExtended && (
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-gray-400 inline-block border-dashed" /> 2° grado
          </span>
        )}
        <span className="ml-auto">Arrastra · Zoom con scroll</span>
      </div>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
