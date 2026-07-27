"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TreePine, ArrowLeft, Users, MessageCircle, Plus, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import BottomNav from "@/components/BottomNav";

interface Conversation {
  roomId: string;
  type: "group" | "direct";
  name: string;
  avatar?: string | null;
  lastMessage?: string | null;
  lastAt?: string | null;
  unread: boolean;
  otherUserId?: string;
}

interface RosterMember {
  person_id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  photo_path: string | null;
}

function timeAgo(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return "ahora";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

export default function ChatListPage() {
  const router = useRouter();
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [familyMembers, setFamilyMembers] = useState<RosterMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewDM, setShowNewDM] = useState(false);
  const [starting, setStarting] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    await Promise.all([loadConversations(), loadFamilyMembers()]);
    setLoading(false);
  };

  const loadConversations = async () => {
    const res = await fetch("/api/chat/rooms");
    if (!res.ok) { toast.error("Error al cargar conversaciones"); return; }
    const { conversations } = await res.json();
    setConversations(conversations || []);
  };

  const loadFamilyMembers = async () => {
    const res = await fetch("/api/family/roster");
    if (!res.ok) return;
    const { members } = await res.json();
    setFamilyMembers(members || []);
  };

  const startDM = async (otherUserId: string) => {
    if (starting) return;
    setStarting(true);
    try {
      const res = await fetch("/api/chat/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherUserId }),
      });
      const body = await res.json();
      if (!res.ok) { toast.error(body.error || "Error al abrir conversación"); return; }
      router.push(`/chat/${body.roomId}`);
    } finally {
      setStarting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <TreePine size={36} className="text-ceiba-600 animate-pulse" />
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="bg-ceiba-800 text-white px-4 py-4 flex items-center gap-3 shadow-lg">
        <Link href="/tree" className="text-ceiba-300 hover:text-white">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex items-center gap-2 font-display text-lg font-bold flex-1">
          <TreePine size={20} className="text-ceiba-300" /> Mensajes
        </div>
        <button
          onClick={() => setShowNewDM(!showNewDM)}
          className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={15} /> Nuevo mensaje
        </button>
      </nav>

      <div className="max-w-lg mx-auto pb-20">
        {showNewDM && (
          <div className="bg-white border-b border-gray-100 px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 mb-2">Enviar mensaje a:</p>
            {familyMembers.length === 0 ? (
              <p className="text-sm text-gray-400">Ningún familiar tiene Ceiba aún.</p>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {familyMembers.map(m => (
                  <button
                    key={m.person_id}
                    disabled={starting}
                    onClick={() => { setShowNewDM(false); startDM(m.user_id); }}
                    className="flex items-center gap-2 bg-gray-100 hover:bg-ceiba-50 rounded-full px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    <div className="w-6 h-6 rounded-full bg-ceiba-700 overflow-hidden flex items-center justify-center text-white text-xs font-bold">
                      {m.photo_path
                        ? <img src={m.photo_path} className="w-full h-full object-cover" alt="" />
                        : `${m.first_name[0] || "?"}${(m.last_name || "")[0] || ""}`}
                    </div>
                    {m.first_name} {m.last_name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {conversations.map(conv => (
            <Link
              key={conv.roomId}
              href={`/chat/${conv.roomId}`}
              className="flex items-center gap-3 px-4 py-4 bg-white hover:bg-gray-50 transition-colors"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden ${
                conv.type === "group" ? "bg-ceiba-700" : "bg-blue-600"
              }`}>
                {conv.type === "group"
                  ? <Users size={22} className="text-white" />
                  : conv.avatar
                    ? <img src={conv.avatar} className="w-full h-full object-cover" alt="" />
                    : <span className="text-white font-bold text-sm">{conv.name[0]}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={`font-semibold text-gray-900 ${conv.unread ? "font-bold" : ""}`}>
                    {conv.name}
                  </span>
                  {conv.lastAt && (
                    <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(conv.lastAt)}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <p className={`text-sm truncate ${conv.unread ? "text-gray-900 font-medium" : "text-gray-500"}`}>
                    {conv.lastMessage || "Sin mensajes aún"}
                  </p>
                  {conv.unread && <div className="w-2 h-2 rounded-full bg-ceiba-600 flex-shrink-0" />}
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-300 flex-shrink-0" />
            </Link>
          ))}
        </div>

        {conversations.length === 0 && (
          <div className="text-center py-20 px-6">
            <MessageCircle size={48} className="text-gray-300 mx-auto mb-4" />
            <h3 className="font-bold text-gray-600 mb-2">Sin conversaciones</h3>
            <p className="text-gray-400 text-sm">Comienza un mensaje directo con un familiar o únete al chat grupal.</p>
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
