import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  // 适配 ESA Pages：纯静态导出 + ER 边缘函数
  // - 前端用 output: 'export' 产出 out/，作为静态资源托管
  // - /api/cctv-channels 的实时数据由 functions/index.js ER 函数代理外部源
  // - dev 模式下 app/api/cctv-channels/route.ts 仍负责本地接口
  output: 'export',
  images: {
    unoptimized: true,
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
