# BawMusic

![BawMusic](./public/logo.png)

打开浏览器，搜一首歌，让它把歌词读完。

---

## 为什么又一个音乐播放器

网抑云、QQ 音乐、Apple Music 都有一个共同点：它们希望你注册、登录、开通会员、下载客户端。我们想要一个反过来的东西——打开页面，搜一首歌，歌词就在那里。

BawMusic 从一开始就不是为了「做音乐平台的轻量替代品」。它只关心一件事：在网页上，把听歌和读歌词这两件事做好。其他功能（下载、分享、源切换）都从这个出发点长出来。

## 我们在意的几件事

### 歌词优先

`LyricsPanel` 是整个项目花时间最久的组件：当前句放大、邻近句渐弱、自动滚动居中、双语对照时只显示真正的翻译行。移动端点击封面进入全屏，点击空白处退出。这些细节都不是某个 framework 默认给你的。

### 不打扰的源切换

`lib/api.ts` 内部维护 MAIN（[chksz.top](https://api.chksz.top/)）和 BACKUP（[t8.php](https://dev.ciallo.pp.ua/music/t8.php) + meting 混合）两套接口。任何一次请求在当前源失败时都会自动降级到另一个源，用户的体验是「什么都没发生」。源选择持久化到 `localStorage`，刷新后保持。

### 干净的播放队列

播放队列、当前曲目、模式、码率、播放历史都在 `hooks/usePlayer.ts` 一个地方。外部组件只通过返回值操作，状态变化统一走 reducer 风格的 setter。`playSong` / `addToPlaylist` / `playSongById` 三处都会按 ID 去重，所以连点同一首歌、切源后重播、批量导入歌单，都不会在队列里堆出重复条目。

### 歌单

粘贴网易云歌单链接或 ID，自动清空列表并批量导入。播放列表支持拖拽排序、勾选多条删除、单曲分享（`?song=` 参数）。这些功能不在首页暴露按钮，都收在抽屉里——主屏幕只留搜索和当前播放。

### 离线

同一份 Web 资产可以用 [Capacitor 8](https://capacitorjs.com/) 打包成 Android APK。`lib/nativeMediaControls.ts` 把播放状态桥接到锁屏和通知栏，`capacitor.config.ts` 把状态栏设成黑色透明，整套 UI 看起来就是一个原生 App。

## 选型

[Next.js 16](https://nextjs.org/) App Router 写客户端 SPA 体验比较自然，`output: 'export'` 可以直接托管到任何 CDN。Server Components / Server Actions 暂时用不到，但保留 App Router 是为了未来如果想做 SSR 可以无感切换。

[React 19](https://react.dev/) 写 hooks 节奏稳定，`useCallback` / `useMemo` 在 `usePlayer` 这种状态机里仍然是最直白的工具。`use` API 还没用到。

[TypeScript 5](https://www.typescriptlang.org/) 不解释。`types/music.ts` 里的 `Song` / `MusicInfo` / `LyricLine` / `AudioQuality` 四个类型是整个项目的脊椎。

原生 CSS + CSS Variables，**没有 UI 库**。整项目的「玻璃感」暗色主题就是几组 `rgba(255, 255, 255, 0.05)` 加 `backdrop-filter: blur(40px) saturate(180%)` 拼出来的。引入一个组件库反而要花更多精力把它藏起来。

[Capacitor 8](https://capacitorjs.com/) 比 React Native / Flutter 轻量。同一份 Web 资产同时跑在 Web 和 Android 上，没有「写两遍」的成本。

部署：阿里云 ESA Pages 跑主节点（`bawmusic.top`），腾讯云 EdgeOne 跑 `eo.bawmusic.top`。`muyuzier-afk/BawLanding` 那个智能路由页面负责 ping 两个节点、把用户导到更快的那一个。

## 自己跑起来

需要 Node `>=22.0.0 <23` 和 npm `>=10`。

```bash
git clone https://github.com/muyuzier-afk/BawMusic.git
cd BawMusic
npm install
npm run dev
```

`postinstall` 钩子会自动跑 `scripts/patch-capacitor-java17.js`，把 Capacitor 生成的 Java 源码从 `switch` 表达式 patch 成 `if/else` 链，避开 Java 17 以下编译失败。

构建：

```bash
npm run typecheck  # tsc --noEmit
npm run build      # 产出 out/，纯静态
```

完整脚本在 `package.json` 里：`lint` / `format` / `cap:sync` / `cap:open:android`。

## 打包成 Android

```bash
npm run build            # 静态产物
npx cap add android      # 首次
npx cap sync             # 同步 out/ 到 android/
npm run cap:open:android # Android Studio 打开
```

## 部署

仓库根目录的 [esa.jsonc](./esa.jsonc) 是阿里云 ESA Pages 部署配置：

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

`git push` 之后在 ESA 控制台关联仓库即可触发自动部署。腾讯云 EdgeOne 一侧是手动上传 `out/`，目前还没自动化。

## 仓库里有什么

- `app/` — 整个应用只有一个页面 `app/page.tsx`（`'use client'` 入口），所有状态从 `usePlayer` 一处分发
- `components/` — 按职责拆：`LyricsPanel` 歌词、`PlaybackControls` 控制条与播放列表抽屉、`Search` 搜索框、`Sidebar` 导航、`DownloadMenu` 码率选择下载菜单、`ProgressBar` 拖拽 seek
- `hooks/usePlayer.ts` — 播放器的状态机。播放队列、当前曲、模式、码率、播放历史都在这里
- `lib/api.ts` — 双 API 源封装、网易云歌单解析、LRC 歌词解析
- `lib/nativeMediaControls.ts` — Capacitor 原生媒体控制桥接
- `lib/download.ts` + `lib/cover.ts` + `lib/media.ts` — 下载 / 占位封面 / 媒体 URL 归一化
- `types/music.ts` — `Song` / `MusicInfo` / `LyricLine` / `AudioQuality`
- `android/` — Capacitor 生成的 Android 原生工程
- `scripts/patch-capacitor-java17.js` — postinstall 钩子，patch Capacitor 生成的 Java 17+ 语法

## 还没做但想做的

桌面歌词模式、JSON 歌单本地导入导出、PWA 离线缓存（service worker）、iOS 打包（Capacitor 已经支持，就差一个开发者账号）。这些都列在 issue 里，等有空的时候挑一个做。

## 致谢

- [chksz.top](https://api.chksz.top/) 提供 MAIN 源接口
- [t8.php](https://dev.ciallo.pp.ua/music/t8.php) 和 meting 维护者提供 BACKUP 源
- [Linux.do](https://linux.do/) 社区的反馈
- 所有 fork / star / 提 issue 的人

---

[muyuzier-afk](https://github.com/muyuzier-afk) · 灵感来自 iPod 时代的播放器、Apple Music 的歌词视觉、QQ 音乐早期那个还在好好做产品的版本。
