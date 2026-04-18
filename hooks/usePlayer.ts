'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, MusicInfo, LyricLine } from '@/types/music';
import { getMusicInfo, getLyric, parseLyric } from '@/lib/api';

interface UsePlayerReturn {
  currentSong: MusicInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isShuffle: boolean;
  isRepeat: boolean;
  playlist: Song[];
  currentIndex: number;
  lyric: LyricLine[];
  isLoading: boolean;
  error: string | null;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToPlaylist: (song: Song) => void;
  clearPlaylist: () => void;
  playAt: (index: number) => void;
}

export function usePlayer(): UsePlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isRepeatRef = useRef(false);
  const playNextRef = useRef<() => void>(() => {});
  
  const [currentSong, setCurrentSong] = useState<MusicInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lyric, setLyric] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isRepeatRef.current = isRepeat;
  }, [isRepeat]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const audio = new Audio();
    audio.volume = volume;
    audioRef.current = audio;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      if (isRepeatRef.current) {
        audio.currentTime = 0;
        void audio.play();
        return;
      }

      playNextRef.current();
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  const loadSong = useCallback(async (song: Song) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [musicInfo, lyricData] = await Promise.all([
        getMusicInfo(song.id),
        getLyric(song.id)
      ]);
      
      setCurrentSong(musicInfo);
      setLyric(parseLyric(lyricData.lrc));
      
      if (audioRef.current) {
        audioRef.current.src = musicInfo.url;
        void audioRef.current.play();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load song');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const playSong = useCallback((song: Song) => {
    const existingIndex = playlist.findIndex(s => s.id === song.id);

    if (existingIndex !== -1) {
      setCurrentIndex(existingIndex);
      loadSong(song);
      return;
    }

    const nextIndex = playlist.length;
    setPlaylist(prev => [...prev, song]);
    setCurrentIndex(nextIndex);
    loadSong(song);
  }, [playlist, loadSong]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current || !currentSong) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      void audioRef.current.play();
    }
  }, [isPlaying, currentSong]);

  const play = useCallback(() => {
    if (audioRef.current) {
      void audioRef.current.play();
    }
  }, []);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const seek = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolumeState(newVolume);
    }
  }, []);

  const toggleShuffle = useCallback(() => {
    setIsShuffle(prev => !prev);
  }, []);

  const toggleRepeat = useCallback(() => {
    setIsRepeat(prev => !prev);
  }, []);

  const playAt = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      loadSong(playlist[index]);
    }
  }, [playlist, loadSong]);

  const playNext = useCallback(() => {
    if (playlist.length === 0) return;
    
    let nextIndex: number;
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * playlist.length);
    } else {
      nextIndex = currentIndex + 1;
      if (nextIndex >= playlist.length) {
        nextIndex = isRepeat ? 0 : -1;
        if (nextIndex === -1) {
          setIsPlaying(false);
          return;
        }
      }
    }
    
    playAt(nextIndex);
  }, [playlist, currentIndex, isShuffle, isRepeat, playAt]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrev = useCallback(() => {
    if (playlist.length === 0) return;
    
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      prevIndex = isRepeat ? playlist.length - 1 : 0;
    }
    
    playAt(prevIndex);
  }, [currentIndex, isRepeat, playlist.length, playAt]);

  const addToPlaylist = useCallback((song: Song) => {
    setPlaylist(prev => {
      if (prev.find(s => s.id === song.id)) return prev;
      return [...prev, song];
    });
  }, []);

  const clearPlaylist = useCallback(() => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
    setLyric([]);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    isShuffle,
    isRepeat,
    playlist,
    currentIndex,
    lyric,
    isLoading,
    error,
    playSong,
    togglePlay,
    play,
    pause,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeat,
    playNext,
    playPrev,
    addToPlaylist,
    clearPlaylist,
    playAt
  };
}
