import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  allowedDevOrigins: ['https://*.monkeycode-ai.online'],
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'p1.music.126.net',
      },
      {
        protocol: 'https',
        hostname: 'm801.music.126.net',
      },
    ],
  },
};

export default nextConfig;
