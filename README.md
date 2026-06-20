# BawMusic

<div align="center">

![BawMusic](./public/logo.png)

**极简、沉浸、即开即用的在线音乐播放器**

[在线体验](https://bawmusic.top) · [仓库主页](https://github.com/muyuzier-afk/BawMusic) · [报告问题](https://github.com/muyuzier-afk/BawMusic/issues)

</div>

---

## 关于

BawMusic 是一个以**播放体验**为核心的 Web 音乐播放器：搜索、播放、歌词阅读三件事做到极致，没有多余的弹窗和入口。Web 端是主阵地，同时通过 Capacitor 打包成 Android App 离线可用，部署在阿里云 ESA Pages 边缘节点。

> 部署节点：`bawmusic.top`（阿里云 ESA CDN） / `eo.bawmusic.top`（腾讯云 EdgeOne CDN）

## 核心特性

### 搜索与播放
- **即搜即播**：顶部搜索框输入关键字，候选即时返回，键盘 / 鼠标点击即可开播
- **自动去重**：连续点击同一首歌 / 切源后重播 / 歌单批量导入，都会按歌曲 ID 去重，不会在队列里堆出重复条目
- **历史续播**：搜索队列播完后，自动从历史记录衔接下一首
- **三种播放模式**：列表循环 / 随机播放 / 单曲循环，一键循环切换
- **七档码率**：标准 / 极高 / 无损 / Hi-Res / 超清母带 / 天空音效 / 沉浸环绕声，按网络状况灵活选

### 歌词体验
- **Apple Music 风格**：当前句高亮放大、邻近句渐弱、自动滚动居中聚焦
- **双语翻译**：源歌词 + 翻译逐行对齐显示，无翻译时自动隐藏
- **响应式布局**：
  - PC / 平板：右侧常驻歌词面板，与封面区左右分栏
  - 移动端：点击封面进入全屏歌词，点空白处退出

### API 源管理
- **双源热切换**：MAIN（[chksz.top](https://api.chksz.top/)）+ BACKUP（t8.php + meting 混合）
- **自动降级**：当前源失败时自动尝试另一个源，整个过程对用户无感
- **持久化偏好**：源选择写入 `localStorage`，刷新后保持
- **透明可观察**：控制台输出降级日志，便于排查

### 歌单
- **网易云歌单导入**：粘贴歌单链接或 ID，自动清空当前列表并批量导入
- **拖拽排序**：播放列表内可拖拽调整顺序
- **多选删除**：勾选多条一次性移除
- **分享单曲**：复制带 `?song=` 参数的链接，对方打开直接定位到该首

### 离线与原生
- **Capacitor Android 打包**：同一份 Web 资产，输出 APK
- **原生媒体控制**：锁屏 / 通知栏显示播放状态、控制上下首
- **状态栏沉浸**：黑色透明状态栏 + 黑色背景，与暗色 UI 融为一体
- **多码率下载**：在播放页点击下载按钮，可选目标码率

## 技术栈

| 类别 | 选型 |
| --- | --- |
| 框架 | [Next.js 16](https://nextjs.org/) (App Router) |
| UI | [React 19](https://react.dev/) |
| 语言 | [TypeScript 5](https://www.typescriptlang.org/) |
| 样式 | CSS Variables + 原生 CSS 动画（无 UI 库） |
| 打包 | [Capacitor 8](https://capacitorjs.com/) → Android APK |
| 部署 | 阿里云 ESA Pages（`output: 'export'` 纯静态托管） |

## 快速开始

### 环境要求
- Node.js `>=22.0.0 <23`
- npm `>=10`

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/muyuzier-afk/BawMusic.git
cd BawMusic

# 安装依赖（postinstall 会自动 patch Capacitor 适配 Java 17）
npm install

# 启动开发服务器（默认 http://localhost:3000）
npm run dev
```

### 生产构建

```bash
# 类型检查
npm run typecheck

# 静态构建（产物在 out/ 目录）
npm run build
```

### 脚本一览

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | 启动开发服务器 |
| `npm run build` | 生产构建（静态导出到 `out/`） |
| `npm run start` | 启动生产服务（仅在未 export 模式下） |
| `npm run typecheck` | TypeScript 类型检查 |
| `npm run lint` | ESLint |
| `npm run format` | Prettier 格式化 |
| `npm run cap:sync` | 构建 + 同步到 Capacitor 平台 |
| `npm run cap:open:android` | 用 Android Studio 打开原生工程 |

## 打包为 Android App

```bash
# 1) 构建 Web 资产
npm run build

# 2) 添加 Android 平台（首次）
npx cap add android

# 3) 同步资产到原生工程
npx cap sync

# 4) 打开 Android Studio 编译 APK
npm run cap:open:android
```

> `postinstall` 钩子会自动执行 `scripts/patch-capacitor-java17.js`，把 Capacitor 生成的部分 Java 源码从 `switch` 表达式语法 patch 为 `if/else` 链，避免在 Java 17 以下编译失败。

## 部署

仓库根目录的 [esa.jsonc](./esa.jsonc) 是阿里云 ESA Pages 的部署配置（已用 [BawMusic 部署示例](https://github.com/muyuzier-afk/BawMusic/blob/main/esa.jsonc) 形式）：

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

把仓库 `git push` 到 GitHub 后，在 ESA 控制台关联仓库即可触发自动部署。

## 项目结构

```text
BawMusic/
├── app/                       # Next.js App Router 入口
│   ├── layout.tsx             # 全局 layout
│   ├── page.tsx               # 主页面（搜索 / 播放 / 歌单 / 导入）
│   └── globals.css            # 全局样式 + 主题变量
├── components/                # UI 组件
│   ├── Icons.tsx              # 自绘 SVG 图标
│   ├── LyricsPanel.tsx        # 歌词面板（桌面 + 移动变体）
│   ├── PlaybackControls.tsx   # 播放控制条 + 播放列表抽屉
│   ├── ProgressBar.tsx        # 进度条 + 拖拽 seek
│   ├── Search.tsx             # 搜索框 + 候选下拉
│   ├── Sidebar.tsx            # 侧边栏导航 + 源切换
│   └── DownloadMenu.tsx       # 码率选择下载菜单
├── hooks/
│   └── usePlayer.ts           # 播放器状态机（播放 / 队列 / 歌词 / 持久化）
├── lib/
│   ├── api.ts                 # 双 API 源封装 + 自动降级 + 歌词解析
│   ├── cover.ts               # 占位封面
│   ├── download.ts            # 多码率下载
│   ├── media.ts               # 媒体 URL 归一化
│   └── nativeMediaControls.ts # Capacitor 原生媒体控制桥接
├── types/
│   └── music.ts               # Song / MusicInfo / LyricData 等类型
├── public/                    # 静态资源（logo.png / icons）
├── scripts/
│   └── patch-capacitor-java17.js
├── android/                   # Capacitor Android 原生工程
├── capacitor.config.ts        # Capacitor 配置
├── next.config.ts             # Next.js 配置（output: 'export'）
├── esa.jsonc                  # ESA Pages 部署配置
└── package.json
```

## 数据来源

- [chksz.top](https://api.chksz.top/) — MAIN 源，网易云接口聚合
- [Linux.do](https://linux.do/) — 社区反馈与 PR
- 感谢所有上游接口提供方

## 路线图

- [ ] 本地 JSON 歌单导入 / 导出
- [ ] 桌面歌词模式
- [ ] PWA 离线缓存（service worker）
- [ ] iOS 打包（Capacitor 已就绪，等账号）

## 致谢

- [Linux.do](https://linux.do/) 社区
- [chksz.top](https://api.chksz.top/) 提供的 API 服务
- [t8.php](https://dev.ciallo.pp.ua/music/t8.php) 与 meting 维护者

## 许可

本项目仅供学习与个人使用，请勿用于商业用途。
所有音频版权归原作者及平台所有。

---

作者：[muyuzier-afk](https://github.com/muyuzier-afk) · 仓库：[muyuzier-afk/BawMusic](https://github.com/muyuzier-afk/BawMusic)
