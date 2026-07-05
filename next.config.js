const withPWA = process.env.NODE_ENV === "production"
  ? require("next-pwa")({ dest: "public", register: false, skipWaiting: true })
  : (cfg) => cfg;

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript:  { ignoreBuildErrors: true },
  eslint:      { ignoreDuringBuilds: true },
  images:      { domains: ["*.supabase.co"] },

  // Inyectar config de Firebase en el Service Worker en tiempo de build
  async headers() {
    return [
      {
        source: "/firebase-messaging-sw.js",
        headers: [{ key: "Service-Worker-Allowed", value: "/" }],
      },
    ];
  },
};

module.exports = withPWA(nextConfig);
