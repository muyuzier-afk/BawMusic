'use client';

import { useEffect, useMemo, useRef } from 'react';
import dynamic from 'next/dynamic';
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core';
import type { LyricPlayerRef } from '@applemusic-like-lyrics/react';
import type { LyricLine } from '@/types/music';

// AMLL core 依赖 PIXI/DOM，仅在客户端运行；用 next/dynamic 关闭 SSR 以避免水合错乱。
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
  // 将项目内部行级 LyricLine（秒）映射成 AMLL 结构（毫秒）。
  // 当前 API 仅返回行级时间戳，故每行包装成单个 word 覆盖整行时长，
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
        isDuet: false
      };
    });
  }, [lyrics]);

  const playerRef = useRef<LyricPlayerRef>(null);

  // ---- rAF 插值驱动 currentTime，修复"往下滑又回来"的抖动 ----
  // 抖动根因：React state 的 currentTime 仅 ~4Hz 更新（audio.timeupdate），AMLL 弹簧在两次
  // setCurrentTime 之间外推播放位置，下个 4Hz 更新到来时弹簧过冲再回正。
  // 解法：用 rAF 60Hz 插值出平滑递增的毫秒时间直接调 corePlayer.setCurrentTime，
  // 不再通过 currentTime prop 传递（避免触发 React 组件的 useLayoutEffect）。
  // 插值基准：每次 props.currentTime 变化时记录 (props值, performance.now)，
  // 播放期间按经过的真实时长线性递增；检测大跳变（>1.5s）视为 seek，立即跳转。
  const baseTimeRef = useRef(currentTime);
  const basePerfRef = useRef(typeof performance !== 'undefined' ? performance.now() : 0);
  const lastDrivenRef = useRef(currentTime);
  const playingRef = useRef(isPlaying);
  playingRef.current = isPlaying;

  // props.currentTime 变化时刷新插值基准
  useEffect(() => {
    baseTimeRef.current = currentTime;
    basePerfRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
  }, [currentTime]);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const player = playerRef.current?.lyricPlayer;
      if (player) {
        let target = baseTimeRef.current;
        if (playingRef.current) {
          const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
          target = baseTimeRef.current + (now - basePerfRef.current) / 1000;
        }
        const targetMs = Math.max(0, Math.round(target * 1000));
        // 大跳变视为 seek（拖动进度条），立即跳转而非弹簧过渡
        const isSeek = Math.abs(target - lastDrivenRef.current) > 1.5;
        player.setCurrentTime(targetMs, isSeek);
        lastDrivenRef.current = target;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // 移动端歌词位置偏上一些（容器底部预留了控制栏，0.5 会让歌词视觉偏下）
  const alignPosition = variant === 'mobile' ? 0.4 : 0.5;

  return (
    <div className={`amll-container amll-container-${variant ?? 'default'}`}>
      <LyricPlayer
        ref={playerRef}
        lyricLines={adaptedLines}
        playing={isPlaying}
        enableSpring
        enableBlur
        enableScale
        alignAnchor="center"
        alignPosition={alignPosition}
        style={{ position: 'absolute', inset: 0 }}
      />
    </div>
  );
}
