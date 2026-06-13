import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BawMusic Router',
  description: 'BawMusic 智能入口 · 自动选择延迟最低的节点',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
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
