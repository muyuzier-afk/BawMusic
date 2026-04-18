'use client';

import { useState, useCallback, useMemo, useEffect, type MouseEvent } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { SearchBar } from '@/components/Search';
import { ProgressBar } from '@/components/ProgressBar';
import { LyricsPanel } from '@/components/LyricsPanel';
import { PlaybackControls, PlaylistDrawer } from '@/components/PlaybackControls';
import { Sidebar } from '@/components/Sidebar';
import { Song } from '@/types/music';
import { ListIcon } from '@/components/Icons';

export default function MusicPlayer() {
  const repositoryUrl = 'https://github.com/muyuzier-afk/BawMusic';

  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    playMode,
    audioQuality,
    volume,
    playlist,
    currentIndex,
    lyric,
    isLoading,
    notice,
    playSong,
    togglePlay,
    seek,
    setVolume,
    setAudioQuality,
    cyclePlayMode,
    playNext,
    playPrev,
    playAt,
    movePlaylistItem,
    removePlaylistItem,
    clearNotice
  } = usePlayer();
  
  const [currentView, setCurrentView] = useState<'discover' | 'library'>('discover');
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [mobileLyricsOpen, setMobileLyricsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  
  const bgImage = useMemo(() => {
    return currentSong?.picUrl || '';
  }, [currentSong?.picUrl]);

  const activeLyricIndex = useMemo(() => {
    if (lyric.length === 0) return -1;

    for (let i = lyric.length - 1; i >= 0; i -= 1) {
      if (lyric[i].time <= currentTime) {
        return i;
      }
    }

    return -1;
  }, [lyric, currentTime]);

  const mobileBlurValue = useMemo(() => {
    const base = 26;
    if (activeLyricIndex < 0) return `${base}px`;
    const wave = (activeLyricIndex % 5) * 2;
    return `${base + wave}px`;
  }, [activeLyricIndex]);
  
  const handlePlaySong = useCallback((song: Song) => {
    playSong(song);
  }, [playSong]);
  
  const showPlayer = currentSong !== null;
  const openMobileLyrics = useCallback(() => {
    if (!currentSong) return;

    if (typeof window !== 'undefined' && !window.matchMedia('(max-width: 768px)').matches) {
      return;
    }

    setMobileLyricsOpen(true);
  }, [currentSong]);

  const closeMobileLyrics = useCallback(() => {
    setMobileLyricsOpen(false);
  }, []);

  const handlePlayPageClick = useCallback((event: MouseEvent<HTMLDivElement>) => {
    if (!mobileLyricsOpen) return;

    const target = event.target as HTMLElement;
    const clickedLyrics = Boolean(target.closest('.mobile-lyrics-bg'));
    const clickedBlank = target.classList.contains('play-page');

    if (clickedLyrics || clickedBlank) {
      closeMobileLyrics();
    }
  }, [mobileLyricsOpen, closeMobileLyrics]);

  useEffect(() => {
    setMobileLyricsOpen(false);
  }, [currentSong?.id]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => {
      clearNotice();
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [notice, clearNotice]);
  
  return (
    <div className="app-container">
      <div
        className="bg-layer"
        style={{
          backgroundImage: bgImage ? `url(${bgImage})` : 'none',
          backgroundColor: bgImage ? undefined : '#1a1a1a'
        }}
      />
      <div className="bg-overlay" />
      
      <div className="main-layout">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <main className="main-content">
          <header className="top-bar glass">
            <SearchBar onSongSelect={handlePlaySong} />
            <button
              className="details-btn details-btn-mobile-inline"
              onClick={() => setDetailsOpen(true)}
              type="button"
              aria-label="项目详情"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
              </svg>
            </button>
            <button
              className="icon-btn"
              onClick={() => setPlaylistOpen(true)}
              type="button"
              style={{ marginLeft: 'auto' }}
            >
              <ListIcon size={22} />
            </button>
          </header>
          
          {showPlayer && (
            <div className="player-shell">
              <div
                className={`play-page player-main ${mobileLyricsOpen ? 'lyrics-on-bg' : ''}`}
                style={mobileLyricsOpen ? ({ ['--mobile-lyrics-blur' as any]: mobileBlurValue }) : undefined}
                onClick={handlePlayPageClick}
              >
              <div className="mobile-lyrics-bg" aria-hidden={!mobileLyricsOpen}>
                <LyricsPanel lyrics={lyric} currentTime={currentTime} variant="mobile" />
              </div>

              {isLoading && (
                <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              )}
              
              <img
                src={currentSong.picUrl}
                alt={currentSong.name}
                className="album-cover album-cover-clickable"
                style={{ opacity: isLoading ? 0.3 : 1 }}
                onClick={(event) => {
                  event.stopPropagation();
                  openMobileLyrics();
                }}
              />
              
              <div className="song-info">
                <div className="song-title">{currentSong.name}</div>
                <div className="song-artist">{currentSong.artists} - {currentSong.album}</div>
              </div>
              
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={seek}
              />
              
              <PlaybackControls
                isPlaying={isPlaying}
                playMode={playMode}
                audioQuality={audioQuality}
                volume={volume}
                onTogglePlay={togglePlay}
                onNext={playNext}
                onPrev={playPrev}
                onCyclePlayMode={cyclePlayMode}
                onAudioQualityChange={setAudioQuality}
                onVolumeChange={setVolume}
              />

              {notice && <div className="player-notice">{notice}</div>}
              </div>

              <aside className="desktop-lyrics-pane">
                <LyricsPanel lyrics={lyric} currentTime={currentTime} variant="desktop" />
              </aside>
            </div>
          )}
          
          {!showPlayer && currentView === 'discover' && (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span style={{ fontSize: '18px' }}>搜索歌曲，开始播放</span>
            </div>
          )}
        </main>
      </div>
      
      <PlaylistDrawer
        isOpen={playlistOpen}
        onClose={() => setPlaylistOpen(false)}
        playlist={playlist}
        currentIndex={currentIndex}
        onPlayAt={playAt}
        onMoveItem={movePlaylistItem}
        onRemoveItem={removePlaylistItem}
      />

      <button
        className="details-btn details-btn-desktop-fixed"
        onClick={() => setDetailsOpen(true)}
        type="button"
        aria-label="项目详情"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <line x1="12" y1="8" x2="12" y2="13" />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {detailsOpen && (
        <div className="details-overlay" role="dialog" aria-modal="true" onClick={() => setDetailsOpen(false)}>
          <section className="details-card glass-strong" onClick={(event) => event.stopPropagation()}>
            <button className="details-close" onClick={() => setDetailsOpen(false)} type="button">
              关闭
            </button>

            <h2 className="details-title">BawMusic</h2>
            <p className="details-subtitle">极简风在线音乐播放器</p>

            <div className="details-section">
              <h3>项目信息</h3>
              <p>聚焦搜索、播放、歌词沉浸体验的 Web 音乐播放器，支持跨设备自适应交互。</p>
            </div>

            <div className="details-section">
              <h3>技术栈</h3>
              <p>Next.js 16、React 19、TypeScript、原生 CSS Variables。</p>
            </div>

            <div className="details-section">
              <h3>项目仓库</h3>
              <a className="details-link" href={repositoryUrl} target="_blank" rel="noreferrer">
                {repositoryUrl}
              </a>
            </div>

            <div className="details-author">作者：音四中某ZiHan</div>
          </section>
        </div>
      )}
    </div>
  );
}
