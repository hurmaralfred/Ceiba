"use client";
import Link from "next/link";
import { TreePine, MapPin, Users, Share2, Cake, GitFork, Bell, ChevronRight, Star } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-ceiba-950 via-ceiba-900 to-ceiba-800 text-white overflow-x-hidden">

      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-5 max-w-5xl mx-auto">
        <div className="flex items-center gap-2 font-display text-2xl font-bold">
          <TreePine size={26} className="text-ceiba-300" /> Ceiba
        </div>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-ceiba-300 hover:text-white text-sm font-medium transition-colors">
            Iniciar sesión
          </Link>
          <Link href="/auth/register" className="bg-white text-ceiba-900 font-bold text-sm px-4 py-2 rounded-xl hover:bg-ceiba-50 transition-colors">
            Crear cuenta gratis
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-16 pb-20 max-w-3xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur border border-white/20 rounded-full px-4 py-1.5 text-sm text-ceiba-200 mb-8">
          <Star size={13} className="text-amber-400" fill="currentColor" />
          La red familiar que se construye sola
        </div>

        <h1 className="font-display text-5xl sm:text-6xl font-bold mb-6 leading-tight">
          Tu familia,<br />
          <span className="text-ceiba-300">toda conectada</span>
        </h1>

        <p className="text-ceiba-200 text-lg sm:text-xl mb-4 leading-relaxed max-w-2xl mx-auto">
          Agrega a tus familiares una vez. Cuando ellos se registran,
          <strong className="text-white"> Ceiba conecta automáticamente</strong> a toda su red —
          sus hijos son tus sobrinos, sus padres son tus suegros.
        </p>
        <p className="text-ceiba-400 text-base mb-10">
          Gratis. Sin publicidad. Solo tu familia.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/auth/register"
            className="inline-flex items-center justify-center gap-2 bg-white text-ceiba-900 font-bold text-lg px-8 py-4 rounded-2xl hover:bg-ceiba-50 transition-colors shadow-lg">
            Construir mi árbol gratis <ChevronRight size={20} />
          </Link>
          <Link href="/auth/login"
            className="inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-semibold text-lg px-8 py-4 rounded-2xl hover:bg-white/20 transition-colors">
            Ya tengo cuenta
          </Link>
        </div>
      </section>

      {/* Tree mockup */}
      <section className="max-w-sm mx-auto px-6 pb-20">
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-5 shadow-2xl">
          {/* Owner */}
          <div className="flex items-center gap-3 mb-4 pb-4 border-b border-white/10">
            <div className="w-12 h-12 rounded-2xl bg-ceiba-600 flex items-center justify-center text-white font-bold text-lg">AH</div>
            <div>
              <div className="font-bold text-white">Alfredo Hurtado</div>
              <div className="text-ceiba-300 text-xs flex items-center gap-1"><MapPin size={10} /> Bogotá, Colombia</div>
            </div>
            <div className="ml-auto text-right">
              <div className="text-ceiba-300 text-xs">En Ceiba</div>
              <div className="text-white font-bold text-sm">8 familiares</div>
            </div>
          </div>
          {/* Members */}
          {[
            { init: "JH", name: "Joselin Hurtado", rel: "Esposa", ceiba: true, color: "bg-emerald-600" },
            { init: "HH", name: "Hugo Hurtado", rel: "Hermano", ceiba: true, color: "bg-blue-600" },
            { init: "EH", name: "Ezequiel Hurtado", rel: "Hijo", ceiba: false, color: "bg-gray-400" },
            { init: "MH", name: "María Hurtado", rel: "Madre", ceiba: true, color: "bg-purple-600" },
          ].map((m, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <div className={`w-9 h-9 rounded-xl ${m.color} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}>
                {m.init}
              </div>
              <div className="flex-1">
                <div className="text-white text-sm font-medium">{m.name}</div>
                <div className="text-ceiba-400 text-xs">{m.rel}</div>
              </div>
              {m.ceiba && (
                <span className="text-xs bg-ceiba-700/50 text-ceiba-300 px-2 py-0.5 rounded-full">En Ceiba</span>
              )}
            </div>
          ))}
          <div className="mt-3 pt-3 border-t border-white/10 text-center">
            <span className="text-ceiba-400 text-xs">+4 familiares en red extendida · 2° grado</span>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-center font-display text-3xl font-bold mb-3">¿Cómo funciona?</h2>
        <p className="text-center text-ceiba-300 mb-12">Tres pasos. Menos de 2 minutos.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { n: "1", title: "Crea tu perfil", desc: "Regístrate con tus nombres completos, foto y tu red social favorita.", icon: <Users size={24} /> },
            { n: "2", title: "Agrega tu familia", desc: "Ingresa a tus familiares. Ceiba detecta automáticamente si ya están registrados.", icon: <GitFork size={24} /> },
            { n: "3", title: "Comparte tu árbol", desc: "Envía el link de tu árbol. Cada familiar que se une expande la red de todos.", icon: <Share2 size={24} /> },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 backdrop-blur border border-white/10 rounded-2xl p-6">
              <div className="w-10 h-10 rounded-xl bg-ceiba-700 flex items-center justify-center text-ceiba-300 mb-4">
                {s.icon}
              </div>
              <div className="text-ceiba-400 text-xs font-bold mb-1">PASO {s.n}</div>
              <h3 className="font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-ceiba-300 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-center font-display text-3xl font-bold mb-12">Todo lo que necesitas</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: <GitFork size={20} />, title: "Árbol inteligente", desc: "Las relaciones se infieren solas. Si tu hermano se une, sus hijos aparecen como tus sobrinos automáticamente." },
            { icon: <MapPin size={20} />, title: "Mapa familiar", desc: "Descubre dónde vive cada familiar. Perfecta para cuando viajas o te mudas a una ciudad nueva." },
            { icon: <Cake size={20} />, title: "Próximos cumpleaños", desc: "Nunca olvides un cumpleaños familiar. Ceiba te muestra quién cumple en los próximos 30 días." },
            { icon: <Bell size={20} />, title: "Notificaciones", desc: "Recibe avisos cuando un familiar se une, acepta una invitación o confirma una conexión." },
            { icon: <Share2 size={20} />, title: "Link para compartir", desc: "Comparte tu árbol con un link. Quien lo abre ve tu familia y puede unirse con un clic." },
            { icon: <Users size={20} />, title: "Red extendida", desc: "No solo ves a tu familia directa — también la familia de tu familia, hasta 2 grados de separación." },
          ].map((f, i) => (
            <div key={i} className="flex gap-4 bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="w-9 h-9 rounded-xl bg-ceiba-800 flex items-center justify-center text-ceiba-300 flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-ceiba-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="max-w-2xl mx-auto px-6 pb-24 text-center">
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-3xl p-10">
          <TreePine size={40} className="text-ceiba-300 mx-auto mb-4" />
          <h2 className="font-display text-3xl font-bold mb-3">Empieza hoy, es gratis</h2>
          <p className="text-ceiba-300 mb-8 leading-relaxed">
            Sin tarjeta de crédito. Sin publicidad. Solo tu familia conectada en un solo lugar.
          </p>
          <Link href="/auth/register"
            className="inline-flex items-center gap-2 bg-white text-ceiba-900 font-bold text-lg px-8 py-4 rounded-2xl hover:bg-ceiba-50 transition-colors shadow-lg">
            Crear mi árbol familiar <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      <footer className="text-center text-ceiba-600 pb-8 text-sm">
        © 2025 Ceiba · Hecho con amor por familias, para familias
      </footer>
    </main>
  );
}
