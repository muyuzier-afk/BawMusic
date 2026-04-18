'use client';

import { useEffect, useRef } from 'react';
import { LyricLine } from '@/types/music';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
  variant?: 'default' | 'desktop' | 'mobile';
}

export function LyricsPanel({ lyrics, currentTime, variant = 'default' }: LyricsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const active = activeRef.current;
      
      const containerRect = container.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      
      const scrollTop = active.offsetTop - containerRect.height / 2 + activeRect.height / 2;
      
      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth'
      });
    }
  }, [currentTime]);
  
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
        
        return (
          <div
            key={index}
            ref={isActive ? activeRef : null}
            className={`lyric-line ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''} ${isNear ? 'near' : ''} ${isFar ? 'far' : ''} ${positionClass}`}
          >
            <div className="lyric-line-main">{line.text}</div>
            {line.translation && (
              <div className="lyric-line-translation">{line.translation}</div>
            )}
          </div>
        );
      })}
      <div className="lyric-spacer" aria-hidden="true" />
    </div>
  );
}
