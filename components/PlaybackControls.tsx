'use client';

import { Song } from '@/types/music';
import { PlayIcon, PauseIcon, VolumeIcon, VolumeMuteIcon, ListIcon, ShuffleIcon, RepeatIcon } from './Icons';

type PlayMode = 'list' | 'shuffle' | 'single';

interface PlaybackControlsProps {
  isPlaying: boolean;
  playMode: PlayMode;
  volume: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onCyclePlayMode: () => void;
  onVolumeChange: (volume: number) => void;
}

export function PlaybackControls({
  isPlaying,
  playMode,
  volume,
  onTogglePlay,
  onNext,
  onPrev,
  onCyclePlayMode,
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" stroke="none" />
            <line x1="5" y1="19" x2="5" y2="5" strokeWidth="2" />
          </svg>
        </button>

        <button className="control-btn control-btn-main" onClick={onTogglePlay} aria-label={isPlaying ? '暂停' : '播放'}>
          {isPlaying ? <PauseIcon size={28} /> : <PlayIcon size={28} />}
        </button>

        <button className="control-btn" onClick={onNext} aria-label="下一首">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" stroke="none" />
            <line x1="19" y1="5" x2="19" y2="19" strokeWidth="2" />
          </svg>
        </button>

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
}

export function PlaylistDrawer({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onPlayAt
}: PlaylistDrawerProps) {
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
              className={`playlist-item ${index === currentIndex ? 'active' : ''}`}
              onClick={() => onPlayAt(index)}
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
          ))}
        </div>
      </div>
    </>
  );
}
