'use client';

import { Song } from '@/types/music';
import { PlayIcon, PauseIcon } from './Icons';

interface PlaybackControlsProps {
  isPlaying: boolean;
  isShuffle: boolean;
  isRepeat: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
}

export function PlaybackControls({
  isPlaying,
  isShuffle,
  isRepeat,
  onTogglePlay,
  onNext,
  onPrev,
  onToggleShuffle,
  onToggleRepeat
}: PlaybackControlsProps) {
  return (
    <>
      <div className="controls">
        <button
          className={`control-btn ${isShuffle ? 'active' : ''}`}
          onClick={onToggleShuffle}
          aria-label="随机播放"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 3 21 3 21 8" />
            <line x1="4" y1="20" x2="21" y2="3" />
            <polyline points="21 16 21 21 16 21" />
            <line x1="15" y1="15" x2="21" y2="21" />
            <line x1="4" y1="4" x2="9" y2="9" />
          </svg>
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
        
        <button
          className={`control-btn ${isRepeat ? 'active' : ''}`}
          onClick={onToggleRepeat}
          aria-label="循环播放"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="17 1 21 5 17 9" />
            <path d="M3 11V9a4 4 0 0 1 4-4h14" />
            <polyline points="7 23 3 19 7 15" />
            <path d="M21 13v2a4 4 0 0 1-4 4H3" />
          </svg>
        </button>
      </div>
    </>
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
