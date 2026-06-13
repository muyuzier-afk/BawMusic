# BawTV

极简 CCTV 直播 Web 播放器，零干扰、跨浏览器，点开即看。

## 功能

- 仅展示 CCTV 频道（CCTV-1HD ~ CCTV-17HD、CCTV-5+、CCTV-4K、CCTV-8K 等）
- 顶部分段切换 MAIN / BACKUP 两个数据源
- HLS.js 跨浏览器直播播放（Safari/iOS 用原生 HLS）
- 频道实时高亮当前播放，源切换自动重载
- 玻璃质感 + 纯黑背景，与 BawMusic 同款设计语言

## 技术栈

- Next.js 16 + React 19 + TypeScript 5
- HLS.js 跨浏览器 HLS
- 原生 CSS（CSS Variables + 玻璃质感）

## 数据源

- **MAIN**：`https://16409.kstore.vip/tv/ngzmods.json` → 内部 `lives[0].url` → TVBox 文本频道列表
- **BACKUP**：`http://82.156.243.185:36888/av3a/cctv5n.m3u8`（CCTV-5 单流）

## 本地开发

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 生产构建
npm run typecheck
```
