'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { Song, AudioQuality } from '@/types/music';
import { PlayIcon, PauseIcon, VolumeIcon, VolumeMuteIcon, ListIcon, ShuffleIcon, RepeatIcon, PrevIcon, NextIcon, ShareIcon } from './Icons';

type PlayMode = 'list' | 'shuffle' | 'single';

const QUALITY_OPTIONS: Array<{ value: AudioQuality; label: string }> = [
  { value: 'standard', label: '标准音质' },
  { value: 'exhigh', label: '极高音质' },
  { value: 'lossless', label: '无损音质' },
  { value: 'hires', label: 'Hi-Res（高解析度）音质' },
  { value: 'jymaster', label: '超清母带' },
  { value: 'sky', label: '天空音效' },
  { value: 'jyeffect', label: '沉浸环绕声' }
];

interface PlaybackControlsProps {
  isPlaying: boolean;
  playMode: PlayMode;
  audioQuality: AudioQuality;
  volume: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onShare?: () => void;
  showShare?: boolean;
  onCyclePlayMode: () => void;
  onAudioQualityChange: (quality: AudioQuality) => void;
  onVolumeChange: (volume: number) => void;
}

export function PlaybackControls({
  isPlaying,
  playMode,
  audioQuality,
  volume,
  onTogglePlay,
  onNext,
  onPrev,
  onShare,
  showShare = false,
  onCyclePlayMode,
  onAudioQualityChange,
  onVolumeChange
}: PlaybackControlsProps) {
  const modeLabel = playMode === 'single' ? '单曲循环' : playMode === 'shuffle' ? '随机播放' : '列表播放';

  const renderPlayModeIcon = () => {
    if (playMode === 'list') {
      return <ListIcon size={16} />;
    }

    if (playMode === 'shuffle') {
      return <ShuffleIcon size={16} />;
    }

    return (
      <span className="play-mode-single-icon" aria-hidden="true">
        <RepeatIcon size={16} />
        <span className="play-mode-single-badge">1</span>
      </span>
    );
  };

  return (
    <div className="controls-wrap">
      <div className="controls">
        <button className="control-btn control-btn-mode" onClick={onCyclePlayMode} aria-label={`当前模式：${modeLabel}`}>
          {renderPlayModeIcon()}
        </button>

        <button className="control-btn" onClick={onPrev} aria-label="上一首">
          <PrevIcon size={24} />
        </button>

        <button className="control-btn control-btn-main" onClick={onTogglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>

        <button className="control-btn" onClick={onNext} aria-label="下一首">
          <NextIcon size={24} />
        </button>

        {showShare && onShare && (
          <button className="control-btn control-btn-share" onClick={onShare} aria-label="分享当前歌曲">
            <ShareIcon size={20} />
          </button>
        )}

        <label className="volume-control" aria-label="音量调节">
          <span className="volume-icon">{volume <= 0.02 ? <VolumeMuteIcon size={18} /> : <VolumeIcon size={18} />}</span>
          <input
            className="volume-slider"
            type="range"
            min={0}
            max={100}
            value={Math.round(volume * 100)}
            onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
            style={{ ['--volume-progress' as any]: `${Math.round(volume * 100)}%` }}
          />
        </label>

        <label className="quality-control" aria-label="音质切换">
          <span className="quality-label">音质</span>
          <select
            className="quality-select"
            value={audioQuality}
            onChange={(event) => onAudioQualityChange(event.target.value as AudioQuality)}
          >
            {QUALITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

interface PlaylistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Song[];
  currentIndex: number;
  onPlayAt: (index: number) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onRemoveItem: (index: number) => void;
}

export function PlaylistDrawer({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onPlayAt,
  onMoveItem,
  onRemoveItem
}: PlaylistDrawerProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [swipingIndex, setSwipingIndex] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const longPressTimerRef = useRef<number | null>(null);
  const gestureModeRef = useRef<'idle' | 'swipe' | 'drag'>('idle');
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const suppressClickRef = useRef(false);

  const clearPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearPressTimer();
    };
  }, [clearPressTimer]);

  const resetGesture = useCallback(() => {
    clearPressTimer();
    gestureModeRef.current = 'idle';
    setDraggingIndex(null);
    setSwipingIndex(null);
    setSwipeOffset(0);
  }, [clearPressTimer]);

  const startLongPress = useCallback((index: number) => {
    clearPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      gestureModeRef.current = 'drag';
      setDraggingIndex(index);
      setSwipingIndex(null);
      setSwipeOffset(0);
      suppressClickRef.current = true;
    }, 280);
  }, [clearPressTimer]);

  const handleTouchStart = useCallback((index: number, event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    gestureModeRef.current = 'idle';
    startLongPress(index);
  }, [startLongPress]);

  const handleTouchMove = useCallback((index: number, event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (gestureModeRef.current === 'drag') {
      event.preventDefault();
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = element?.closest<HTMLElement>('.playlist-item');
      const targetIndex = row?.dataset.index ? Number(row.dataset.index) : Number.NaN;

      if (!Number.isNaN(targetIndex) && targetIndex !== draggingIndex && targetIndex >= 0 && targetIndex < playlist.length && draggingIndex !== null) {
        onMoveItem(draggingIndex, targetIndex);
        setDraggingIndex(targetIndex);
      }
      return;
    }

    if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      clearPressTimer();
      return;
    }

    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      clearPressTimer();
      gestureModeRef.current = 'swipe';
      suppressClickRef.current = true;

      const nextOffset = Math.max(-132, Math.min(0, deltaX));
      setSwipingIndex(index);
      setSwipeOffset(nextOffset);
    }
  }, [clearPressTimer, draggingIndex, onMoveItem, playlist.length]);

  const handleTouchEnd = useCallback((index: number) => {
    clearPressTimer();

    if (gestureModeRef.current === 'swipe' && swipingIndex === index) {
      if (swipeOffset <= -88) {
        onRemoveItem(index);
      }
    }

    if (gestureModeRef.current === 'drag') {
      suppressClickRef.current = true;
    }

    resetGesture();
  }, [clearPressTimer, onRemoveItem, resetGesture, swipeOffset, swipingIndex]);

  const handleTouchCancel = useCallback(() => {
    resetGesture();
  }, [resetGesture]);

  const handleItemClick = useCallback((index: number, event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    onPlayAt(index);
  }, [onPlayAt]);

  return (
    <>
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            zIndex: 99
          }}
          onClick={onClose}
        />
      )}
      <div className={`playlist-drawer ${isOpen ? 'open' : ''}`}>
        <div className="playlist-handle" onClick={onClose} />
        <div className="playlist-header">
          <span className="playlist-title">播放列表</span>
          <span className="playlist-count">{playlist.length} 首歌曲</span>
        </div>
        <div className="playlist-items">
          {playlist.map((song, index) => (
            <div
              key={song.id}
              className={`playlist-item-row ${swipingIndex === index ? 'swiping' : ''} ${swipingIndex === index && swipeOffset <= -88 ? 'armed' : ''}`}
            >
              <div className="playlist-item-delete">
                删除
              </div>
              <div
                data-index={index}
                className={`playlist-item ${index === currentIndex ? 'active' : ''} ${draggingIndex === index ? 'dragging' : ''}`}
                style={swipingIndex === index ? { transform: `translateX(${swipeOffset}px)`, transition: 'none' } : undefined}
                onTouchStart={(event) => handleTouchStart(index, event)}
                onTouchMove={(event) => handleTouchMove(index, event)}
                onTouchEnd={() => handleTouchEnd(index)}
                onTouchCancel={handleTouchCancel}
                onClick={(event) => handleItemClick(index, event)}
              >
                <img
                  src={song.picUrl}
                  alt={song.name}
                  className="playlist-item-cover"
                />
                <div className="playlist-item-info">
                  <div className={`playlist-item-title ${index === currentIndex ? 'playlist-item-playing' : ''}`}>
                    {song.name}
                  </div>
                  <div className="playlist-item-artist">{song.artists}</div>
                </div>
                {index === currentIndex && isOpen && (
                  <div className="playlist-item-playing">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <rect x="6" y="4" width="4" height="16" rx="1" />
                      <rect x="14" y="4" width="4" height="16" rx="1" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
