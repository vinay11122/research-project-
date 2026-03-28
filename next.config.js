/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  async rewrites() {
    const apiTarget = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_BASE_URL;

    if (!apiTarget || apiTarget === "/api") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget.replace(/\/$/, "")}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
