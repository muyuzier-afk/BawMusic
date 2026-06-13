# BawMusic Router

BawMusic 智能入口落地页：自动 ping `bawmusic.top` 与 `eo.bawmusic.top`，选延迟最低的节点跳转。

## 工作流程

1. 页面加载，并行 ping 两个 BawMusic 入口（每节点 2 次取最小延迟）
2. 测速完成后挑出最优节点
3. 倒计时 2.5 秒后 `window.location` 跳到该节点
4. 用户可随时取消跳转 / 重新测速 / 手动选择入口
5. 跳转时保留原 URL 的 path / query / hash

## 技术栈

- Next.js 16 + React 19 + TypeScript（与 BawMusic / BawTV 一致）
- `output: 'export'` 纯静态导出
- 原生 CSS（与 BawMusic / BawTV 同款设计语言）

## 本地开发

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # 产出 out/
npm run typecheck
```

## 部署

`out/` 目录可直接扔到任何静态托管：

- **GitHub Pages**：`gh-pages` 分支
- **Vercel / Netlify / CloudFlare Pages**：连 git 自动 build
- **阿里云 ESA**：参考 BawMusic 的 `esa.jsonc` 模式
