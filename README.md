# BawMusic

![BawMusic](./public/logo.png)

一个网页音乐播放器，专注歌词阅读体验，支持双 API 源自动降级，可打包为 Android APK。

在线访问：[bawmusic.top](https://bawmusic.top) · 备用节点：[eo.bawmusic.top](https://eo.bawmusic.top)

## 功能

- 歌词优先的 UI：当前句高亮、自动滚动居中、双语对照、移动端点击封面全屏阅读
- 双 API 源（MAIN + BACKUP），请求失败时自动降级，源选择持久化到 `localStorage`
- 网易云歌单导入（链接或 ID），自动清空并批量加载
- 码率选择：standard / exhigh / lossless / hires / jymaster / sky / jyeffect
- 播放列表：拖拽排序、批量删除、单曲分享（`?song=` 参数）
- 同一份 Web 资产通过 Capacitor 8 打包为 Android，锁屏和通知栏原生媒体控制
- 纯静态导出（`output: 'export'`），可部署到任何 CDN

## 技术栈

| 层 | 选型 |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript 5 |
| 样式 | 原生 CSS + CSS Variables（无 UI 库） |
| 原生打包 | Capacitor 8（Android） |
| 部署 | 阿里云 ESA Pages + 腾讯云 EdgeOne（经 [BawLanding](https://github.com/muyuzier-afk/BawLanding) 智能路由） |

## 本地运行

需要 Node `>=22.0.0 <23` 和 npm `>=10`。

```bash
git clone https://github.com/muyuzier-afk/BawMusic.git
cd BawMusic
npm install
npm run dev
```

`postinstall` 钩子自动跑 `scripts/patch-capacitor-java17.js`，把 Capacitor 生成的 Java 源码从 `switch` 表达式改写为 `if/else` 链，兼容 Java 17 以下。

构建：

```bash
npm run typecheck   # tsc --noEmit
npm run build       # 产出 out/，纯静态
```

其他脚本：`lint` / `format` / `cap:sync` / `cap:add:android` / `cap:open:android`。

## 打包 Android

```bash
npm run build             # 静态产物
npx cap add android       # 首次
npx cap sync              # 同步 out/ 到 android/
npm run cap:open:android  # Android Studio 打开
```

## 部署

仓库根目录的 `esa.jsonc` 是阿里云 ESA Pages 配置：

```jsonc
{
  "$schema": "https://help.aliyun.com/esa_docs/schema.json#",
  "name": "baw-music",
  "installCommand": "npm install",
  "buildCommand": "npm run build",
  "assets": {
    "directory": "./out",
    "notFoundStrategy": "singlePageApplication"
  }
}
```

`git push` 后在 ESA 控制台关联仓库即触发自动部署。EdgeOne 一侧为手动上传 `out/`，暂未自动化。

## 项目结构

```
app/page.tsx                   唯一页面入口（'use client'），所有状态从 usePlayer 分发
hooks/usePlayer.ts             播放器状态机：队列、当前曲、模式、码率、播放历史
lib/api.ts                     双 API 源封装、网易云歌单解析、LRC 歌词解析
lib/nativeMediaControls.ts     Capacitor 原生媒体控制桥接
lib/download.ts                下载逻辑
lib/cover.ts                   占位封面生成
lib/media.ts                   媒体 URL 归一化
components/                    LyricsPanel / PlaybackControls / Search / Sidebar / DownloadMenu / ProgressBar
types/music.ts                 Song / MusicInfo / LyricLine / AudioQuality
android/                       Capacitor 生成的 Android 原生工程
scripts/patch-capacitor-java17.js   postinstall 钩子
```

`usePlayer` 中 `playSong` / `addToPlaylist` / `playSongById` 三处按 ID 去重，连点同一首、切源后重播、批量导入歌单时不会在队列里堆出重复条目。

## API 源

| 源 | 提供方 | 说明 |
| --- | --- | --- |
| MAIN | [chksz.top](https://api.chksz.top/) | 默认源，接口稳定 |
| BACKUP | [t8.php](https://dev.ciallo.pp.ua/music/t8.php) + meting | MAIN 失败时自动降级 |

`lib/api.ts` 内的 `searchSongs` / `getMusicInfo` / `getLyric` / `fetchPlaylist` 都先按当前源请求，失败后尝试另一个源，源选择存到 `localStorage` key `bawmusic.apiSource`。

## 致谢

- [chksz.top](https://api.chksz.top/) — MAIN API 源
- [t8.php](https://dev.ciallo.pp.ua/music/t8.php) 和 meting — BACKUP API 源
- [Linux.do](https://linux.do/) 社区的反馈
- [AMLL (Apple Music-like Lyrics)](https://github.com/amll-dev/applemusic-like-lyrics) — Apple Music 风格歌词渲染组件，DevMenu 中开启“AMLL Styles”后使用（基于 `@applemusic-like-lyrics/react`）

## License

MIT
