"use client";
import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Misma clave que /invite/[token] y /auth/*.
const PENDING_INVITE_KEY = "pending_invite_token";

/**
 * Quien se registra con Google desde una invitación vuelve por /auth/callback,
 * que no sabe nada de la invitación y termina en /onboarding: el invitado
 * acababa como usuario nuevo sin conectar con su familia. Con correo y
 * contraseña /auth/register sí retoma la invitación; con Google no.
 *
 * Si hay sesión y un token pendiente, lleva de vuelta a /invite/[token] (donde
 * se acepta sola). Se ignoran /invite y /auth, que gestionan el token por su
 * cuenta, y solo se intenta una vez por carga para no crear bucles.
 */
export default function PendingInviteRedirect() {
  const pathname = usePathname();
  const router = useRouter();
  const tried = useRef(false);

  useEffect(() => {
    if (tried.current) return;
    if (pathname.startsWith("/invite") || pathname.startsWith("/auth")) return;

    let token: string | null = null;
    try {
      token = sessionStorage.getItem(PENDING_INVITE_KEY);
    } catch {
      return;
    }
    if (!token) return;

    tried.current = true;
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (data.user) router.replace(`/invite/${token}`);
      });
  }, [pathname, router]);

  return null;
}
