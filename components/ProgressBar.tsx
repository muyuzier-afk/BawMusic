'use client';

import { useRef, useCallback, useMemo, useState } from 'react';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

export function ProgressBar({ currentTime, duration, onSeek }: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);
  
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  
  const calcPercent = useCallback((clientX: number) => {
    if (!trackRef.current) return 0;

    const rect = trackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;

    const raw = (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, raw));
  }, []);

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!trackRef.current || duration === 0) return;

    const percent = calcPercent(e.clientX);
    onSeek(percent * duration);
  }, [calcPercent, duration, onSeek]);

  const updateDrag = useCallback((clientX: number) => {
    if (duration === 0) return;
    const percent = calcPercent(clientX);
    setDragPercent(percent);
    onSeek(percent * duration);
  }, [calcPercent, duration, onSeek]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (duration === 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    updateDrag(event.clientX);
  }, [duration, updateDrag]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    updateDrag(event.clientX);
  }, [isDragging, updateDrag]);

  const stopDragging = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
    setDragPercent(null);
  }, [isDragging]);

  const percent = useMemo(() => {
    if (dragPercent !== null) return dragPercent * 100;
    return duration > 0 ? (currentTime / duration) * 100 : 0;
  }, [dragPercent, duration, currentTime]);
  
  return (
    <div className="progress-bar">
      <div
        className={`progress-track ${isDragging ? 'dragging' : ''}`}
        ref={trackRef}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
      >
        <div className="progress-fill" style={{ width: `${percent}%` }} />
        <div className="progress-thumb" style={{ left: `${percent}%` }} />
      </div>
      <div className="progress-time">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
}
