import type { Metadata } from "next";
import "./globals.css";
import "@applemusic-like-lyrics/react-full/style.css";

export const metadata: Metadata = {
  title: "BawMusic",
  description: "极简音乐播放器",
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon.ico',
    apple: '/favicon.ico'
  }
};

// 内联阻塞脚本：在 React 水合前同步读取 localStorage，
// 设置 body class 与全局变量，避免 Better Styles / Full AMLL 用户首屏闪现
const initScript = `(function(){try{var bs=localStorage.getItem('bawmusic:better-styles');var b=bs===null?true:bs==='1';var l=localStorage.getItem('bawmusic:liquid-flow')==='1';var fa=localStorage.getItem('bawmusic:full-amll')==='1';if(b)document.body.classList.add('better-styles');if(fa)document.body.classList.add('full-amll');window.__BAW_INIT__={betterStyles:b,liquidFlow:l,fullAmll:fa};}catch(e){window.__BAW_INIT__={betterStyles:true,liquidFlow:false,fullAmll:false};}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <script dangerouslySetInnerHTML={{ __html: initScript }} />
        {children}
      </body>
    </html>
  );
}
