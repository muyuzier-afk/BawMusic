import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // API route 必须保留 Node 运行时，关闭静态导出
  allowedDevOrigins: ['*.monkeycode-ai.online'],
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
