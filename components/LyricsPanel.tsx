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

  // 计算当前活跃行索引（需在 hooks 之前，供 useEffect 依赖）
  let currentIndex = -1;
  if (lyrics.length > 0) {
    for (let i = lyrics.length - 1; i >= 0; i--) {
      if (lyrics[i].time <= currentTime) {
        currentIndex = i;
        break;
      }
    }
  }

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
    const duration = 600;
    const startTime = performance.now();
    // ease-in-out-quint，起步和收尾都柔和，避免 ease-out 前段过陡"一下子到位"
    const ease = (t: number) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2);
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

  // 立即居中（不缓动），用于翻译展开/收起过渡期间，配合 ResizeObserver 持续保持居中
  const snapToActive = useCallback(() => {
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
    container.scrollTop = target;
  }, []);

  useEffect(() => {
    scrollToActive();
  }, [currentTime, scrollToActive]);

  // 翻译切换或活跃行变化时，用 ResizeObserver 在高度过渡期间持续把活跃行钉在中央，
  // 避免 max-height 过渡进行中算出的居中位置不准导致歌词跳动
  useEffect(() => {
    if (!activeRef.current || !containerRef.current) return;
    snapToActive();
    const observer = new ResizeObserver(() => {
      snapToActive();
    });
    observer.observe(activeRef.current);
    return () => observer.disconnect();
  }, [snapToActive, showTranslation, currentIndex]);

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
