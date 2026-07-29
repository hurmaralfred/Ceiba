"use client";
import { useState } from "react";
import {
  Home, TreePine, BookOpen, Images, User, Star, Heart,
  UserPlus, BookMarked, Feather, ArrowRight,
  Baby, Plane,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, GlassCard } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { BottomNavigation } from "@/components/ui/BottomNavigation";
import { ModalSheet } from "@/components/ui/ModalSheet";
import { FormField } from "@/components/ui/FormField";

const PALETTE = [
  { name: "Terracota 500", hex: "#c1603a", cls: "bg-earth-500"  },
  { name: "Terracota 600", hex: "#a84f2f", cls: "bg-earth-600"  },
  { name: "Terracota 100", hex: "#fae5d8", cls: "bg-earth-100"  },
  { name: "Cream BG",      hex: "#f7edd9", cls: "bg-[#f7edd9]"  },
  { name: "Cream 100",     hex: "#fdf8f1", cls: "bg-cream-100"  },
  { name: "Cream 300",     hex: "#eedfc6", cls: "bg-cream-300"  },
  { name: "Verde 600",     hex: "#5c7a52", cls: "bg-ceiba-600"  },
  { name: "Verde 100",     hex: "#e4eed9", cls: "bg-ceiba-100"  },
  { name: "Dorado 500",    hex: "#c4922a", cls: "bg-gold-500"   },
  { name: "Dorado 300",    hex: "#edcf88", cls: "bg-gold-300"   },
  { name: "Marrón 700",    hex: "#3d2b1a", cls: "bg-brown-700"  },
  { name: "Marrón 800",    hex: "#2e1c0e", cls: "bg-brown-800"  },
  { name: "Oscuro BG",     hex: "#0d1320", cls: "bg-[#0d1320]"  },
];

const NAV_ITEMS = [
  { href: "/",        icon: Home,     label: "Inicio"             },
  { href: "/tree",    icon: TreePine, label: "Árbol"              },
  { href: "/feed",    icon: Feather,  label: "Historias", center: true },
  { href: "/photos",  icon: Images,   label: "Álbumes"            },
  { href: "/profile", icon: User,     label: "Perfil"             },
];

export function DesignSystemPreview() {
  const [modalOpen, setModalOpen] = useState(false);
  const [darkModalOpen, setDarkModalOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] pb-32">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="bg-cream-100 border-b border-cream-400 px-5 py-4 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-title-lg text-brown-800">
              Sistema Visual · Ceiba
            </h1>
            <p className="text-caption text-brown-400">Solo en desarrollo</p>
          </div>
          <Badge variant="terra" icon={<Star size={10} />}>Design Preview</Badge>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-8 space-y-14">

        {/* ── 1. PALETA ──────────────────────────────────────── */}
        <section>
          <SectionHeader title="Paleta de colores" subtitle="Tokens semánticos" className="mb-5" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {PALETTE.map(({ name, hex, cls }) => (
              <div key={hex} className="rounded-xl overflow-hidden border border-cream-400" style={{ boxShadow: "var(--shadow-xs)" }}>
                <div className={`${cls} h-16`} />
                <div className="bg-white px-3 py-2">
                  <p className="text-tiny font-semibold text-brown-700 truncate">{name}</p>
                  <p className="text-tiny text-brown-400 font-mono">{hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 2. TIPOGRAFÍA ──────────────────────────────────── */}
        <section>
          <SectionHeader title="Tipografía" subtitle="Escala editorial" className="mb-6" />
          <Card variant="default" padding="lg" className="space-y-5">
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">display-xl · Playfair Display · 64px</p>
              <p className="font-display font-bold text-display-xl text-brown-800 leading-tight">90 años</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">display · Playfair Display · 48px</p>
              <p className="font-display font-bold text-display text-brown-800">Nuestras Raíces</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">heading · Playfair Display · 32px</p>
              <p className="font-display font-bold text-heading text-brown-800">Abuela Carmen</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">title-lg · Inter · 22px · 600</p>
              <p className="text-title-lg font-semibold text-brown-800">Familiares Conectados</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">title · Inter · 18px · 600</p>
              <p className="text-title font-semibold text-brown-700">María López · Hace 2 horas</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">body · Inter · 15px · 400</p>
              <p className="text-body text-brown-600">¡Qué recuerdos! Esta casa guarda tantas historias familiares de generaciones.</p>
            </div>
            <div>
              <p className="text-tiny text-brown-400 mb-1 font-mono">caption · Inter · 13px · 400</p>
              <p className="text-caption text-brown-400">recordemos con amor · 1934 – 2024</p>
            </div>
          </Card>
        </section>

        {/* ── 3. BOTONES ─────────────────────────────────────── */}
        <section>
          <SectionHeader title="Botones" subtitle="Variantes y tamaños" className="mb-5" />
          <Card variant="default" padding="lg" className="space-y-6">
            <div className="space-y-2">
              <p className="text-caption text-brown-400 font-mono">Primary</p>
              <div className="flex flex-wrap gap-3">
                <Button size="sm">Pequeño</Button>
                <Button size="md">Mediano</Button>
                <Button size="lg">Grande</Button>
                <Button disabled>Desactivado</Button>
                <Button loading>Cargando</Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-caption text-brown-400 font-mono">Pill (CTA principal)</p>
              <div className="flex flex-col gap-3">
                <Button pill fullWidth size="lg" icon={<UserPlus size={18} />}>Invitar familiar</Button>
                <Button pill fullWidth size="lg" iconRight={<ArrowRight size={18} />}>Siguiente</Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-caption text-brown-400 font-mono">Secondary / Ghost / Gold</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary">Secundario</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="gold" icon={<Star size={15} />}>Destacado</Button>
              </div>
            </div>
          </Card>
        </section>

        {/* ── 4. TARJETAS ────────────────────────────────────── */}
        <section>
          <SectionHeader title="Tarjetas" subtitle="Default · Warm · Glass · Stat" className="mb-5" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Card variant="default" padding="md">
              <p className="text-caption text-brown-400 font-mono mb-2">default</p>
              <p className="text-body text-brown-700">Tarjeta base con fondo crema y borde suave.</p>
            </Card>
            <Card variant="warm" padding="md">
              <p className="text-caption text-[#8c6020] font-mono mb-2">warm</p>
              <p className="text-body text-brown-700">Papel envejecido · Historia destacada.</p>
            </Card>
            <GlassCard padding="md">
              <p className="text-caption text-brown-400 font-mono mb-2">glass (light)</p>
              <p className="text-body text-brown-700">Glassmorphism cálido con blur.</p>
            </GlassCard>
            <div className="bg-brown-800 rounded-2xl p-1">
              <Card variant="dark-glass" padding="md">
                <p className="text-caption text-white/50 font-mono mb-2">dark-glass</p>
                <p className="text-body text-white/85">Perfil familiar, árbol oscuro.</p>
              </Card>
            </div>
            <Card variant="stat" padding="md" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-earth-100 flex items-center justify-center shrink-0">
                <User size={18} className="text-earth-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body font-semibold text-brown-800">Familiares</p>
                <p className="text-caption text-brown-400">Conectados</p>
              </div>
              <p className="text-title-lg font-bold text-earth-500">33</p>
            </Card>
          </div>
        </section>

        {/* ── 5. AVATARES ────────────────────────────────────── */}
        <section>
          <SectionHeader title="Avatares" subtitle="Tamaños y variantes de anillo" className="mb-5" />
          <Card variant="default" padding="lg">
            <div className="flex flex-wrap items-end gap-4 mb-6">
              {(["xs","sm","md","lg","xl","2xl"] as const).map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <Avatar size={s} name="María López" />
                  <p className="text-tiny text-brown-400">{s}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex flex-col items-center gap-2">
                <Avatar size="lg" name="Ana García" ring ringColor="terra" />
                <p className="text-tiny text-brown-400">ring terra</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="lg" name="José M." ring ringColor="gold" />
                <p className="text-tiny text-brown-400">ring gold</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="lg" name="Carmen" ring ringColor="green" />
                <p className="text-tiny text-brown-400">ring green</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Avatar size="xl" name="Abuela Carmen" />
                <p className="text-tiny text-brown-400">iniciales</p>
              </div>
            </div>
          </Card>
        </section>

        {/* ── 6. BADGES ──────────────────────────────────────── */}
        <section>
          <SectionHeader title="Badges" subtitle="Etiquetas y relaciones" className="mb-5" />
          <Card variant="default" padding="lg">
            <div className="flex flex-wrap gap-2 mb-4">
              <Badge variant="terra" icon={<Star size={10} />}>Historia destacada</Badge>
              <Badge variant="gold">Dorado</Badge>
              <Badge variant="green">Consanguíneo</Badge>
              <Badge variant="cream">Crema</Badge>
              <Badge variant="blood">Sangre</Badge>
              <Badge variant="affinity">Afinidad</Badge>
            </div>
            <div className="bg-brown-800 rounded-xl p-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="dark" icon={<Heart size={10} />}>Familia unida</Badge>
                <Badge variant="dark">Árbol oscuro</Badge>
              </div>
            </div>
          </Card>
        </section>

        {/* ── 7. CAMPOS DE FORMULARIO ────────────────────────── */}
        <section>
          <SectionHeader title="Formulario" subtitle="Campos con estados" className="mb-5" />
          <Card variant="default" padding="lg" className="space-y-4">
            <FormField
              label="Nombre del abuelo"
              placeholder="Nombre de tu abuelo"
              icon={<User size={16} />}
              hint="Como aparece en documentos oficiales"
            />
            <FormField
              label="Correo electrónico"
              type="email"
              placeholder="correo@ejemplo.com"
              error="Este correo ya está registrado"
            />
            <FormField label="Sin icono" placeholder="Escribe aquí..." />
            <FormField label="Desactivado" placeholder="No disponible" disabled defaultValue="Campo bloqueado" />
          </Card>
        </section>

        {/* ── 8. SECTION HEADER ──────────────────────────────── */}
        <section>
          <SectionHeader title="SectionHeader" subtitle="Variantes" className="mb-5" />
          <div className="space-y-4">
            <Card variant="default" padding="md">
              <SectionHeader title="Biografía" icon={<BookOpen size={18} />} action={<Badge variant="terra" size="sm">Nueva</Badge>} />
            </Card>
            <Card variant="default" padding="md">
              <SectionHeader title="Línea de tiempo" subtitle="Momentos clave de su vida" serif />
            </Card>
            <div className="bg-brown-800 rounded-2xl p-4">
              <SectionHeader title="Galería familiar" icon={<Images size={18} />} dark action={<button className="text-tiny text-gold-400">Ver todo</button>} />
            </div>
          </div>
        </section>

        {/* ── 9. EMPTY STATE ─────────────────────────────────── */}
        <section>
          <SectionHeader title="Empty State" subtitle="Sin contenido" className="mb-5" />
          <div className="grid sm:grid-cols-2 gap-4">
            <Card variant="default" padding="none">
              <EmptyState
                icon={<BookMarked size={24} className="text-earth-400" />}
                title="Sin historias aún"
                description="Agrega el primer recuerdo de tu familia."
                action={<Button size="sm">Agregar historia</Button>}
              />
            </Card>
            <div className="bg-brown-800 rounded-2xl">
              <EmptyState dark icon={<Images size={24} className="text-gold-400" />} title="Sin fotos" description="Sube fotos para completar el perfil." action={<Button size="sm" variant="gold">Subir foto</Button>} />
            </div>
          </div>
        </section>

        {/* ── 10. MODAL SHEET ────────────────────────────────── */}
        <section>
          <SectionHeader title="Modal Sheet" subtitle="Light y dark" className="mb-5" />
          <Card variant="default" padding="lg">
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setModalOpen(true)}>Modal light</Button>
              <Button variant="primary" onClick={() => setDarkModalOpen(true)}>Modal dark</Button>
            </div>
          </Card>

          <ModalSheet open={modalOpen} onClose={() => setModalOpen(false)} title="Detalle">
            <div className="px-5 pb-8 space-y-4">
              <SectionHeader title="Biografía" icon={<BookOpen size={18} />} />
              <p className="text-body text-brown-600">María nació en un pequeño pueblo rodeado de montañas.</p>
              <div className="flex gap-3">
                <Button fullWidth variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
                <Button fullWidth onClick={() => setModalOpen(false)}>Guardar</Button>
              </div>
            </div>
          </ModalSheet>

          <ModalSheet open={darkModalOpen} onClose={() => setDarkModalOpen(false)} variant="dark" title="Perfil">
            <div className="px-5 pb-8 space-y-4">
              <div className="flex items-center gap-3 pt-2">
                <Avatar size="xl" name="Maria García" ring ringColor="gold" />
                <div>
                  <p className="font-display text-heading font-bold text-white">Maria</p>
                  <p className="text-caption text-white/60">1950 – Presente</p>
                  <p className="text-body text-white/80 mt-1">Abuela, madre, maestra</p>
                </div>
              </div>
              <div className="glass-dark rounded-2xl p-4 border border-white/10">
                <SectionHeader title="Biografía" icon={<BookOpen size={16} />} dark />
                <p className="text-body text-white/75 mt-3">María nació en un pequeño pueblo rodeado de montañas.</p>
              </div>
              <div className="flex gap-3 pt-2">
                {[
                  { year: "1950", label: "Nacimiento", Icon: Baby, color: "bg-earth-500/80" },
                  { year: "1973", label: "Matrimonio", Icon: Heart, color: "bg-gold-500/80" },
                  { year: "1980", label: "Migración",  Icon: Plane, color: "bg-ceiba-600/80" },
                ].map(({ year, label, Icon, color }) => (
                  <div key={year} className="flex-1 text-center rounded-2xl bg-white/8 border border-white/10 py-3 px-2">
                    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center mx-auto mb-1`}>
                      <Icon size={14} className="text-white" />
                    </div>
                    <p className="text-tiny text-white/90 font-semibold">{year}</p>
                    <p className="text-tiny text-white/50">{label}</p>
                  </div>
                ))}
              </div>
              <Button fullWidth variant="gold" size="lg" pill onClick={() => setDarkModalOpen(false)}>Ver perfil completo</Button>
            </div>
          </ModalSheet>
        </section>

        {/* ── 11. NAVEGACIÓN INFERIOR ────────────────────────── */}
        <section>
          <SectionHeader title="Bottom Navigation" subtitle="Light y dark (preview estático)" className="mb-5" />
          <div className="space-y-4">
            <Card variant="default" padding="none" className="overflow-hidden">
              <p className="text-caption text-brown-400 font-mono px-4 pt-3 pb-1">light</p>
              <nav className="bg-cream-100 border-t border-cream-400">
                <div className="flex items-center justify-around max-w-lg mx-auto">
                  {NAV_ITEMS.map(({ icon: Icon, label, center }) => (
                    <div key={label} className="relative flex flex-col items-center gap-0.5 px-3 py-2 flex-1">
                      {!center && label === "Inicio" && (
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-earth-500 rounded-b-full" />
                      )}
                      {center ? (
                        <div className="w-12 h-12 rounded-full flex items-center justify-center -mt-5 bg-earth-500" style={{ boxShadow: "var(--shadow-md)" }}>
                          <Icon size={22} strokeWidth={2} className="text-white" />
                        </div>
                      ) : (
                        <Icon size={22} strokeWidth={label === "Inicio" ? 2.5 : 1.8} className={label === "Inicio" ? "text-earth-600" : "text-brown-300"} />
                      )}
                      <span className={`text-tiny font-medium ${label === "Inicio" ? "text-earth-600 font-semibold" : center ? "text-earth-600" : "text-brown-300"}`}>{label}</span>
                    </div>
                  ))}
                </div>
              </nav>
            </Card>
            <div className="bg-[#0d1320] rounded-2xl p-4">
              <p className="text-caption text-white/40 font-mono mb-3">dark (árbol)</p>
              <div className="bg-brown-900/90 border border-white/10 rounded-full px-2 py-1 flex items-center justify-around">
                {NAV_ITEMS.map(({ icon: Icon, label, href, center }) => (
                  <div key={label} className="relative flex flex-col items-center gap-0.5 px-3 py-1.5 flex-1">
                    {center ? (
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center -mt-5 ${href === "/tree" ? "bg-gold-500" : "bg-brown-700"}`} style={{ boxShadow: "var(--shadow-md)" }}>
                        <Icon size={22} strokeWidth={2} className={href === "/tree" ? "text-white" : "text-gold-300"} />
                      </div>
                    ) : (
                      <Icon size={22} strokeWidth={href === "/tree" ? 2.5 : 1.8} className={href === "/tree" ? "text-gold-400" : "text-white/45"} />
                    )}
                    <span className={`text-tiny font-medium ${href === "/tree" ? "text-gold-400" : center ? "text-white/50" : "text-white/45"}`}>{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 12. SOMBRAS ────────────────────────────────────── */}
        <section>
          <SectionHeader title="Sombras cálidas" subtitle="Escala de elevación" className="mb-5" />
          <div className="flex flex-wrap gap-5">
            {(["warm-xs","warm-sm","warm","warm-md","warm-lg"] as const).map((s) => (
              <div key={s} className={`bg-cream-100 rounded-xl px-4 py-3 shadow-${s} border border-cream-300`}>
                <p className="text-tiny font-mono text-brown-500">{s}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      <BottomNavigation items={NAV_ITEMS} variant="light" />
    </div>
  );
}
