# BawMusic - 极简音乐播放器

基于 Next.js + React 构建的极简风格在线音乐播放器，调用网易云音乐 API 实现歌曲搜索与播放。

## 功能特性

- 实时搜索 - 输入即搜索，显示搜索建议
- 同步滚动歌词 - Apple Music 风格的歌词展示
- 莫奈模糊背景 - 根据专辑封面取色的毛玻璃效果
- 三端适配 - PC 侧边栏 / Pad 单列 / Mobile 全屏布局
- 极简 SVG 图标 - 无品牌强调，用户与音乐优先

## 技术栈

- **框架**: Next.js 16 + React 19
- **语言**: TypeScript
- **样式**: CSS Variables + 原生 CSS
- **API**: 网易云音乐 Freebase API

## API 接口

| 端点 | 说明 |
|------|------|
| `GET /163_search` | 搜索歌曲 |
| `GET /163_music` | 获取播放地址 |
| `GET /163_lyric` | 获取歌词 |

基础地址: `https://api.chksz.top/api`

## 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 搜索功能说明

1. 在搜索框输入歌曲名或歌手名
2. 输入后 300ms 自动触发搜索
3. 下拉列表显示最多 5 个搜索建议
4. 点击建议项即可播放该歌曲

## 项目结构

```
music-player/
├── app/
│   ├── page.tsx      # 主页面
│   ├── layout.tsx    # 布局
│   └── globals.css   # 全局样式
├── components/
│   ├── Icons.tsx           # SVG 图标
│   ├── ProgressBar.tsx     # 进度条
│   ├── LyricsPanel.tsx     # 歌词面板
│   ├── PlaybackControls.tsx # 播放控制
│   ├── Search.tsx          # 搜索组件
│   └── Sidebar.tsx         # 侧边栏
├── hooks/
│   └── usePlayer.ts   # 播放器状态管理
├── lib/
│   └── api.ts         # API 调用
└── types/
    └── music.ts       # 类型定义
```

## 已知问题

- 搜索功能在某些移动端浏览器可能需要多次点击
- 部分歌曲可能因版权问题无法播放
- 歌词获取取决于歌曲是否有对应翻译
