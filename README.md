# BawMusic

![BawMusic](./public/logo.png)

一个以歌词体验为核心的网页音乐播放器，支持双 API 源自动降级、网易云歌单导入、音乐库文件夹管理，可打包为 Android APK。

在线访问：[bawmusic.top](https://bawmusic.top)

## 功能

### 播放与歌词

- **歌词优先 UI**：当前句高亮、自动滚动居中、双语对照、逐字歌词
- **AMLL 流体背景**：基于 [applemusic-like-lyrics](https://github.com/amll-dev/applemusic-like-lyrics) 的 `BackgroundRender`，封面色驱动流体动画
- **Better Styles (Beta)**：一体化播放器面板，集成 Full AMLL 组件——封面呼吸缩放、进度条弹性动画、音量滑块
- **移动端全屏歌词**：点击封面进入沉浸式歌词阅读，支持横竖屏自适应
- **三种播放模式**：列表循环 / 随机播放 / 单曲循环
- **文件夹范围播放**：当当前曲属于某文件夹时，next/prev 严格在该文件夹顺序内循环

### 音乐库管理

- **搜索**：在线搜索、记忆最近关键词
- **网易云歌单导入**：链接或 ID，自动批量加载
- **音乐库文件夹**：自定义分组、拖拽排序、跨文件夹迁移
- **播放列表**：拖拽排序、批量选择删除、单曲分享（`?song=` 参数）

### 播放器引擎

- **双 API 源**（MAIN + BACKUP），请求失败自动降级，源选择持久化到 `localStorage`
- **码率选择**：standard / exhigh / lossless / hires / jymaster / sky / jyeffect
- **去重入队**：`playSong` / `addToPlaylist` / `playSongById` 三处按 ID 去重，避免重复条目
- **历史记录续播**：播放列表播完时自动从历史记录延续，删除歌曲时同步清理历史避免"秽土转生"
- **原生媒体控制**：Capacitor 桥接锁屏与通知栏控制

### 部署与打包

- 纯静态导出（`output: 'export'`），可部署到任何 CDN
- 同一份 Web 资产通过 Capacitor 8 打包为 Android APK

## 技术栈

| 层 | 选型 |
| --- | --- |
| Framework | Next.js 16 (App Router) |
| UI | React 19 + TypeScript 5 |
| 样式 | 原生 CSS + CSS Variables（无 UI 库） |
| 状态 | React Hooks + Jotai |
| 歌词/流体背景 | @applemusic-like-lyrics/react · react-full |
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

构建与检查：

```bash
npm run typecheck   # tsc --noEmit
npm run build       # 产出 out/，纯静态
npm run lint        # next lint
npm run format      # prettier --write .
```

其他脚本：`cap:sync` / `cap:add:android` / `cap:open:android`。

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
app/page.tsx                      唯一页面入口（'use client'），状态从 usePlayer 分发
hooks/
  usePlayer.ts                    播放器状态机：队列、当前曲、模式、码率、历史、播放范围
  useLibraryFolders.ts            音乐库文件夹：CRUD、排序、跨文件夹迁移
  useDeviceOrientation.ts         横竖屏监听
lib/
  api.ts                          双 API 源封装、网易云歌单解析、LRC 歌词解析
  amllLyric.ts                    AMLL 歌词数据格式转换
  nativeMediaControls.ts          Capacitor 原生媒体控制桥接
  download.ts                     下载逻辑
  cover.ts                        占位封面生成
  media.ts                        媒体 URL 归一化
components/
  BetterPlayer.tsx                Better Styles (Beta) 一体化面板（含 Full AMLL 组件）
  AmllLyrics.tsx                  AMLL 歌词播放器封装
  FluidBackground.tsx             流体背景容器
  LyricsPanel.tsx                 基础歌词面板
  PlaybackControls.tsx            播放控制按钮组
  ProgressBar.tsx                 基础进度条
  BetterPlaylistSheet.tsx         底部弹出播放列表（滑动删除、批量选择）
  LibraryView.tsx                 音乐库 + 文件夹视图
  Search.tsx / FullScreenSearch.tsx   搜索框与移动端全屏搜索
  Sidebar.tsx                     侧边栏
  DownloadMenu.tsx                下载菜单
  Icons.tsx                       图标集合
types/music.ts                    Song / MusicInfo / LyricLine / AudioQuality
android/                          Capacitor 生成的 Android 原生工程
scripts/
  patch-capacitor-java17.js       postinstall 钩子
  build-info.mjs                  构建信息注入
```

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
- [AMLL (Apple Music-like Lyrics)](https://github.com/amll-dev/applemusic-like-lyrics) — 流体背景、歌词组件与 Full AMLL 组件均基于此项目

## License

本项目基于 [GNU AGPL-3.0-or-later](./LICENSE) 协议开源。

因项目使用了 [@applemusic-like-lyrics/react](https://github.com/amll-dev/applemusic-like-lyrics)（AGPL-3.0-only，具有传染性），故整体协议采用 AGPL-3.0。这意味着：

- 任何人可以自由使用、修改、分发本项目，但衍生作品必须同样以 AGPL-3.0 协议开源
- 若以网络服务形式提供本程序（或修改版）的功能，也必须向用户提供完整源代码

**上游仓库：** [amll-dev/applemusic-like-lyrics](https://github.com/amll-dev/applemusic-like-lyrics) — 本项目的流体背景、歌词组件与 Full AMLL 组件均基于其实现。
