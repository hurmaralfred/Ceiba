import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const supabase = createClient();

  const { data } = await supabase
    .from("shared_trees")
    .select("owner_id, profiles!owner_id(first_name, last_name, avatar_url, city, country)")
    .eq("token", params.token)
    .maybeSingle();

  const profile = data ? (data as any).profiles : null;
  const ownerName = profile
    ? `${profile.first_name} ${profile.last_name}`
    : "Tu familiar";
  const location = profile?.city || profile?.country
    ? [profile.city, profile.country].filter(Boolean).join(", ")
    : null;

  const title = `Árbol familiar de ${ownerName} en Ceiba`;
  const description = location
    ? `${ownerName} te invita a ver su árbol familiar. Ubicado en ${location}. Únete a Ceiba y conecta con tu familia.`
    : `${ownerName} te invita a ver su árbol familiar en Ceiba. Conecta con tu familia donde estés.`;

  const avatarUrl = profile?.avatar_url || null;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_ES",
      siteName: "Ceiba — Tu familia, conectada",
      ...(avatarUrl && { images: [{ url: avatarUrl, width: 400, height: 400, alt: ownerName }] }),
    },
    twitter: {
      card: avatarUrl ? "summary_large_image" : "summary",
      title,
      description,
      ...(avatarUrl && { images: [avatarUrl] }),
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
