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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
