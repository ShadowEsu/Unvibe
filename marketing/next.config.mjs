import { ENFORCED_CSP, REPORTING_ENDPOINTS, reportOnlyCsp } from "./src/lib/csp.mjs";

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
      // A guessed download URL (404 until 27 Oct): the download page. Permanent (308).
      { source: "/download", destination: "/beta", permanent: true },
      // Legacy admin path: a real redirect, so no page (and no inherited "index, follow") is ever served.
      { source: "/waitlist-admin", destination: "/waitlist", permanent: false },
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
          // Security C3: four directives enforced; the strict policy report-only until its reports are read.
          { key: "Content-Security-Policy", value: ENFORCED_CSP },
          {
            key: "Content-Security-Policy-Report-Only",
            value: reportOnlyCsp({ api: process.env.NEXT_PUBLIC_UNVIBE_API, supabase: process.env.NEXT_PUBLIC_SUPABASE_URL }),
          },
          { key: "Reporting-Endpoints", value: REPORTING_ENDPOINTS },
        ],
      },
      {
        // Link-preview cards are named for their content (a test checks name = sha256 prefix), so a
        // changed card always gets a new URL and the old one can be cached for good (Security OG-6).
        source: "/og/:file*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
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
        source: "/s/:path*",
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
        source: "/redeem",
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
