/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // This deployment is the API (api.unvibe.site). The early "Uncode" dashboard pages it still
  // contains are retired: send people to the real site. /activate, /plan, /invite and /api stay.
  async redirects() {
    const site = 'https://unvibe.site';
    return [
      { source: '/', destination: site, permanent: false },
      { source: '/login', destination: site, permanent: false },
      { source: '/signup', destination: `${site}/beta`, permanent: false },
      { source: '/history', destination: site, permanent: false },
      { source: '/projects', destination: site, permanent: false },
      { source: '/profile', destination: site, permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
