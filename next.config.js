/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript:  { ignoreBuildErrors: true },
  eslint:      { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },

  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/" }],
      },
    ];
  },
};

module.exports = nextConfig;
