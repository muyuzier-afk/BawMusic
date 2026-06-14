import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // 适配 ESA Pages 纯静态托管
  // 频道列表由 scripts/build-cctv-data.mjs 在 build 时生成到 public/data/，
  // 这里用静态导出，无 server runtime
  output: 'export',
  images: {
    unoptimized: true,
  },
  // 子目录里 BawTV 是 root；显式告诉 turbopack 避免和 BawMusic / MusicLanddingPage 混淆
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
