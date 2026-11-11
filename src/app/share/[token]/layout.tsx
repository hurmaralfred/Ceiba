import { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { OG_IMAGE_URL, absoluteUrl, ogImage } from "@/lib/seo";

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

  const title = `Galaxia familiar de ${ownerName} en Ceiba`;
  const description = location
    ? `${ownerName} te invita a ver su galaxia familiar. Ubicado en ${location}. Únete a Ceiba y conecta con tu familia.`
    : `${ownerName} te invita a ver su galaxia familiar en Ceiba. Conecta con tu familia donde estés.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: absoluteUrl(`/share/${params.token}`),
      type: "website",
      locale: "es_ES",
      siteName: "Ceiba",
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE_URL],
    },
  };
}

export default function ShareLayout({ children }: { children: React.ReactNode }) {
  return children;
}
