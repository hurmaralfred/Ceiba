"use client";
import { useEffect, useRef } from "react";
import * as d3 from "d3";
import { FamilyMember, Profile, RELATION_LABELS } from "@/lib/types";

export interface ExtendedEntry {
  member: FamilyMember;
  parentMemberId: string;
  inferredRelation?: string | null;
}

// Relationship between two level-1 members (e.g. Juan Carlos ↔ Jose Humberto = hermanos)
export interface MemberLink {
  fromMemberId: string; // family_members.id of level-1 node A
  toMemberId: string;   // family_members.id of level-1 node B
  relation: string;     // e.g. "brother"
}

interface Props {
  profile: Profile;
  members: FamilyMember[];
  extendedMembers?: ExtendedEntry[];
  memberLinks?: MemberLink[];        // peer relationships between direct members
  onNodeClick?: (memberId: string) => void;
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
  kind: "blood" | "affinity" | "peer";
  label?: string;
}

// Rules to infer lateral links between extended members of the same parent node.
// Each rule: if member A has relation in `a` and member B has relation in `b` → connect them.
const EXTENDED_PEER_RULES: Array<{ a: string[]; b: string[]; label: string }> = [
  // Parejas
  { a: ["father"],               b: ["mother"],               label: "Pareja" },
  { a: ["grandfather_paternal"], b: ["grandmother_paternal"],  label: "Pareja" },
  { a: ["grandfather_maternal"], b: ["grandmother_maternal"],  label: "Pareja" },
  { a: ["father_in_law"],        b: ["mother_in_law"],         label: "Pareja" },
  { a: ["stepfather"],           b: ["stepmother"],            label: "Pareja" },
  // Abuelos → padres
  { a: ["grandfather_paternal","grandmother_paternal"], b: ["father"],  label: "Padre/Hijo" },
  { a: ["grandfather_maternal","grandmother_maternal"], b: ["mother"],  label: "Padre/Hijo" },
  // Hermanos entre sí
  { a: ["brother","sister","half_brother","half_sister"],
    b: ["brother","sister","half_brother","half_sister"],    label: "Hermanos" },
  // Tíos son hermanos de los padres
  { a: ["uncle","aunt"], b: ["father","stepfather"],  label: "Hermanos" },
  { a: ["uncle","aunt"], b: ["mother","stepmother"],  label: "Hermanos" },
  // Sobrinos son hijos de hermanos
  { a: ["nephew","niece"], b: ["brother","sister","half_brother","half_sister"], label: "Sobrino/a" },
  // Esposo/a en línea política
  { a: ["spouse","partner"], b: ["father","mother","son","daughter","brother","sister"], label: "Pareja" },
];

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
  peer: "#93c5fd",   // blue for peer/sibling links between members
};

export default function FamilyTreeGraph({ profile, members, extendedMembers = [], memberLinks = [], onNodeClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onNodeClickRef = useRef(onNodeClick);
  onNodeClickRef.current = onNodeClick;

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = 520;

    // Wrap entire D3 block so a crash doesn't leave page blank
    try {

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
    const memberIdSet = new Set(members.map(m => m.id));
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
      // Peer links: connections between level-1 members (e.g. siblings)
      ...memberLinks
        .filter(l => memberIdSet.has(l.fromMemberId) && memberIdSet.has(l.toMemberId))
        .map(l => ({
          source: l.fromMemberId,
          target: l.toMemberId,
          kind: "peer" as const,
          label: RELATION_LABELS[l.relation as keyof typeof RELATION_LABELS] ?? l.relation,
        })),
    ];

    // Infer lateral links between extended members of the same parent node
    // (e.g. father ↔ mother, grandfather ↔ father, siblings ↔ siblings)
    try {
      const extByParent = new Map<string, ExtendedEntry[]>();
      for (const e of extendedMembers) {
        if (!e?.parentMemberId || !e?.member?.id) continue;
        if (!extByParent.has(e.parentMemberId)) extByParent.set(e.parentMemberId, []);
        extByParent.get(e.parentMemberId)!.push(e);
      }
      const existingLinkKeys = new Set<string>();
      for (const l of links) {
        const s = typeof l.source === "string" ? l.source : (l.source as NodeDatum)?.id;
        const t = typeof l.target === "string" ? l.target : (l.target as NodeDatum)?.id;
        if (s && t) existingLinkKeys.add([s, t].sort().join("|"));
      }
      for (const group of extByParent.values()) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const a = group[i];
            const b = group[j];
            if (!a?.member?.relation_type || !b?.member?.relation_type) continue;
            const aRel = a.member.relation_type;
            const bRel = b.member.relation_type;
            for (const rule of EXTENDED_PEER_RULES) {
              const match =
                (rule.a.includes(aRel) && rule.b.includes(bRel)) ||
                (rule.a.includes(bRel) && rule.b.includes(aRel));
              if (match) {
                const key = [a.member.id, b.member.id].sort().join("|");
                if (!existingLinkKeys.has(key)) {
                  existingLinkKeys.add(key);
                  links.push({
                    source: a.member.id,
                    target: b.member.id,
                    kind: "peer" as const,
                    label: rule.label,
                  });
                }
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn("Extended peer links error (non-fatal):", e);
    }

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
      .attr("stroke", (d) => LINK_COLORS[d.kind] ?? "#86efac")
      .attr("stroke-width", (d) => {
        if (d.kind === "peer") return 2;
        const target = d.target as NodeDatum;
        return target.level === 2 ? 1.5 : 2.5;
      })
      .attr("stroke-opacity", (d) => {
        if (d.kind === "peer") return 0.8;
        const target = d.target as NodeDatum;
        return target.level === 2 ? 0.5 : 0.7;
      })
      .attr("stroke-dasharray", (d) => {
        if (d.kind === "peer") return "4,2";
        const target = d.target as NodeDatum;
        return target.level === 2 ? "5,3" : "none";
      });

    // Drag — track if user actually dragged to distinguish from tap
    let wasDragged = false;
    const drag = d3.drag<SVGGElement, NodeDatum>()
      .on("start", (event, d) => {
        wasDragged = false;
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on("drag", (event, d) => {
        wasDragged = true;
        d.fx = event.x; d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });

    const node = g.append("g")
      .selectAll<SVGGElement, NodeDatum>("g")
      .data(nodes)
      .join("g")
      .attr("cursor", (d) => d.level === 0 ? "grab" : "pointer")
      .call(drag)
      .on("click", (event, d) => {
        if (wasDragged) return; // ignore drag-end clicks
        if (d.level === 1 && onNodeClickRef.current) {
          onNodeClickRef.current(d.id);
        }
      });

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
    } catch (err) {
      console.error("FamilyTreeGraph D3 error:", err);
      // Show error in SVG so we can see what failed
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll("*").remove();
        d3.select(svgRef.current)
          .attr("width", "100%").attr("height", 80)
          .append("text")
          .attr("x", 16).attr("y", 40)
          .attr("fill", "#ef4444")
          .attr("font-size", "13px")
          .text(`Error en árbol: ${String(err).slice(0, 120)}`);
      }
    }
  }, [profile, members, extendedMembers, memberLinks]);

  const hasExtended = extendedMembers.length > 0;
  const hasPeerLinks = memberLinks.length > 0;

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
        {hasPeerLinks && (
          <span className="flex items-center gap-1.5">
            <svg width="14" height="6" viewBox="0 0 14 6">
              <line x1="0" y1="3" x2="14" y2="3" stroke="#93c5fd" strokeWidth="2" strokeDasharray="4,2"/>
            </svg>
            Vínculo
          </span>
        )}
        <span className="ml-auto">Arrastra · Zoom con scroll</span>
      </div>
      <svg ref={svgRef} className="w-full" />
    </div>
  );
}
