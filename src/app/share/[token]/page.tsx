"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, MapPin, Users, User } from "lucide-react";
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

export default function SharePage() {
  const params = useParams();
  const router = useRouter();
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
    <div className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center">
      <TreePine size={40} className="text-ceiba-300 animate-pulse" />
    </div>
  );

  if (notFound) return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 flex items-center justify-center px-4">
      <div className="text-center text-white">
        <TreePine size={48} className="text-ceiba-300 mx-auto mb-4" />
        <h1 className="text-2xl font-bold mb-2">Árbol no encontrado</h1>
        <p className="text-ceiba-300 mb-6">Este link no existe o ya expiró.</p>
        <Link href="/" className="btn-primary">Ir a Ceiba</Link>
      </div>
    </main>
  );

  const owner = rows[0];
  const members = rows.filter(r => r.member_first_name);
  const bloodMembers = members.filter(m => {
    const rel = m.member_relation_type as RelationType;
    return ["father","mother","son","daughter","brother","sister","half_brother","half_sister",
      "nephew","niece","grandfather_paternal","grandmother_paternal","grandfather_maternal",
      "grandmother_maternal","grandson","granddaughter","uncle","aunt","cousin"].includes(rel);
  });
  const affinityMembers = members.filter(m => !bloodMembers.includes(m));

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 font-display text-xl font-bold">
          <TreePine size={22} className="text-ceiba-300" /> Ceiba
        </div>
        <Link href="/auth/register" className="btn-primary text-sm py-1.5 px-4">
          Únete gratis
        </Link>
      </nav>

      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Owner card */}
        <div className="card flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-ceiba-700 flex-shrink-0 overflow-hidden">
            {owner.owner_avatar_url ? (
              <img src={owner.owner_avatar_url} alt={owner.owner_first_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                {owner.owner_first_name[0]}{owner.owner_last_name?.[0]}
              </div>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {owner.owner_first_name} {owner.owner_last_name}
            </h1>
            {owner.owner_city && (
              <p className="text-gray-500 text-sm flex items-center gap-1">
                <MapPin size={13} /> {owner.owner_city}{owner.owner_country ? `, ${owner.owner_country}` : ""}
              </p>
            )}
            <p className="text-ceiba-700 text-sm font-medium flex items-center gap-1 mt-1">
              <Users size={13} /> {members.length} familiar{members.length !== 1 ? "es" : ""} en Ceiba
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
        <div className="card bg-ceiba-50 border border-ceiba-200 text-center py-8">
          <TreePine size={32} className="text-ceiba-600 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-ceiba-900 mb-2">
            ¿Eres parte de esta familia?
          </h2>
          <p className="text-ceiba-700 text-sm mb-5">
            Únete a Ceiba gratis y conecta con tu familia, cerca o lejos.
          </p>
          <Link href="/auth/register" className="btn-primary inline-block">
            Crear mi árbol familiar
          </Link>
        </div>
      </div>
    </main>
  );
}

function MemberGroup({ title, members }: { title: string; members: TreeRow[] }) {
  return (
    <div className="card">
      <h2 className="font-bold text-gray-800 mb-3">{title}</h2>
      <div className="divide-y divide-gray-100">
        {members.map((m, i) => (
          <div key={i} className="py-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
              m.member_has_profile ? "bg-ceiba-700 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {m.member_first_name![0]}{m.member_last_name?.[0] || ""}
            </div>
            <div>
              <div className="font-semibold text-gray-900">
                {m.member_first_name} {m.member_last_name}
              </div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {RELATION_LABELS[m.member_relation_type as RelationType] || m.member_relation_type}
                {m.member_has_profile && <span className="text-ceiba-600 font-medium ml-1">· En Ceiba</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
