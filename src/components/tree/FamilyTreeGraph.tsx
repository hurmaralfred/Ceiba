"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";

interface Props {
  profile: Profile;
  members: FamilyMember[];
}

interface NodeDatum extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: "root" | "blood" | "affinity";
  relation: string;
}

interface LinkDatum extends d3.SimulationLinkDatum<NodeDatum> {
  source: string | NodeDatum;
  target: string | NodeDatum;
}

const COLORS = {
  root: "#15803d",
  blood: "#166534",
  affinity: "#92400e",
  linkBlood: "#86efac",
  linkAffinity: "#fcd34d",
};

export default function FamilyTreeGraph({ profile, members }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 520;

    const nodes: NodeDatum[] = [
      {
        id: "root",
        name: profile.first_name,
        type: "root",
        relation: "Tú",
      },
      ...members.map((m) => ({
        id: m.id,
        name: m.first_name,
        type: m.relation_kind as "blood" | "affinity",
        relation: RELATION_LABELS[m.relation_type] ?? m.relation_type,
      })),
    ];

    const links: LinkDatum[] = members.map((m) => ({
      source: "root",
      target: m.id,
    }));

    // Clear previous render
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`);

    // Background
    svg
      .append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#f9fafb")
      .attr("rx", 16);

    // Zoomable group
    const g = svg.append("g");

    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.4, 3])
        .on("zoom", (event) => g.attr("transform", event.transform))
    );

    // Simulation
    const simulation = d3
      .forceSimulation<NodeDatum>(nodes)
      .force(
        "link",
        d3
          .forceLink<NodeDatum, LinkDatum>(links)
          .id((d) => d.id)
          .distance(150)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(55));

    // Links
    const link = g
      .append("g")
      .selectAll<SVGLineElement, LinkDatum>("line")
      .data(links)
      .join("line")
      .attr("stroke", (d) => {
        const target = nodes.find(
          (n) => n.id === (typeof d.target === "string" ? d.target : (d.target as NodeDatum).id)
        );
        return target?.type === "blood" ? COLORS.linkBlood : COLORS.linkAffinity;
      })
      .attr("stroke-width", 2.5)
      .attr("stroke-opacity", 0.7);

    // Drag
    const drag = d3
      .drag<SVGGElement, NodeDatum>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    // Node groups
    const node = g
      .append("g")
      .selectAll<SVGGElement, NodeDatum>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "grab")
      .call(drag);

    // Shadow/glow for root
    node
      .filter((d) => d.type === "root")
      .append("circle")
      .attr("r", 38)
      .attr("fill", "#bbf7d0")
      .attr("opacity", 0.5);

    // Main circle
    node
      .append("circle")
      .attr("r", (d) => (d.type === "root" ? 30 : 22))
      .attr("fill", (d) => COLORS[d.type])
      .attr("stroke", "white")
      .attr("stroke-width", 2.5);

    // Initials
    node
      .append("text")
      .text((d) => d.name[0]?.toUpperCase() ?? "?")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("fill", "white")
      .attr("font-size", (d) => (d.type === "root" ? "15px" : "12px"))
      .attr("font-weight", "700")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Name
    node
      .append("text")
      .text((d) => d.name)
      .attr("text-anchor", "middle")
      .attr("y", (d) => (d.type === "root" ? 45 : 36))
      .attr("fill", "#111827")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Relation label
    node
      .append("text")
      .text((d) => d.relation)
      .attr("text-anchor", "middle")
      .attr("y", (d) => (d.type === "root" ? 58 : 49))
      .attr("fill", "#6b7280")
      .attr("font-size", "10px")
      .attr("font-family", "system-ui, sans-serif")
      .attr("pointer-events", "none");

    // Tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as NodeDatum).x ?? 0)
        .attr("y1", (d) => (d.source as NodeDatum).y ?? 0)
        .attr("x2", (d) => (d.target as NodeDatum).x ?? 0)
        .attr("y2", (d) => (d.target as NodeDatum).y ?? 0);

      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [profile, members]);

  return (
    <div ref={containerRef} className="w-full rounded-2xl overflow-hidden border border-gray-200 bg-gray-50">
      <div className="flex items-center gap-4 px-4 py-2 border-b border-gray-100 bg-white text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-green-800 inline-block" />
          Sangre
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-amber-800 inline-block" />
          Política
        </span>
        <span className="ml-auto">Arrastra · Zoom con scroll</span>
      </div>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
