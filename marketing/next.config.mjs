/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [{ source: "/install.sh", destination: "/api/install" }];
  },
};

export default nextConfig;
