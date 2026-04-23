'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { LyricLine } from '@/types/music';
import { TranslateIcon } from './Icons';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
  variant?: 'default' | 'desktop' | 'mobile';
}

export function LyricsPanel({ lyrics, currentTime, variant = 'default' }: LyricsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  const [showTranslation, setShowTranslation] = useState(true);
  const [isAnimating, setIsAnimating] = useState(false);

  const scrollToActive = useCallback(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const scrollTop = active.offsetTop - containerRect.height / 2 + activeRect.height / 2;
      container.scrollTo({ top: scrollTop, behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    scrollToActive();
  }, [currentTime, scrollToActive]);

  const handleToggleTranslation = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isAnimating) return;
    setIsAnimating(true);
    setShowTranslation(prev => !prev);
    // Wait for collapse animation then re-center active lyric
    setTimeout(() => {
      setIsAnimating(false);
      scrollToActive();
    }, 350);
  };

  const hasTranslation = lyrics.some(line => line.translation);

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
      <div className="lyrics-header">
        {hasTranslation && (
          <button
            className={`lyric-translate-toggle ${showTranslation ? 'active' : ''}`}
            onClick={handleToggleTranslation}
            type="button"
            aria-label={showTranslation ? '隐藏翻译' : '显示翻译'}
          >
            <TranslateIcon size={16} />
            <span className="lyric-translate-toggle-text">{showTranslation ? '翻译' : '原文'}</span>
          </button>
        )}
      </div>
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
