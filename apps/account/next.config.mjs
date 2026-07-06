/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@moauth/connect-contract",
    "@moauth/client-registry-store",
    "@moauth/audit-store",
    "@moauth/authorized-apps-store",
    "@moauth/zitadel-client",
    "@moauth/handoff-store",
  ],
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    const staticHeaders = [
      { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
    ];
    return [
      { source: "/:path*", headers },
      { source: "/_next/static/:path*", headers: staticHeaders },
    ];
  },
};

export default nextConfig;