'use client';

import dynamic from 'next/dynamic';

// AMLL 流体背景基于 PIXI/DOM，仅客户端运行；关闭 SSR 避免水合错乱。
// 仅复用 AMLL 的 BackgroundRender 组件（动态流体背景），不引入其歌词组件。
const BackgroundRender = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.BackgroundRender),
  { ssr: false }
);

interface FluidBackgroundProps {
  /** 专辑封面 URL */
  album: string;
  /** 是否正在播放（影响背景流动速度感） */
  playing: boolean;
}

/**
 * 流体背景层：基于 AMLL 的 BackgroundRender，根据专辑封面生成
 * Apple Music 风格的动态流体渐变背景。作为整页背景层使用。
 */
export function FluidBackground({ album, playing }: FluidBackgroundProps) {
  return (
    <BackgroundRender
      album={album}
      playing={playing}
      hasLyric
      style={{ position: 'absolute', inset: 0 }}
    />
  );
}
