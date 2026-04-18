'use client';

import { useEffect, useRef } from 'react';
import { LyricLine } from '@/types/music';

interface LyricsPanelProps {
  lyrics: LyricLine[];
  currentTime: number;
}

export function LyricsPanel({ lyrics, currentTime }: LyricsPanelProps) {
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
      <div className="lyrics-container" ref={containerRef}>
        <div className="lyric-line">暂无歌词</div>
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
    <div className="lyrics-container" ref={containerRef}>
      {lyrics.map((line, index) => {
        const isActive = index === currentIndex;
        const isPassed = index < currentIndex;
        
        return (
          <div
            key={index}
            ref={isActive ? activeRef : null}
            className={`lyric-line ${isActive ? 'active' : ''} ${isPassed ? 'passed' : ''}`}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
}
