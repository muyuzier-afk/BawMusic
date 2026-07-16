import type { Metadata } from "next";
import "./globals.css";

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
// 设置 body class 与全局变量，避免 Better Styles 用户首屏闪现 Old UI
const initScript = `(function(){try{var b=localStorage.getItem('bawmusic:better-styles')==='1';var l=localStorage.getItem('bawmusic:liquid-flow')==='1';if(b)document.body.classList.add('better-styles');window.__BAW_INIT__={betterStyles:b,liquidFlow:l};}catch(e){window.__BAW_INIT__={betterStyles:false,liquidFlow:false};}})();`;

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
