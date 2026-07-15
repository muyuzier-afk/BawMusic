'use client';

import { useCallback, useEffect, useRef } from 'react';
import { LyricLine } from '@/types/music';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
  variant?: 'default' | 'desktop' | 'mobile';
  showTranslation?: boolean;
}

export function LyricsPanel({ lyrics, currentTime, variant = 'default', showTranslation = true }: LyricsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  // 自定义缓动滚动，避免原生 smooth 在快速切歌时卡顿/打断
  const scrollToActive = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (!activeRef.current || !containerRef.current) return;
    const container = containerRef.current;
    const active = activeRef.current;
    const containerRect = container.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const target = active.offsetTop - containerRect.height / 2 + activeRect.height / 2;
    const start = container.scrollTop;
    const distance = target - start;
    if (Math.abs(distance) < 1) return;
    const duration = 460;
    const startTime = performance.now();
    // ease-out-quart，快速接近目标后缓缓停下
    const ease = (t: number) => 1 - Math.pow(1 - t, 4);
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      container.scrollTop = start + distance * ease(progress);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    scrollToActive();
  }, [currentTime, scrollToActive]);

  // 翻译显隐切换后，行高变化，需要重新居中当前行
  useEffect(() => {
    scrollToActive();
  }, [showTranslation, scrollToActive]);

  useEffect(() => () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
  }, []);

  if (lyrics.length === 0) {
    return (
      <div className={`lyrics-container lyrics-container-${variant}`} ref={containerRef}>
        <div className="lyric-spacer" aria-hidden="true" />
        <div className="lyric-line">暂无歌词</div>
        <div className="lyric-spacer" aria-hidden="true" />
      </div>
    );
  }

  let currentIndex = -1;
  for (let i = lyrics.length - 1; i >= 0; i--) {
    if (lyrics[i].time <= currentTime) {
      currentIndex = i;
      break;
    }
  }

  return (
    <div className={`lyrics-container lyrics-container-${variant}`} ref={containerRef}>
      <div className="lyric-spacer" aria-hidden="true" />
      {lyrics.map((line, index) => {
        const isActive = index === currentIndex;
        const isPassed = index < currentIndex;
        const relativeIndex = currentIndex === -1 ? 0 : index - currentIndex;
        const distance = currentIndex === -1 ? 99 : Math.abs(index - currentIndex);
        const isNear = distance === 1;
        const isFar = distance >= 2;
        const positionClass = relativeIndex < 0 ? 'before' : relativeIndex > 0 ? 'after' : '';
        const isBlurred = !isActive && distance >= 1;

        return (
          <div
            key={index}
            ref={isActive ? activeRef : null}
            className={`lyric-line ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''} ${isNear ? 'near' : ''} ${isFar ? 'far' : ''} ${positionClass} ${isBlurred ? 'blurred' : ''}`}
          >
            <div className="lyric-line-main">{line.text}</div>
            {line.translation && (
              <div className={`lyric-line-translation ${showTranslation ? 'show' : 'hide'}`}>{line.translation}</div>
            )}
          </div>
        );
      })}
      <div className="lyric-spacer" aria-hidden="true" />
    </div>
  );
}
