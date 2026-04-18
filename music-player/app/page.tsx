'use client';

import { useState, useCallback, useMemo } from 'react';
import { usePlayer } from '@/hooks/usePlayer';
import { SearchBar } from '@/components/Search';
import { ProgressBar } from '@/components/ProgressBar';
import { LyricsPanel } from '@/components/LyricsPanel';
import { PlaybackControls, PlaylistDrawer } from '@/components/PlaybackControls';
import { Sidebar } from '@/components/Sidebar';
import { Song } from '@/types/music';
import { ListIcon } from '@/components/Icons';

export default function MusicPlayer() {
  const {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    isShuffle,
    isRepeat,
    playlist,
    currentIndex,
    lyric,
    isLoading,
    playSong,
    togglePlay,
    seek,
    toggleShuffle,
    toggleRepeat,
    playNext,
    playPrev,
    playAt
  } = usePlayer();
  
  const [currentView, setCurrentView] = useState<'discover' | 'library' | 'lyrics'>('discover');
  const [playlistOpen, setPlaylistOpen] = useState(false);
  
  const bgImage = useMemo(() => {
    return currentSong?.picUrl || '';
  }, [currentSong?.picUrl]);
  
  const handlePlaySong = useCallback((song: Song) => {
    playSong(song);
  }, [playSong]);
  
  const showPlayer = currentSong !== null;
  const showLyrics = currentView === 'lyrics' && lyric.length > 0 && currentSong !== null;
  
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
              className="icon-btn"
              onClick={() => setPlaylistOpen(true)}
              style={{ marginLeft: 'auto' }}
            >
              <ListIcon size={22} />
            </button>
          </header>
          
          {showPlayer && currentView !== 'lyrics' && (
            <div className="play-page">
              {isLoading && (
                <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              )}
              
              <img
                src={currentSong.picUrl}
                alt={currentSong.name}
                className="album-cover"
                style={{ opacity: isLoading ? 0.3 : 1 }}
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
                isShuffle={isShuffle}
                isRepeat={isRepeat}
                onTogglePlay={togglePlay}
                onNext={playNext}
                onPrev={playPrev}
                onToggleShuffle={toggleShuffle}
                onToggleRepeat={toggleRepeat}
                onOpenPlaylist={() => setPlaylistOpen(true)}
                playlist={playlist}
                currentIndex={currentIndex}
                currentSong={currentSong}
              />
            </div>
          )}
          
          {showLyrics && (
            <div className="play-page" style={{ paddingTop: '20px' }}>
              <img
                src={currentSong.picUrl}
                alt={currentSong.name}
                className="album-cover"
                style={{ width: '180px', height: '180px' }}
              />
              
              <ProgressBar
                currentTime={currentTime}
                duration={duration}
                onSeek={seek}
              />
              
              <PlaybackControls
                isPlaying={isPlaying}
                isShuffle={isShuffle}
                isRepeat={isRepeat}
                onTogglePlay={togglePlay}
                onNext={playNext}
                onPrev={playPrev}
                onToggleShuffle={toggleShuffle}
                onToggleRepeat={toggleRepeat}
                onOpenPlaylist={() => setPlaylistOpen(true)}
                playlist={playlist}
                currentIndex={currentIndex}
                currentSong={currentSong}
              />
              
              <LyricsPanel lyrics={lyric} currentTime={currentTime} />
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
        currentSong={currentSong}
      />
    </div>
  );
}
