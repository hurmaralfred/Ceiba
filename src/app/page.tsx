"use client";
import Link from "next/link";
import { TreePine, MapPin, Users, Share2 } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 to-ceiba-800 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-6 pt-24 pb-16 text-center max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-center w-20 h-20 rounded-3xl bg-white/10 backdrop-blur">
          <TreePine size={44} className="text-ceiba-300" />
        </div>
        <h1 className="font-display text-5xl font-bold mb-4 leading-tight">
          Ceiba
        </h1>
        <p className="text-ceiba-200 text-xl mb-3 font-medium">
          Conecta con tu familia. Toda tu familia.
        </p>
        <p className="text-ceiba-300 text-base mb-10 leading-relaxed">
          Descubre lazos familiares que no sabías que tenías. Invita a tus parientes,
          construyan juntos el árbol más grande posible y encuentra quién de tu familia
          vive cerca de ti.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Link href="/auth/register" className="btn-primary text-center bg-white text-ceiba-800 hover:bg-ceiba-50 text-lg px-8">
            Crear mi cuenta gratis
          </Link>
          <Link href="/auth/login" className="btn-secondary text-center bg-transparent border-white/30 text-white hover:bg-white/10 text-lg px-8">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-24 grid grid-cols-1 sm:grid-cols-3 gap-6">
        <FeatureCard
          icon={<Users size={28} />}
          title="Árbol sin límites"
          desc="Registra padres, hermanos, hijos y pareja. Cada familiar que se une expande la red."
        />
        <FeatureCard
          icon={<Share2 size={28} />}
          title="Invita y conecta"
          desc="Envía invitaciones. Cuando aceptan, sus familiares se suman automáticamente a tu árbol."
        />
        <FeatureCard
          icon={<MapPin size={28} />}
          title="¿Quién está cerca?"
          desc="Activa la localización y descubre qué familiares tienes cerca, aunque nunca los hayas conocido."
        />
      </section>

      <footer className="text-center text-ceiba-600 pb-8 text-sm">
        © 2025 Ceiba · Hecho con amor por familias, para familias
      </footer>
    </main>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="bg-white/10 backdrop-blur rounded-2xl p-6 text-center">
      <div className="flex justify-center mb-3 text-ceiba-300">{icon}</div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-ceiba-300 text-sm leading-relaxed">{desc}</p>
    </div>
  );
}
