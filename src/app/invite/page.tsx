import { redirect } from "next/navigation";

// /invite es el destino histórico del CTA de NetworkBanner (no se toca
// ese componente). La experiencia real de invitar familiares vive en
// /invitar, ya migrada al modelo canónico (create_invitation,
// get_my_family_graph). Esta página solo mantiene la URL y reenvía ahí:
// no debe existir un segundo flujo de invitación paralelo.
export default function InvitePage() {
  redirect("/invitar");
}
