'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core';
import type { LyricLine } from '@/types/music';

// AMLL core 依赖 PIXI/DOM，仅客户端运行；关闭 SSR 避免水合错乱。
// 完全交由 AMLL LyricPlayer 自身机制驱动（currentTime prop + 内部 rAF 弹簧），
// 不再手写 rAF 干扰其弹簧推进。
const LyricPlayer = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.LyricPlayer),
  { ssr: false }
);

interface AmllLyricsProps {
  lyrics: LyricLine[];
  currentTime: number; // 秒
  isPlaying: boolean;
  variant?: 'default' | 'desktop' | 'mobile';
}

export function AmllLyrics({ lyrics, currentTime, isPlaying, variant }: AmllLyricsProps) {
  // 将项目行级 LyricLine（秒）映射为 AMLL 结构（毫秒）。
  // 当前 API 仅返回行级时间戳，每行包装为单个 word 覆盖整行时长，
  // AMLL 仍保留 Apple Music 风格的滚动/缩放/模糊效果。
  const adaptedLines = useMemo<AmllLyricLine[]>(() => {
    if (lyrics.length === 0) return [];
    return lyrics.map((line, i) => {
      const startTime = Math.round(line.time * 1000);
      const nextStart = i + 1 < lyrics.length ? Math.round(lyrics[i + 1].time * 1000) : startTime + 4000;
      const endTime = Math.max(nextStart, startTime + 1);
      return {
        words: [{ startTime, endTime, word: line.text }],
        translatedLyric: line.translation ?? '',
        romanLyric: '',
        startTime,
        endTime,
        isBG: false,
        isDuet: false,
      };
    });
  }, [lyrics]);

  // AMLL currentTime 单位为毫秒。
  const currentTimeMs = Math.max(0, Math.round(currentTime * 1000));
  // 移动端容器底部预留了控制栏，0.5 会让歌词视觉偏下，调至 0.4。
  const alignPosition = variant === 'mobile' ? 0.4 : 0.5;

  return (
    <div className={`amll-container amll-container-${variant ?? 'default'}`}>
      <LyricPlayer
        lyricLines={adaptedLines}
        currentTime={currentTimeMs}
        playing={isPlaying}
        enableSpring
        enableBlur
        enableScale
        alignAnchor="center"
        alignPosition={alignPosition}
        // 过阻尼弹簧消除行切换过冲/回弹（“往下滑又回来”抖动）：
        // 临界阻尼 = 2*sqrt(stiffness*mass) = 2*sqrt(300) ≈ 34.6，
        // damping=40 > 临界值，无震荡平滑收敛。
        linePosYSpringParams={{ mass: 1, stiffness: 300, damping: 40 }}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
