'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import '@applemusic-like-lyrics/core/style.css';
import type { LyricLine as ProjectLyricLine } from '@/types/music';
import { toAmllLyricLines } from '@/lib/amllLyric';

// AMLL LyricPlayer 依赖 DOM + Web Animation API，关闭 SSR
const LyricPlayer = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.LyricPlayer),
  { ssr: false },
);

interface AmllLyricsProps {
  /** 项目内部歌词数组（已含可选逐字 words） */
  lyrics: ProjectLyricLine[];
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 是否正在播放 */
  playing: boolean;
  /** 歌曲总时长（秒），用于推算最后一行 endTime */
  duration: number;
  /** 是否显示翻译 */
  showTranslation?: boolean;
  /** 是否正在拖拽进度条 */
  isSeeking?: boolean;
}

/**
 * AMLL 风格歌词面板：Better Styles 开启时替代自研 LyricsPanel。
 * 支持逐字渐变、弹簧动画、缩放模糊，接近 Apple Music for iPad 的歌词效果。
 */
export function AmllLyrics({
  lyrics,
  currentTime,
  playing,
  duration,
  showTranslation = true,
  isSeeking = false,
}: AmllLyricsProps) {
  // 转换为 AMLL 格式（time: s→ms，words 透传，translation 关闭时清空）
  const amllLines = useMemo(() => {
    const lines = toAmllLyricLines(lyrics, duration);
    if (showTranslation) return lines;
    // 关闭翻译：复制并清空 translatedLyric（AMLL 不允许直接改原数组）
    return lines.map((l) => ({ ...l, translatedLyric: '' }));
  }, [lyrics, duration, showTranslation]);

  // AMLL 要求整数毫秒
  const currentTimeMs = Math.floor(currentTime * 1000);

  if (amllLines.length === 0) {
    return (
      <div className="amll-lyrics-empty">
        <div className="loading-spinner" aria-label="歌词加载中" />
      </div>
    );
  }

  return (
    <div className="amll-lyrics-wrapper">
      <LyricPlayer
        lyricLines={amllLines}
        currentTime={currentTimeMs}
        playing={playing}
        isSeeking={isSeeking}
        alignAnchor="center"
        alignPosition={0.5}
        enableSpring
        enableScale
        enableBlur
        wordFadeWidth={0.5}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
