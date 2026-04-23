'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Song, MusicInfo, LyricLine, AudioQuality } from '@/types/music';
import { getMusicInfo, getLyric, parseLyric } from '@/lib/api';
import {
  bindNativeControlListeners,
  clearMediaControls,
  enableImmersiveMode,
  syncMediaControls,
  updateMediaPlaybackState
} from '@/lib/nativeMediaControls';

type PlayMode = 'list' | 'shuffle' | 'single';

const STORAGE_HISTORY_KEY = 'bawmusic:play-history';
const STORAGE_PLAYLIST_KEY = 'bawmusic:playlist';
const STORAGE_PLAYLIST_INDEX_KEY = 'bawmusic:playlist-index';
const STORAGE_VOLUME_KEY = 'bawmusic:volume';
const STORAGE_MODE_KEY = 'bawmusic:play-mode';
const STORAGE_QUALITY_KEY = 'bawmusic:audio-quality';

const QUALITY_LABELS: Record<AudioQuality, string> = {
  standard: '标准音质',
  exhigh: '极高音质',
  lossless: '无损音质',
  hires: 'Hi-Res（高解析度）音质',
  jymaster: '超清母带',
  sky: '天空音效',
  jyeffect: '沉浸环绕声'
};

function isAudioQuality(value: string): value is AudioQuality {
  return value === 'standard' || value === 'exhigh' || value === 'lossless' || value === 'hires' || value === 'jymaster' || value === 'sky' || value === 'jyeffect';
}

function isSongList(value: unknown): value is Song[] {
  if (!Array.isArray(value)) return false;
  return value.every((song) => {
    if (!song || typeof song !== 'object') return false;
    const candidate = song as Partial<Song>;
    return typeof candidate.id === 'number'
      && typeof candidate.name === 'string'
      && typeof candidate.artists === 'string'
      && typeof candidate.album === 'string'
      && typeof candidate.picUrl === 'string';
  });
}

interface UsePlayerReturn {
  currentSong: MusicInfo | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playMode: PlayMode;
  audioQuality: AudioQuality;
  playlist: Song[];
  currentIndex: number;
  lyric: LyricLine[];
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  playSong: (song: Song) => void;
  playSongById: (id: number) => Promise<void>;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  setAudioQuality: (quality: AudioQuality) => void;
  cyclePlayMode: () => void;
  playNext: () => void;
  playPrev: () => void;
  addToPlaylist: (song: Song) => void;
  clearPlaylist: () => void;
  playAt: (index: number) => void;
  movePlaylistItem: (fromIndex: number, toIndex: number) => void;
  removePlaylistItem: (index: number) => void;
  removePlaylistItems: (indices: number[]) => void;
  clearNotice: () => void;
  showNotice: (message: string) => void;
}

export function usePlayer(): UsePlayerReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playModeRef = useRef<PlayMode>('list');
  const audioQualityRef = useRef<AudioQuality>('lossless');
  const playNextRef = useRef<() => void>(() => {});
  const playPrevRef = useRef<() => void>(() => {});
  const loadRequestRef = useRef(0);
  
  const [currentSong, setCurrentSong] = useState<MusicInfo | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [playMode, setPlayMode] = useState<PlayMode>('list');
  const [audioQuality, setAudioQualityState] = useState<AudioQuality>('lossless');
  const [playlist, setPlaylist] = useState<Song[]>([]);
  const [historyRecords, setHistoryRecords] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [lyric, setLyric] = useState<LyricLine[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const readValue = (key: string) => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    };

    const cachedHistory = readValue(STORAGE_HISTORY_KEY);
    if (cachedHistory) {
      try {
        const parsed = JSON.parse(cachedHistory) as unknown;
        if (isSongList(parsed)) {
          setHistoryRecords(parsed.slice(0, 120));
        }
      } catch {
        setHistoryRecords([]);
      }
    }

    const cachedPlaylist = readValue(STORAGE_PLAYLIST_KEY);
    if (cachedPlaylist) {
      try {
        const parsed = JSON.parse(cachedPlaylist) as unknown;
        if (isSongList(parsed)) {
          setPlaylist(parsed);

          const cachedIndex = readValue(STORAGE_PLAYLIST_INDEX_KEY);
          if (cachedIndex) {
            const parsedIndex = Number(cachedIndex);
            if (!Number.isNaN(parsedIndex) && parsedIndex >= 0 && parsedIndex < parsed.length) {
              setCurrentIndex(parsedIndex);
            }
          }
        }
      } catch {
        setPlaylist([]);
        setCurrentIndex(-1);
      }
    }

    const cachedVolume = readValue(STORAGE_VOLUME_KEY);
    if (cachedVolume) {
      const parsedVolume = Number(cachedVolume);
      if (!Number.isNaN(parsedVolume) && parsedVolume >= 0 && parsedVolume <= 1) {
        setVolumeState(parsedVolume);
      }
    }

    const cachedMode = readValue(STORAGE_MODE_KEY);
    if (cachedMode === 'list' || cachedMode === 'shuffle' || cachedMode === 'single') {
      setPlayMode(cachedMode);
    }

    const cachedQuality = readValue(STORAGE_QUALITY_KEY);
    if (cachedQuality && isAudioQuality(cachedQuality)) {
      setAudioQualityState(cachedQuality);
    }
  }, []);

  useEffect(() => {
    playModeRef.current = playMode;
  }, [playMode]);

  useEffect(() => {
    audioQualityRef.current = audioQuality;
  }, [audioQuality]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(historyRecords.slice(0, 120)));
    } catch {
      // ignore localStorage write failures
    }
  }, [historyRecords]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_PLAYLIST_KEY, JSON.stringify(playlist));
      window.localStorage.setItem(STORAGE_PLAYLIST_INDEX_KEY, String(currentIndex));
    } catch {
      // ignore localStorage write failures
    }
  }, [playlist, currentIndex]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_VOLUME_KEY, String(volume));
    } catch {
      // ignore localStorage write failures
    }
  }, [volume]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_MODE_KEY, playMode);
    } catch {
      // ignore localStorage write failures
    }
  }, [playMode]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_QUALITY_KEY, audioQuality);
    } catch {
      // ignore localStorage write failures
    }
  }, [audioQuality]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    void enableImmersiveMode();

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

  const loadSong = useCallback(async (
    song: Song,
    options?: {
      startTime?: number;
      autoPlay?: boolean;
      resolvedMusicInfo?: MusicInfo;
    }
  ) => {
    const requestId = ++loadRequestRef.current;
    setIsLoading(true);
    setError(null);
    setLyric([]);
    
    try {
      const musicInfo = options?.resolvedMusicInfo ?? await getMusicInfo(song.id, audioQualityRef.current);

      if (requestId !== loadRequestRef.current) return;
      
      setCurrentSong(musicInfo);
      
      if (audioRef.current) {
        const resumeTime = options?.startTime;
        if (typeof resumeTime === 'number' && resumeTime > 0) {
          const setResumeTime = () => {
            if (!audioRef.current) return;
            audioRef.current.currentTime = Math.max(0, resumeTime);
          };
          audioRef.current.addEventListener('loadedmetadata', setResumeTime, { once: true });
        }

        audioRef.current.src = musicInfo.url;

        if (options?.autoPlay !== false) {
          void audioRef.current.play();
        }
      }

      try {
        const lyricData = await getLyric(song.id);
        if (requestId !== loadRequestRef.current) return;
        setLyric(parseLyric(lyricData.lrc || '', lyricData.tlyric || ''));
      } catch {
        if (requestId !== loadRequestRef.current) return;
        setLyric([]);
      }
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to load song');
    } finally {
      if (requestId !== loadRequestRef.current) return;
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

  const playSongById = useCallback(async (id: number) => {
    setNotice(null);
    setError(null);

    try {
      const musicInfo = await getMusicInfo(id, audioQualityRef.current);
      const song: Song = {
        id: musicInfo.id,
        name: musicInfo.name,
        artists: musicInfo.artists,
        album: musicInfo.album,
        picUrl: musicInfo.picUrl
      };

      const nextIndex = playlist.length;
      setPlaylist(prev => [...prev, song]);
      setCurrentIndex(nextIndex);
      updateHistory(song);
      await loadSong(song, { resolvedMusicInfo: musicInfo });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shared song');
      setNotice('分享链接中的歌曲加载失败');
    }
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

  const setAudioQuality = useCallback((quality: AudioQuality) => {
    if (quality === audioQualityRef.current) return;

    setAudioQualityState(quality);
    setNotice(`已切换至${QUALITY_LABELS[quality]}`);

    if (!currentSong) {
      return;
    }

    const currentPosition = audioRef.current?.currentTime ?? 0;
    const shouldAutoPlay = Boolean(isPlaying);

    void loadSong(currentSong, {
      startTime: currentPosition,
      autoPlay: shouldAutoPlay
    });
  }, [currentSong, isPlaying, loadSong]);

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

  useEffect(() => {
    playPrevRef.current = playPrev;
  }, [playPrev]);

  useEffect(() => {
    void bindNativeControlListeners({
      onPlay: () => {
        if (audioRef.current) {
          void audioRef.current.play();
        }
      },
      onPause: () => {
        audioRef.current?.pause();
      },
      onNext: () => {
        playNextRef.current();
      },
      onPrev: () => {
        playPrevRef.current();
      },
      onSeekTo: (time) => {
        if (audioRef.current) {
          const safeTime = Math.max(0, time);
          audioRef.current.currentTime = safeTime;
          setCurrentTime(safeTime);
        }
      }
    });
  }, []);

  const addToPlaylist = useCallback((song: Song) => {
    setPlaylist(prev => {
      return [...prev, song];
    });
  }, []);

  const movePlaylistItem = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    if (fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= playlist.length || toIndex >= playlist.length) return;

    const nextPlaylist = [...playlist];
    const [movedSong] = nextPlaylist.splice(fromIndex, 1);
    if (!movedSong) return;
    nextPlaylist.splice(toIndex, 0, movedSong);

    setPlaylist(nextPlaylist);

    setCurrentIndex(prev => {
      if (prev === fromIndex) return toIndex;
      if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) return prev - 1;
      if (fromIndex > toIndex && prev >= toIndex && prev < fromIndex) return prev + 1;
      return prev;
    });
  }, [playlist]);

  const removePlaylistItem = useCallback((index: number) => {
    if (index < 0 || index >= playlist.length) return;

    const nextPlaylist = playlist.filter((_, itemIndex) => itemIndex !== index);
    const removingCurrent = index === currentIndex;

    setPlaylist(nextPlaylist);

    if (removingCurrent) {
      if (nextPlaylist.length === 0) {
        setCurrentIndex(-1);
        setCurrentSong(null);
        setLyric([]);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setNotice('播放列表已清空');

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        return;
      }

      const replacementIndex = Math.min(index, nextPlaylist.length - 1);
      const replacementSong = nextPlaylist[replacementIndex];

      setCurrentIndex(replacementIndex);
      updateHistory(replacementSong);
      setNotice(null);
      loadSong(replacementSong);
      return;
    }

    if (index < currentIndex) {
      setCurrentIndex(prev => Math.max(0, prev - 1));
    }
  }, [playlist, currentIndex, loadSong, updateHistory]);

  const removePlaylistItems = useCallback((indices: number[]) => {
    if (indices.length === 0) return;

    const sortedIndices = Array.from(new Set(indices)).sort((a, b) => b - a);
    if (sortedIndices.some(i => i < 0 || i >= playlist.length)) return;

    let nextPlaylist = [...playlist];
    let nextCurrentIndex = currentIndex;

    for (const index of sortedIndices) {
      nextPlaylist.splice(index, 1);
      if (index < nextCurrentIndex) {
        nextCurrentIndex -= 1;
      } else if (index === nextCurrentIndex) {
        nextCurrentIndex = -1;
      }
    }

    const removingCurrent = currentIndex >= 0 && indices.includes(currentIndex);

    setPlaylist(nextPlaylist);

    if (removingCurrent) {
      if (nextPlaylist.length === 0) {
        setCurrentIndex(-1);
        setCurrentSong(null);
        setLyric([]);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setNotice('选中歌曲已删除');

        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = '';
        }
        return;
      }

      const replacementIndex = Math.min(Math.max(0, currentIndex), nextPlaylist.length - 1);
      const replacementSong = nextPlaylist[replacementIndex];

      setCurrentIndex(replacementIndex);
      updateHistory(replacementSong);
      setNotice(null);
      loadSong(replacementSong);
      return;
    }

    setCurrentIndex(Math.max(0, nextCurrentIndex));
  }, [playlist, currentIndex, loadSong, updateHistory]);

  const clearPlaylist = useCallback(() => {
    setPlaylist([]);
    setCurrentIndex(-1);
    setCurrentSong(null);
    setLyric([]);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setNotice(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, []);

  useEffect(() => {
    if (!currentSong) {
      void clearMediaControls();
      return;
    }

    void syncMediaControls({
      title: currentSong.name,
      artist: currentSong.artists,
      album: currentSong.album,
      cover: currentSong.picUrl,
      duration,
      elapsed: currentTime,
      isPlaying
    }, {
      onPlay: () => {
        if (audioRef.current) {
          void audioRef.current.play();
        }
      },
      onPause: () => {
        audioRef.current?.pause();
      },
      onNext: () => {
        playNextRef.current();
      },
      onPrev: () => {
        playPrevRef.current();
      },
      onSeekTo: (time) => {
        if (audioRef.current) {
          const safeTime = Math.max(0, time);
          audioRef.current.currentTime = safeTime;
          setCurrentTime(safeTime);
        }
      }
    });
  }, [currentSong, duration]);

  useEffect(() => {
    updateMediaPlaybackState(isPlaying, currentTime, duration);
  }, [isPlaying, currentTime, duration]);

  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
  }, []);

  return {
    currentSong,
    isPlaying,
    currentTime,
    duration,
    volume,
    playMode,
    audioQuality,
    playlist,
    currentIndex,
    lyric,
    isLoading,
    error,
    notice,
    playSong,
    playSongById,
    togglePlay,
    play,
    pause,
    seek,
    setVolume,
    setAudioQuality,
    cyclePlayMode,
    playNext,
    playPrev,
    addToPlaylist,
    movePlaylistItem,
    removePlaylistItem,
    clearPlaylist,
    removePlaylistItems,
    playAt,
    clearNotice,
    showNotice
  };
}
