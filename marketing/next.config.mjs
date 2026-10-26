/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // The browser workspace at /app needs cloud sign-in that this build does not have, so it is a
  // dead end for visitors. Send them to the home page's try-it section, which needs no account.
  // Temporary (307) so /app can come back once sign-in works there.
  async redirects() {
    return [
      { source: "/app", destination: "/#try-it", permanent: false },
      { source: "/app/:path*", destination: "/#try-it", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/install.sh", destination: "/api/install" },
      { source: "/install.ps1", destination: "/api/install-windows" },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
        ],
      },
      {
        source: "/founder",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/founder/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/waitlist-admin",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/activate",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/activate/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/app",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/app/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
      {
        source: "/waitlist-admin/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },
};

export default nextConfig;
