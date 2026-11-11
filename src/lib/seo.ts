import type { Metadata } from "next";

export const SITE_URL = "https://ceibapp.com";
export const OG_IMAGE_PATH = "/og/og-1200x630.png";
export const OG_IMAGE_URL = `${SITE_URL}${OG_IMAGE_PATH}`;
export const OG_TITLE = "Ceiba – Conecta tu familia";
export const OG_DESCRIPTION =
  "Descubre y conecta con tus familiares, cerca o lejos, conocidos o por conocer.";

export const ogImage = {
  url: OG_IMAGE_URL,
  width: 1200,
  height: 630,
  alt: OG_TITLE,
  type: "image/png" as const,
};

export function absoluteUrl(path: string): string {
  if (!path || path === "/") return SITE_URL;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Open Graph + Twitter Card for a public route. Rendered by the App Router into <head>. */
export function shareMetadata(
  path: string,
  overrides?: { title?: string; description?: string },
): Metadata {
  const title = overrides?.title ?? OG_TITLE;
  const description = overrides?.description ?? OG_DESCRIPTION;
  const url = absoluteUrl(path);
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    openGraph: {
      title,
      description,
      url,
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
