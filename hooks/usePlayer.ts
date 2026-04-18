'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, MusicInfo, LyricLine } from '@/types/music';
import { getMusicInfo, getLyric, parseLyric } from '@/lib/api';

type PlayMode = 'list' | 'shuffle' | 'single';

const STORAGE_HISTORY_KEY = 'bawmusic:play-history';
const STORAGE_VOLUME_KEY = 'bawmusic:volume';
const STORAGE_MODE_KEY = 'bawmusic:play-mode';

interface UsePlayerReturn {
  currentSong: MusicInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  playlist: Song[];
  currentIndex: number;
  lyric: LyricLine[];
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  playSong: (song: Song) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  cyclePlayMode: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToPlaylist: (song: Song) => void;
  clearPlaylist: () => void;
  playAt: (index: number) => void;
  clearNotice: () => void;
}

export function usePlayer(): UsePlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playModeRef = useRef<PlayMode>('list');
  const playNextRef = useRef<() => void>(() => {});
  
  const [currentSong, setCurrentSong] = useState<MusicInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [playMode, setPlayMode] = useState<PlayMode>('list');
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lyric, setLyric] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const cachedHistory = window.localStorage.getItem(STORAGE_HISTORY_KEY);
      if (cachedHistory) {
        const parsed = JSON.parse(cachedHistory) as Song[];
        if (Array.isArray(parsed)) {
          setHistoryRecords(parsed.slice(0, 120));
        }
      }

      const cachedVolume = window.localStorage.getItem(STORAGE_VOLUME_KEY);
      if (cachedVolume) {
        const parsedVolume = Number(cachedVolume);
        if (!Number.isNaN(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1) {
          setVolumeState(parsedVolume);
        }
      }

      const cachedMode = window.localStorage.getItem(STORAGE_MODE_KEY);
      if (cachedMode === 'list' || cachedMode === 'shuffle' || cachedMode === 'single') {
        setPlayMode(cachedMode);
      }
    } catch {
      setHistoryRecords([]);
    }
  }, []);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(historyRecords.slice(0, 120)));
  }, [historyRecords]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_VOLUME_KEY, String(volume));
  }, [volume]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(STORAGE_MODE_KEY, playMode);
  }, [playMode]);

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
      if (playModeRef.current === 'single') {
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

  const updateHistory = useCallback((song: Song) => {
    setHistoryRecords(prev => {
      const next = [song, ...prev.filter(item => item.id !== song.id)];
      return next.slice(0, 120);
    });
  }, []);

  const ensurePlaylistByHistory = useCallback((base: Song[]) => {
    if (historyRecords.length === 0) return base;

    const baseIds = new Set(base.map(song => song.id));
    const remaining = historyRecords.filter(song => !baseIds.has(song.id));

    if (remaining.length > 0) {
      return [...base, ...remaining];
    }

    return base.length > 0 ? base : [...historyRecords];
  }, [historyRecords]);

  const playSong = useCallback((song: Song) => {
    const nextIndex = playlist.length;
    setPlaylist(prev => [...prev, song]);
    setCurrentIndex(nextIndex);
    updateHistory(song);
    setNotice(null);
    loadSong(song);
  }, [playlist, loadSong, updateHistory]);

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
    const normalized = Math.min(1, Math.max(0, newVolume));
    if (audioRef.current) {
      audioRef.current.volume = normalized;
    }
    setVolumeState(normalized);
  }, []);

  const cyclePlayMode = useCallback(() => {
    setPlayMode(prev => {
      if (prev === 'list') return 'shuffle';
      if (prev === 'shuffle') return 'single';
      return 'list';
    });
  }, []);

  const playAt = useCallback((index: number) => {
    if (index >= 0 && index < playlist.length) {
      setCurrentIndex(index);
      updateHistory(playlist[index]);
      setNotice(null);
      loadSong(playlist[index]);
    }
  }, [playlist, loadSong, updateHistory]);

  const playNext = useCallback(() => {
    if (playlist.length === 0 && historyRecords.length === 0) {
      setNotice('还没有可切换的播放记录');
      return;
    }

    if (playModeRef.current === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
      return;
    }

    if (playModeRef.current === 'shuffle') {
      const source = playlist.length > 0 ? playlist : historyRecords;
      if (source.length === 0) return;

      const currentSongId = currentSong?.id;
      let randomIndex = Math.floor(Math.random() * source.length);
      if (source.length > 1 && currentSongId !== undefined && source[randomIndex]?.id === currentSongId) {
        randomIndex = (randomIndex + 1) % source.length;
      }

      const randomSong = source[randomIndex];
      if (source === playlist) {
        setCurrentIndex(randomIndex);
      } else {
        setNotice('当前轮次已结束，已从历史记录继续随机播放');
      }

      updateHistory(randomSong);
      loadSong(randomSong);
      return;
    }

    let workingPlaylist = playlist;
    let nextIndex = currentIndex + 1;

    if (nextIndex >= workingPlaylist.length) {
      const extended = ensurePlaylistByHistory(workingPlaylist);
      workingPlaylist = extended;
      if (extended.length !== playlist.length) {
        setPlaylist(extended);
      }
      if (extended.length === 0) {
        setNotice('还没有可切换的播放记录');
        return;
      }

      if (currentIndex >= extended.length - 1) {
        nextIndex = 0;
      }

      setNotice('搜索结果已播放完，已切换到历史记录继续播放');
    }

    const nextSong = workingPlaylist[nextIndex];
    if (!nextSong) return;

    setCurrentIndex(nextIndex);
    updateHistory(nextSong);
    loadSong(nextSong);
  }, [playlist, historyRecords, currentIndex, currentSong?.id, ensurePlaylistByHistory, loadSong, updateHistory]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  const playPrev = useCallback(() => {
    if (playlist.length === 0 && historyRecords.length === 0) {
      setNotice('还没有可切换的播放记录');
      return;
    }
    
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }

    if (playModeRef.current === 'single') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        void audioRef.current.play();
      }
      return;
    }

    if (playModeRef.current === 'shuffle') {
      const source = playlist.length > 0 ? playlist : historyRecords;
      if (source.length === 0) return;

      const randomIndex = Math.floor(Math.random() * source.length);
      const randomSong = source[randomIndex];

      if (source === playlist) {
        setCurrentIndex(randomIndex);
      } else {
        setNotice('当前轮次已结束，已从历史记录继续随机播放');
      }

      updateHistory(randomSong);
      loadSong(randomSong);
      return;
    }
    
    let prevIndex = currentIndex - 1;
    if (prevIndex < 0) {
      const extended = ensurePlaylistByHistory(playlist);
      if (extended.length !== playlist.length) {
        setPlaylist(extended);
      }

      if (extended.length === 0) {
        setNotice('还没有可切换的播放记录');
        return;
      }

      prevIndex = extended.length - 1;
      setNotice('已切换到历史记录继续播放');
    }
    
    const prevSong = (prevIndex >= 0 && prevIndex < playlist.length)
      ? playlist[prevIndex]
      : ensurePlaylistByHistory(playlist)[prevIndex];

    if (!prevSong) return;
    setCurrentIndex(prevIndex);
    updateHistory(prevSong);
    loadSong(prevSong);
  }, [playlist, historyRecords, currentIndex, ensurePlaylistByHistory, loadSong, updateHistory]);

  const addToPlaylist = useCallback((song: Song) => {
    setPlaylist(prev => {
      return [...prev, song];
    });
  }, []);

  const clearPlaylist = useCallback(() => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
    setLyric([]);
    setNotice(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    playlist,
    currentIndex,
    lyric,
    isLoading,
    error,
    notice,
    playSong,
    togglePlay,
    play,
    pause,
    seek,
    setVolume,
    cyclePlayMode,
    playNext,
    playPrev,
    addToPlaylist,
    clearPlaylist,
    playAt,
    clearNotice
  };
}
