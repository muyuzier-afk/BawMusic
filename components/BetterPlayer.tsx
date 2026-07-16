'use client';

import { useCallback, useEffect, useMemo, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Song, AudioQuality } from '@/types/music';
import type { LyricLine } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { AmllLyrics } from './AmllLyrics';
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  VolumeIcon,
  VolumeMuteIcon,
  ListIcon,
  ShuffleIcon,
  RepeatIcon,
  TranslateIcon,
} from './Icons';

type PlayMode = 'list' | 'shuffle' | 'single';

interface BetterPlayerProps {
  song: Song;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  audioQuality: AudioQuality;
  lyric: LyricLine[];
  showTranslation: boolean;
  hasTranslation: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onCyclePlayMode: () => void;
  onAudioQualityChange: (quality: AudioQuality) => void;
  onToggleTranslation: () => void;
  onOpenPlaylist: () => void;
  onDownload: (event: ReactMouseEvent<HTMLElement>) => void;
  showDownload: boolean;
  isLoading?: boolean;
}

/**
 * Better Styles 全屏播放界面：参考 Apple Music 视觉，大封面+居中信息+底部控件。
 * - 顶部下拉箭头收起为迷你播放器（fixed 浮在主内容之上）
 * - 封面/信息区点击切换为 AMLL 歌词视图
 */
export function BetterPlayer({
  song,
  isPlaying,
  currentTime,
  duration,
  volume,
  playMode,
  audioQuality,
  lyric,
  showTranslation,
  hasTranslation,
  onTogglePlay,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onCyclePlayMode,
  onAudioQualityChange,
  onToggleTranslation,
  onOpenPlaylist,
  onDownload,
  showDownload,
  isLoading = false,
}: BetterPlayerProps) {
  const [view, setView] = useState<'cover' | 'lyrics'>('cover');
  const [minimized, setMinimized] = useState(false);

  // 切换歌曲时重置为封面视图
  const songId = song?.id;
  useEffect(() => {
    setView('cover');
  }, [songId]);

  const toggleView = useCallback(() => {
    setView((prev) => (prev === 'cover' ? 'lyrics' : 'cover'));
  }, []);

  const toggleMinimize = useCallback(() => {
    setMinimized((prev) => !prev);
  }, []);

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const remainingTime = Math.max(0, duration - currentTime);
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 进度条拖拽
  const [isDragging, setIsDragging] = useState(false);
  const [dragPercent, setDragPercent] = useState<number | null>(null);

  const handleProgressPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (duration === 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      setIsDragging(true);
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setDragPercent(percent);
      onSeek(percent * duration);
    },
    [duration, onSeek],
  );

  const handleProgressPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      const target = event.currentTarget;
      const rect = target.getBoundingClientRect();
      const percent = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
      setDragPercent(percent);
      onSeek(percent * duration);
    },
    [duration, isDragging, onSeek],
  );

  const handleProgressPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setIsDragging(false);
      setDragPercent(null);
    },
    [isDragging],
  );

  const displayPercent = dragPercent !== null ? dragPercent * 100 : progressPercent;
  const isMuted = volume <= 0.02;

  // 播放模式图标
  const renderPlayModeIcon = () => {
    if (playMode === 'list') return <ListIcon size={16} />;
    if (playMode === 'shuffle') return <ShuffleIcon size={16} />;
    return (
      <span className="play-mode-single-icon" aria-hidden="true">
        <RepeatIcon size={16} />
        <span className="play-mode-single-badge">1</span>
      </span>
    );
  };

  const modeLabel = playMode === 'single' ? '单曲循环' : playMode === 'shuffle' ? '随机播放' : '列表播放';

  // 封面图源
  const coverUrl = useMemo(() => normalizeMediaUrl(song.picUrl) || PLACEHOLDER_COVER, [song.picUrl]);

  // 收起态：迷你播放器（固定在底部）
  if (minimized) {
    return (
      <div
        className="better-player-mini"
        onClick={toggleMinimize}
        role="button"
        tabIndex={0}
        aria-label="展开播放器"
      >
        <div className="better-player-mini-cover">
          <img
            src={coverUrl}
            alt={song.name}
            onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER_COVER) e.currentTarget.src = PLACEHOLDER_COVER; }}
          />
        </div>
        <div className="better-player-mini-info">
          <div className="better-player-mini-title">{song.name}</div>
          <div className="better-player-mini-artist">{song.artists}</div>
        </div>
        <div className="better-player-mini-controls">
          <button
            className="better-player-mini-btn"
            onClick={(e) => { e.stopPropagation(); onPrev(); }}
            aria-label="上一首"
            type="button"
          >
            <PrevIcon size={20} />
          </button>
          <button
            className="better-player-mini-btn better-player-mini-btn-main"
            onClick={(e) => { e.stopPropagation(); onTogglePlay(); }}
            aria-label={isPlaying ? '暂停' : '播放'}
            type="button"
          >
            {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
          </button>
          <button
            className="better-player-mini-btn"
            onClick={(e) => { e.stopPropagation(); onNext(); }}
            aria-label="下一首"
            type="button"
          >
            <NextIcon size={20} />
          </button>
        </div>
        <div
          className="better-player-mini-progress"
          style={{ width: `${displayPercent}%` }}
          aria-hidden="true"
        />
      </div>
    );
  }

  return (
    <div className="better-player">
      <div className="better-player-bg" aria-hidden="true" />

      <div className="better-player-topbar">
        <button
          className="better-player-chevron"
          onClick={toggleMinimize}
          aria-label="收起播放器"
          type="button"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      </div>

      <div className="better-player-content">
        {view === 'cover' ? (
          <>
            <div
              className="better-player-cover-wrap"
              onClick={toggleView}
              role="button"
              tabIndex={0}
              aria-label="查看歌词"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleView(); } }}
            >
              <img
                src={coverUrl}
                alt={song.name}
                className="better-player-cover"
                style={{ opacity: isLoading ? 0.3 : 1 }}
                onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER_COVER) e.currentTarget.src = PLACEHOLDER_COVER; }}
              />
              {isLoading && <div className="better-player-cover-loading" />}
            </div>

            <div className="better-player-info" onClick={toggleView} role="button" tabIndex={0} aria-label="查看歌词">
              <div className="better-player-title">{song.name}</div>
              <div className="better-player-artist">
                {song.artists}
                {song.album ? <span> — {song.album}</span> : null}
              </div>
            </div>
          </>
        ) : (
          <div className="better-player-lyrics" onClick={toggleView} role="button" tabIndex={0} aria-label="返回封面">
            <AmllLyrics
              lyrics={lyric}
              currentTime={currentTime}
              duration={duration}
              playing={isPlaying}
              showTranslation={showTranslation}
            />
          </div>
        )}
      </div>

      <div className="better-player-progress-wrap">
        <div
          className={`better-player-progress ${isDragging ? 'dragging' : ''}`}
          onPointerDown={handleProgressPointerDown}
          onPointerMove={handleProgressPointerMove}
          onPointerUp={handleProgressPointerUp}
          onPointerCancel={handleProgressPointerUp}
        >
          <div className="better-player-progress-fill" style={{ width: `${displayPercent}%` }} />
        </div>
        <div className="better-player-progress-time">
          <span>{formatTime(currentTime)}</span>
          <span>-{formatTime(remainingTime)}</span>
        </div>
      </div>

      <div className="better-player-controls">
        <button
          className="better-player-control-btn"
          onClick={onPrev}
          aria-label="上一首"
          type="button"
        >
          <PrevIcon size={36} />
        </button>

        <button
          className="better-player-control-btn better-player-play"
          onClick={onTogglePlay}
          aria-label={isPlaying ? '暂停' : '播放'}
          type="button"
        >
          {isPlaying ? <PauseIcon size={42} /> : <PlayIcon size={42} />}
        </button>

        <button
          className="better-player-control-btn"
          onClick={onNext}
          aria-label="下一首"
          type="button"
        >
          <NextIcon size={36} />
        </button>
      </div>

      <div className="better-player-extras">
        <button
          className="better-player-extras-btn"
          onClick={onCyclePlayMode}
          aria-label={`当前模式：${modeLabel}`}
          title={modeLabel}
          type="button"
        >
          {renderPlayModeIcon()}
        </button>

        {hasTranslation && (
          <button
            className={`better-player-extras-btn ${showTranslation ? 'active' : ''}`}
            onClick={onToggleTranslation}
            aria-label={showTranslation ? '隐藏翻译' : '显示翻译'}
            type="button"
          >
            <TranslateIcon size={16} />
          </button>
        )}

        <select
          className="better-player-quality-select"
          value={audioQuality}
          onChange={(e) => onAudioQualityChange(e.target.value as AudioQuality)}
          aria-label="音质切换"
        >
          <option value="standard">标准</option>
          <option value="exhigh">极高</option>
          <option value="lossless">无损</option>
          <option value="hires">Hi-Res</option>
          <option value="jymaster">超清母带</option>
          <option value="sky">天空音效</option>
          <option value="jyeffect">沉浸环绕声</option>
        </select>
      </div>

      <div className="better-player-volume">
        <button
          className="better-player-volume-icon-btn"
          onClick={() => onVolumeChange(isMuted ? 0.8 : 0)}
          aria-label={isMuted ? '取消静音' : '静音'}
          type="button"
        >
          {isMuted ? <VolumeMuteIcon size={18} /> : <VolumeIcon size={18} />}
        </button>
        <input
          className="better-player-volume-slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
          style={{ ['--volume-progress' as any]: `${Math.round(volume * 100)}%` }}
          aria-label="音量调节"
        />
        <span className="better-player-volume-icon-end" aria-hidden="true">
          <VolumeIcon size={18} />
        </span>
      </div>

      <div className="better-player-bottombar">
        <div className="better-player-bottombar-spacer" />
        <button
          className="better-player-bottombar-btn"
          onClick={onOpenPlaylist}
          aria-label="播放列表"
          type="button"
        >
          <ListIcon size={20} />
        </button>
      </div>
    </div>
  );
}
