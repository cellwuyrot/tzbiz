import type { NextConfig } from "next";

const noIndexHeaders = [
  { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      { source: "/enter", headers: noIndexHeaders },
      { source: "/admin/:path*", headers: noIndexHeaders },
    ];
  },
};

export default nextConfig;
