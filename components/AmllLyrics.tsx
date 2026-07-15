'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core';
import type { LyricLine } from '@/types/music';

// AMLL core 依赖 PIXI/DOM，仅在客户端运行；用 next/dynamic 关闭 SSR 以避免水合错乱。
const LyricPlayer = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.LyricPlayer),
  { ssr: false }
);

/**
 * 将项目内部的行级 LyricLine（秒）映射成 AMLL 所需的结构（毫秒）。
 * 当前 API 仅返回行级时间戳，故每行包装成单个 word 覆盖整行时长，
 * AMLL 会退化为整行高亮（仍保留 Apple Music 风格的滚动/缩放/模糊效果）。
 */
function adaptLyrics(lines: LyricLine[]): AmllLyricLine[] {
  if (lines.length === 0) return [];
  const adapted: AmllLyricLine[] = lines.map((line, i) => {
    const startTime = Math.round(line.time * 1000);
    // 末行无下一行可参考，给一个保守的兜底时长（4s），避免 AMLL 无法计算 endTime。
    const nextStart = i + 1 < lines.length ? Math.round(lines[i + 1].time * 1000) : startTime + 4000;
    const endTime = Math.max(nextStart, startTime + 1);
    return {
      words: [{ startTime, endTime, word: line.text }],
      translatedLyric: line.translation ?? '',
      romanLyric: '',
      startTime,
      endTime,
      isBG: false,
      isDuet: false
    };
  });
  return adapted;
}

interface AmllLyricsProps {
  lyrics: LyricLine[];
  currentTime: number; // 秒
  variant?: 'default' | 'desktop' | 'mobile';
}

export function AmllLyrics({ lyrics, currentTime, variant }: AmllLyricsProps) {
  const adaptedLines = useMemo(() => adaptLyrics(lyrics), [lyrics]);
  // AMLL 的 currentTime 单位为毫秒且必须是整数。
  const currentTimeMs = Math.max(0, Math.round(currentTime * 1000));

  return (
    <div className={`amll-container amll-container-${variant ?? 'default'}`}>
      <LyricPlayer
        lyricLines={adaptedLines}
        currentTime={currentTimeMs}
        playing
        enableSpring
        enableBlur
        enableScale
        alignAnchor="center"
        alignPosition={0.5}
      />
    </div>
  );
}
