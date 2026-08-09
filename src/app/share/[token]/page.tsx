"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, MapPin, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { RELATION_LABELS, RelationType } from "@/lib/types";

interface TreeRow {
  owner_id: string;
  owner_first_name: string;
  owner_last_name: string;
  owner_avatar_url: string | null;
  owner_city: string | null;
  owner_country: string | null;
  member_first_name: string | null;
  member_last_name: string | null;
  member_relation_type: string | null;
  member_has_profile: boolean;
}

const GOLD = "#d4af37";
const BG = "#030208";
const CARD = "#0c0a18";
const BORDER = "rgba(212,175,55,0.18)";
const MUTED = "rgba(255,255,255,0.45)";

const BLOOD_RELATIONS = new Set([
  "father","mother","son","daughter","brother","sister",
  "half_brother","half_sister","nephew","niece",
  "grandfather_paternal","grandmother_paternal",
  "grandfather_maternal","grandmother_maternal",
  "grandson","granddaughter","uncle","aunt","cousin",
]);

export default function SharePage() {
  const params = useParams();
  const supabase = createClient();
  const [rows, setRows] = useState<TreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { loadTree(); }, []);

  const loadTree = async () => {
    const { data, error } = await supabase.rpc("get_shared_tree", { p_token: params.token });
    if (error || !data || data.length === 0) { setNotFound(true); setLoading(false); return; }
    setRows(data);
    setLoading(false);
  };

  if (loading) return (
    <div style={{ minHeight: "100svh", background: BG, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Sparkles size={40} style={{ color: GOLD, opacity: 0.7, animation: "pulse 2s infinite" }} />
    </div>
  );

  if (notFound) return (
    <main style={{ minHeight: "100svh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ textAlign: "center", color: "#fff" }}>
        <Sparkles size={48} style={{ color: GOLD, margin: "0 auto 16px" }} />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>Galaxia no encontrado</h1>
        <p style={{ color: MUTED, marginBottom: 24 }}>Este link no existe o ya expiró.</p>
        <Link href="/" style={{ background: GOLD, color: "#000", padding: "10px 24px", borderRadius: 10, fontWeight: 700, textDecoration: "none" }}>
          Ir a Ceiba
        </Link>
      </div>
    </main>
  );

  const owner = rows[0];
  const members = rows.filter(r => r.member_first_name);
  const bloodMembers = members.filter(m => BLOOD_RELATIONS.has(m.member_relation_type as RelationType));
  const affinityMembers = members.filter(m => !BLOOD_RELATIONS.has(m.member_relation_type as RelationType));
  const registeredCount = members.filter(m => m.member_has_profile).length;

  return (
    <main style={{ minHeight: "100svh", background: BG, color: "#fff" }}>
      {/* Nav */}
      <nav style={{
        padding: "14px 20px", display: "flex", alignItems: "center",
        justifyContent: "space-between",
        borderBottom: `1px solid ${BORDER}`,
        background: "rgba(12,10,24,0.95)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 800, fontSize: "1.1rem", color: GOLD }}>
          <Sparkles size={20} style={{ color: GOLD }} />
          Ceiba
        </div>
        <Link href="/auth/register" style={{
          background: GOLD, color: "#000", padding: "8px 18px",
          borderRadius: 10, fontWeight: 700, fontSize: "0.85rem", textDecoration: "none",
        }}>
          Únete gratis
        </Link>
      </nav>

      <div style={{ maxWidth: 440, margin: "0 auto", padding: "24px 16px 48px", display: "flex", flexDirection: "column", gap: 16 }}>

        {/* Owner card */}
        <div style={{
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18,
          padding: "20px", display: "flex", alignItems: "center", gap: 16,
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: "rgba(212,175,55,0.15)",
            border: `2px solid ${BORDER}`, flexShrink: 0, overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: "1.5rem", fontWeight: 800, color: GOLD,
          }}>
            {owner.owner_avatar_url ? (
              <img src={owner.owner_avatar_url} alt={owner.owner_first_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              `${owner.owner_first_name[0]}${owner.owner_last_name?.[0] ?? ""}`
            )}
          </div>
          <div>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 700, marginBottom: 4, color: "#fff" }}>
              {owner.owner_first_name} {owner.owner_last_name}
            </h1>
            {owner.owner_city && (
              <p style={{ color: MUTED, fontSize: "0.8rem", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}>
                <MapPin size={12} />
                {owner.owner_city}{owner.owner_country ? `, ${owner.owner_country}` : ""}
              </p>
            )}
            <p style={{ color: GOLD, fontSize: "0.8rem", fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
              <Users size={12} />
              {members.length} familiar{members.length !== 1 ? "es" : ""} en Ceiba
              {registeredCount > 0 && (
                <span style={{ color: MUTED, fontWeight: 400 }}>
                  · {registeredCount} registrado{registeredCount !== 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Members */}
        {bloodMembers.length > 0 && (
          <MemberGroup title="Familia de sangre" members={bloodMembers} />
        )}
        {affinityMembers.length > 0 && (
          <MemberGroup title="Familia política" members={affinityMembers} />
        )}

        {/* CTA */}
        <div style={{
          background: "linear-gradient(135deg, rgba(212,175,55,0.12) 0%, rgba(12,10,24,0.9) 100%)",
          border: `1px solid ${BORDER}`,
          borderRadius: 18, padding: "32px 24px", textAlign: "center",
        }}>
          <div style={{
            width: 52, height: 52, borderRadius: 14,
            background: "rgba(212,175,55,0.15)", border: `1px solid ${BORDER}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <Sparkles size={26} style={{ color: GOLD }} />
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 700, marginBottom: 8 }}>
            ¿Eres parte de esta familia?
          </h2>
          <p style={{ color: MUTED, fontSize: "0.875rem", marginBottom: 24, lineHeight: 1.6 }}>
            Crea tu propio galaxia en Ceiba —gratis— y conecta con tu familia, cerca o lejos.
          </p>
          <Link href="/auth/register" style={{
            background: GOLD, color: "#000",
            padding: "12px 28px", borderRadius: 12,
            fontWeight: 800, fontSize: "0.95rem", textDecoration: "none",
            display: "inline-block",
          }}>
            Crear mi galaxia familiar
          </Link>
        </div>
      </div>
    </main>
  );
}

function MemberGroup({ title, members }: { title: string; members: TreeRow[] }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "16px 20px" }}>
      <h2 style={{ fontWeight: 700, fontSize: "0.8rem", textTransform: "uppercase", letterSpacing: "0.08em", color: MUTED, marginBottom: 12 }}>
        {title}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {members.map((m, i) => (
          <div key={i} style={{
            padding: "12px 0",
            borderBottom: i < members.length - 1 ? `1px solid rgba(255,255,255,0.06)` : "none",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: m.member_has_profile ? "rgba(212,175,55,0.2)" : "rgba(255,255,255,0.06)",
              border: m.member_has_profile ? `1px solid ${BORDER}` : "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.85rem", fontWeight: 700,
              color: m.member_has_profile ? GOLD : MUTED,
            }}>
              {m.member_first_name![0]}{m.member_last_name?.[0] ?? ""}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#fff" }}>
                {m.member_first_name} {m.member_last_name}
              </div>
              <div style={{ fontSize: "0.75rem", color: MUTED, marginTop: 2 }}>
                {RELATION_LABELS[m.member_relation_type as RelationType] ?? m.member_relation_type}
                {m.member_has_profile && (
                  <span style={{ color: GOLD, fontWeight: 600, marginLeft: 6 }}>· En Ceiba</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
