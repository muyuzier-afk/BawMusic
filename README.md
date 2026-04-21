![BawMusic Logo](https://img.cdn1.vip/i/69e3746b6a82a_1776514155.png)

BawMusic是一个以播放体验为核心的在线音乐播放器，强调即时搜索、顺滑切歌与沉浸式歌词阅读。

## 亮点功能

- 即搜即播：输入歌曲/歌手关键字，快速返回候选并一键开播
- Apple Music 风格歌词：当前句高亮放大、邻近句渐弱、滚动居中聚焦
- 多端一致体验：
  - PC/Pad 右侧常驻歌词面板
  - Mobile 点击封面进入全屏歌词
- 完整播放控制：上一首、下一首、播放/暂停、音量滑杆动画
- 三种播放模式：列表播放、随机播放、单曲循环，支持循环切换
- 历史续播策略：当前搜索队列播完后，自动从历史记录衔接并提示
- 本地记忆：保存播放记录、音量、播放模式

## Speaccial Thanks：

https://Linux.do/
https://api.chksz.top/

## 项目信息

- 作者：Muyuzier-AFK
- 仓库地址：https://github.com/muyuzier-afk/BawMusic

## 技术栈

- Next.js 16
- React 19
- TypeScript
- CSS Variables + 原生 CSS 动画

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 生产构建
npm run build

# 生产启动
npm run start
```

## 使用说明

1. 在顶部搜索框输入关键字选择歌曲
2. 在播放区使用播放控制与模式切换
3. 移动端点击封面查看全屏歌词
4. 点击“项目详情”按钮查看技术栈与仓库信息

## 目录结构

```text
music-player/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── Icons.tsx
│   ├── LyricsPanel.tsx
│   ├── PlaybackControls.tsx
│   ├── ProgressBar.tsx
│   ├── Search.tsx
│   └── Sidebar.tsx
├── hooks/
│   └── usePlayer.ts
├── lib/
│   └── api.ts
├── public/
│   └── logo.png
└── types/
    └── music.ts
```
