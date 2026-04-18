import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "音乐播放器",
  description: "极简音乐播放器",
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
