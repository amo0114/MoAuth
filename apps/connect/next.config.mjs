/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    MOAUTH_CONNECT_ISSUER: process.env.MOAUTH_CONNECT_ISSUER,
    MOAUTH_CONNECT_PUBLIC_URL: process.env.MOAUTH_CONNECT_PUBLIC_URL,
  },
  transpilePackages: [
    "@moauth/connect-contract",
    "@moauth/client-registry-store",
    "@moauth/authorized-apps-store",
    "@moauth/handoff-store",
    "@moauth/zitadel-client",
  ],
  poweredByHeader: false,
  async headers() {
    const headers = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
    ];
    return [{ source: "/:path*", headers }];
  },
};

export default nextConfig;
