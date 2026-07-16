'use client';

import { useState, useCallback, useMemo, useEffect, useRef, type MouseEvent } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePlayer } from '@/hooks/usePlayer';
import { useLibraryFolders } from '@/hooks/useLibraryFolders';
import { useDeviceOrientation } from '@/hooks/useDeviceOrientation';
import { SearchBar } from '@/components/Search';
import { ProgressBar } from '@/components/ProgressBar';
import { LyricsPanel } from '@/components/LyricsPanel';
import { AmllLyrics } from '@/components/AmllLyrics';
import { FluidBackground } from '@/components/FluidBackground';
import { LibraryView } from '@/components/LibraryView';
import { PlaybackControls, PlaylistDrawer } from '@/components/PlaybackControls';
import { SourceSwitcher } from '@/components/SourceSwitcher';
import { DownloadMenu } from '@/components/DownloadMenu';
import { Sidebar } from '@/components/Sidebar';
import { Song, AudioQuality } from '@/types/music';
import { ListIcon, ImportIcon, UploadIcon } from '@/components/Icons';
import { normalizeMediaUrl } from '@/lib/media';
import { downloadSongAtQuality } from '@/lib/download';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { fetchPlaylist, extractPlaylistId, setApiSource, useApiSource, type ApiSource } from '@/lib/api';
import buildInfo from '@/lib/build-info.json';
import versionsData from '@/versions.json';
import type { BuildInfo, VersionsFile } from '@/lib/build-info-types';

const build: BuildInfo = buildInfo as BuildInfo;
const versionsFile: VersionsFile = versionsData as VersionsFile;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
    playSongById,
    togglePlay,
    seek,
    setVolume,
    setAudioQuality,
    reFetchCurrentSong,
    cyclePlayMode,
    playNext,
    playPrev,
    playAt,
    movePlaylistItem,
    removePlaylistItem,
    removePlaylistItems,
    clearPlaylist,
    addToPlaylist,
    clearNotice,
    showNotice,
    setPlaybackScope
  } = usePlayer();

  const apiSource = useApiSource();
  const {
    folders,
    createFolder,
    renameFolder,
    deleteFolder,
    addSongToFolder,
    removeSongFromFolder,
    removeSongFromAllFolders,
    clearAllFolders,
    reorderInFolder,
    moveSongToFolder
  } = useLibraryFolders();

  const [currentView, setCurrentView] = useState<'discover' | 'library'>('discover');
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const [mobileLyricsOpen, setMobileLyricsOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isNativeApp, setIsNativeApp] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [downloadMenuAnchor, setDownloadMenuAnchor] = useState<DOMRect | null>(null);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [importJsonBusy, setImportJsonBusy] = useState(false);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const handledSharedSongRef = useRef<number | null>(null);
  const playSongByIdRef = useRef(playSongById);
  const importFileInputRef = useRef<HTMLInputElement | null>(null);
  const titleClickCountRef = useRef(0);
  const titleClickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [devUnlocked, setDevUnlocked] = useState(false);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [devHydrated, setDevHydrated] = useState(false);
  const [devTick, setDevTick] = useState(0); // DevMenu 打开时定时刷新运行时信息
  const [devSeekInput, setDevSeekInput] = useState('');
  const [devJumpIndex, setDevJumpIndex] = useState('');
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  // LiquidFlow Styles：手机端陀螺仪驱动背景液体流动
  const [liquidFlow, setLiquidFlow] = useState(false);
  const [liquidFlowHydrated, setLiquidFlowHydrated] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  // Better Styles (Beta)：样式增强开关，具体功能待实现
  const [betterStyles, setBetterStyles] = useState(false);
  const [betterStylesHydrated, setBetterStylesHydrated] = useState(false);

  // 读取 LiquidFlow / Better Styles 持久化状态 + 检测移动端
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('bawmusic:liquid-flow');
      if (stored === '1') setLiquidFlow(true);
      const storedBs = window.localStorage.getItem('bawmusic:better-styles');
      if (storedBs === '1') setBetterStyles(true);
    } catch { /* ignore */ }
    setLiquidFlowHydrated(true);
    setBetterStylesHydrated(true);
    setIsMobile(window.matchMedia('(max-width: 768px)').matches || typeof window.orientation !== 'undefined');
  }, []);

  // Better Styles 开关同步到 body class，供全局 CSS 变量切换
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.body.classList.toggle('better-styles', betterStyles);
  }, [betterStyles]);

  const handleToggleBetterStyles = useCallback(() => {
    setBetterStyles(prev => {
      const next = !prev;
      try { window.localStorage.setItem('bawmusic:better-styles', next ? '1' : '0'); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // DevMenu：跳转到指定秒数
  const handleDevSeek = useCallback(() => {
    const sec = Number(devSeekInput);
    if (Number.isNaN(sec) || sec < 0) {
      showNotice('请输入有效的秒数');
      return;
    }
    seek(sec);
    showNotice(`已跳转到 ${sec}s`);
  }, [devSeekInput, seek, showNotice]);

  // DevMenu：跳转到播放列表指定索引
  const handleDevJump = useCallback(() => {
    const idx = Number(devJumpIndex);
    if (Number.isNaN(idx) || idx < 1 || idx > playlist.length) {
      showNotice(`请输入 1-${playlist.length} 之间的索引`);
      return;
    }
    playAt(idx - 1);
    showNotice(`已跳转到 #${idx}`);
  }, [devJumpIndex, playlist.length, playAt, showNotice]);

  // DevMenu：复制当前歌曲 ID
  const handleDevCopySongId = useCallback(() => {
    if (!currentSong) {
      showNotice('当前无播放歌曲');
      return;
    }
    try {
      navigator.clipboard?.writeText(String(currentSong.id));
      showNotice(`已复制歌曲 ID：${currentSong.id}`);
    } catch {
      showNotice('剪贴板不可用');
    }
  }, [currentSong, showNotice]);

  // DevMenu：导出播放列表 JSON（复用已有逻辑，但走下载）
  const handleDevExportPlaylist = useCallback(() => {
    if (playlist.length === 0) {
      showNotice('播放列表为空');
      return;
    }
    try {
      const payload = { version: 1, exportedAt: new Date().toISOString(), songs: playlist };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const ts = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
      const link = document.createElement('a');
      link.href = url;
      link.download = `playlist-${ts}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotice(`已导出 ${playlist.length} 首歌曲`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : '导出失败');
    }
  }, [playlist, showNotice]);

  const { offsetX, offsetY, requestPermission, supported: orientationSupported } = useDeviceOrientation({
    enabled: liquidFlow && isMobile,
  });

  const handleToggleLiquidFlow = useCallback(async () => {
    if (liquidFlow) {
      // 关闭：直接置 false
      setLiquidFlow(false);
      try { window.localStorage.setItem('bawmusic:liquid-flow', '0'); } catch { /* ignore */ }
      return;
    }
    // 开启：iOS 需先请求权限（必须在用户手势内）
    if (orientationSupported) {
      const ok = await requestPermission();
      if (!ok) {
        showNotice('未获得陀螺仪权限，无法启用');
        return;
      }
    }
    setLiquidFlow(true);
    try { window.localStorage.setItem('bawmusic:liquid-flow', '1'); } catch { /* ignore */ }
    showNotice('LiquidFlow Styles 已开启');
  }, [liquidFlow, orientationSupported, requestPermission, showNotice]);

  // 当前歌词是否包含翻译行，决定是否显示翻译开关
  const hasTranslation = useMemo(() => lyric.some(line => line.translation), [lyric]);

  // 文件夹范围内播放：当前歌曲若属于某文件夹，则把播放范围限定到该文件夹的顺序
  const playbackScope = useMemo(() => {
    if (!currentSong) return null;
    const folder = folders.find((f) => f.songIds.includes(currentSong.id));
    return folder ? folder.songIds.slice() : null;
  }, [currentSong, folders]);

  useEffect(() => {
    setPlaybackScope(playbackScope);
  }, [playbackScope, setPlaybackScope]);

  const handleToggleTranslation = useCallback(() => {
    setShowTranslation(prev => !prev);
  }, []);

  // 从 localStorage 读取开发者模式解锁状态（仅客户端）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('bawmusic:dev-unlocked');
      if (stored === '1') setDevUnlocked(true);
    } catch {
      /* 忽略：隐私模式/Storage 不可用 */
    }
    setDevHydrated(true);
  }, []);

  // 解锁开发者模式：写入 localStorage 并打开菜单
  const unlockDevMode = useCallback(() => {
    setDevUnlocked(true);
    setDevMenuOpen(true);
    try {
      window.localStorage.setItem('bawmusic:dev-unlocked', '1');
    } catch {
      /* 忽略 */
    }
  }, []);

  // 处理 "BawMusic" 标题的连击：5 次解锁
  const handleTitleClick = useCallback(() => {
    if (devUnlocked) {
      setDevMenuOpen(true);
      return;
    }
    titleClickCountRef.current += 1;
    if (titleClickTimerRef.current) {
      clearTimeout(titleClickTimerRef.current);
    }
    titleClickTimerRef.current = setTimeout(() => {
      titleClickCountRef.current = 0;
      titleClickTimerRef.current = null;
    }, 2000);
    if (titleClickCountRef.current >= 5) {
      titleClickCountRef.current = 0;
      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
        titleClickTimerRef.current = null;
      }
      unlockDevMode();
    }
  }, [devUnlocked, unlockDevMode]);

  // 卸载时清理定时器
  useEffect(() => {
    return () => {
      if (titleClickTimerRef.current) {
        clearTimeout(titleClickTimerRef.current);
      }
    };
  }, []);

  // DevMenu 打开时定时刷新运行时信息（网络/视口/时间等动态值）
  useEffect(() => {
    if (!devMenuOpen) return;
    const timer = setInterval(() => setDevTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [devMenuOpen]);

  const bgImage = useMemo(() => {
    return normalizeMediaUrl(currentSong?.picUrl);
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
    // 搜索点歌默认加入音乐库（与播放队列共用的 playlist），已存在则直接定位播放
    void playSongById(song.id);
  }, [playSongById]);

  const handleDownloadClick = useCallback((event: MouseEvent<HTMLElement>) => {
    if (!currentSong) return;
    const target = event.currentTarget as HTMLElement;
    setDownloadMenuAnchor(target.getBoundingClientRect());
    setDownloadMenuOpen((prev) => !prev);
  }, [currentSong]);

  const handleCloseDownloadMenu = useCallback(() => {
    if (downloadBusy) return;
    setDownloadMenuOpen(false);
  }, [downloadBusy]);

  const handleDownloadAtQuality = useCallback(async (quality: AudioQuality) => {
    if (!currentSong || downloadBusy) return;
    setDownloadBusy(true);
    try {
      await downloadSongAtQuality({
        songId: currentSong.id,
        quality,
        artists: currentSong.artists,
        name: currentSong.name
      });
      showNotice(`已开始下载（${quality}）`);
      setDownloadMenuOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : '下载失败，请稍后重试';
      showNotice(message);
    } finally {
      setDownloadBusy(false);
    }
  }, [currentSong, downloadBusy, showNotice]);

  const handleImportPlaylist = useCallback(async () => {
    if (importBusy) return;
    const playlistId = extractPlaylistId(importUrl);
    if (!playlistId) {
      showNotice('请输入有效的歌单链接或 ID');
      return;
    }
    setImportBusy(true);
    try {
      const info = await fetchPlaylist(playlistId);
      clearPlaylist();
      for (const song of info.songs) {
        addToPlaylist(song);
      }
      showNotice(`已导入「${info.name}」共 ${info.songs.length} 首歌曲`);
      setImportOpen(false);
      setImportUrl('');
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败，请稍后重试';
      // eslint-disable-next-line no-console
      console.error('[ImportPlaylist] Error:', err);
      showNotice(message);
    } finally {
      setImportBusy(false);
    }
  }, [importUrl, importBusy, showNotice, clearPlaylist, addToPlaylist]);

  const handleExportPlaylist = useCallback(() => {
    if (playlist.length === 0) {
      showNotice('当前播放列表为空，无需导出');
      return;
    }
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        songs: playlist
      };
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .slice(0, 19);
      const link = document.createElement('a');
      link.href = url;
      link.download = `playlist-${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showNotice(`已导出 ${playlist.length} 首歌曲`);
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败，请稍后重试';
      setFatalError(message);
    }
  }, [playlist, showNotice]);

  const handleImportJsonFile = useCallback(
    async (file: File) => {
      if (importJsonBusy) return;
      setImportJsonBusy(true);
      try {
        const text = await file.text();
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('JSON 解析失败，请检查文件格式');
        }

        if (!isObject(parsed)) {
          throw new Error('JSON 文件格式不正确');
        }

        const songsRaw = (parsed as { songs?: unknown }).songs;
        if (!Array.isArray(songsRaw)) {
          throw new Error('JSON 中未找到 songs 数组');
        }

        const songs: Song[] = [];
        const seen = new Set<number>();
        for (const entry of songsRaw) {
          if (!isObject(entry)) continue;
          const candidate = entry as Partial<Song>;
          if (
            typeof candidate.id === 'number' &&
            typeof candidate.name === 'string' &&
            typeof candidate.artists === 'string' &&
            typeof candidate.album === 'string' &&
            typeof candidate.picUrl === 'string'
          ) {
            if (seen.has(candidate.id)) continue;
            seen.add(candidate.id);
            songs.push({
              id: candidate.id,
              name: candidate.name,
              artists: candidate.artists,
              album: candidate.album,
              picUrl: candidate.picUrl
            });
          }
        }

        if (songs.length === 0) {
          throw new Error('JSON 中没有可识别的歌曲数据');
        }

        clearPlaylist();
        for (const song of songs) {
          addToPlaylist(song);
        }
        showNotice(`已从 JSON 导入 ${songs.length} 首歌曲`);
        setImportOpen(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : '导入失败，请稍后重试';
        setFatalError(message);
      } finally {
        setImportJsonBusy(false);
        if (importFileInputRef.current) {
          importFileInputRef.current.value = '';
        }
      }
    },
    [importJsonBusy, showNotice, clearPlaylist, addToPlaylist]
  );

  const handleChangeApiSource = useCallback((source: ApiSource) => {
    if (source === apiSource) return;
    setApiSource(source);
    showNotice(`已切换至 ${source === 'main' ? 'MAIN' : 'BACKUP'} 源`);
    if (currentSong) {
      reFetchCurrentSong();
    }
  }, [apiSource, currentSong, reFetchCurrentSong, showNotice]);

  useEffect(() => {
    if (!currentSong) {
      setDownloadMenuOpen(false);
      setDownloadBusy(false);
    }
  }, [currentSong]);

  const handleShareSong = useCallback(async () => {
    if (!currentSong || typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('song', String(currentSong.id));
    const shareText = `分享给你一首好歌！链接 ${url.toString()}`;

    const copyWithFallback = async () => {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareText);
        return;
      }

      const textarea = document.createElement('textarea');
      textarea.value = shareText;
      textarea.setAttribute('readonly', 'true');
      textarea.style.position = 'absolute';
      textarea.style.left = '-9999px';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    };

    try {
      await copyWithFallback();
      showNotice('分享链接已复制到剪贴板');
    } catch {
      showNotice('复制分享链接失败');
    }
  }, [currentSong, showNotice]);
  
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
    setIsNativeApp(Capacitor.isNativePlatform());
  }, []);

  useEffect(() => {
    playSongByIdRef.current = playSongById;
  }, [playSongById]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleSongParam = () => {
      const songId = Number(new URL(window.location.href).searchParams.get('song'));
      if (!Number.isFinite(songId) || songId <= 0 || handledSharedSongRef.current === songId) return;

      handledSharedSongRef.current = songId;
      void playSongByIdRef.current(songId);
    };

    handleSongParam();
    window.addEventListener('popstate', handleSongParam);

    return () => {
      window.removeEventListener('popstate', handleSongParam);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentSong) return;

    const url = new URL(window.location.href);
    url.searchParams.set('song', String(currentSong.id));
    handledSharedSongRef.current = currentSong.id;
    window.history.replaceState({}, '', url.toString());
  }, [currentSong?.id]);

  useEffect(() => {
    setMobileLyricsOpen(false);
  }, [currentSong?.id]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!Capacitor.isNativePlatform()) return;

    const appBody = document.body;
    appBody.classList.add('immersive-shell');

    return () => {
      appBody.classList.remove('immersive-shell');
    };
  }, []);

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
        style={liquidFlow ? { transform: `translate3d(${(offsetX * 24).toFixed(2)}px, ${(offsetY * 24).toFixed(2)}px, 0)` } : undefined}
      >
        {bgImage ? (
          <FluidBackground album={bgImage} playing={isPlaying} />
        ) : (
          <div className="bg-layer-static" />
        )}
      </div>
      <div className="bg-overlay" />
      
      <div className="main-layout">
        <Sidebar currentView={currentView} onViewChange={setCurrentView} />
        
        <main className="main-content">
          <header className="top-bar glass">
            <SearchBar
              onSongSelect={handlePlaySong}
              localSource={currentView === 'library' ? playlist : undefined}
            />
            <SourceSwitcher
              value={apiSource}
              onChange={handleChangeApiSource}
              size="compact"
              className="top-bar-source-switcher"
            />
            <button
              className="details-btn details-btn-mobile-inline"
              onClick={() => setDetailsOpen(true)}
              type="button"
              aria-label="项目详情"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </button>
            <button
              className="icon-btn playlist-drawer-trigger"
              onClick={() => setPlaylistOpen(true)}
              type="button"
              style={{ marginLeft: 'auto' }}
            >
              <ListIcon size={22} />
            </button>
          </header>
          
          {currentView === 'library' && (
            <div className="library-page">
              <div className="library-scroll">
                <LibraryView
                  library={playlist}
                  folders={folders}
                  onPlay={handlePlaySong}
                  onPlayAll={() => {
                    if (playlist.length === 0) return;
                    void playAt(0);
                  }}
                  onRemove={(id) => {
                    const idx = playlist.findIndex((s) => s.id === id);
                    if (idx >= 0) removePlaylistItem(idx);
                    removeSongFromAllFolders(id);
                  }}
                  onClear={() => {
                    clearPlaylist();
                    clearAllFolders();
                  }}
                  onImport={() => setImportOpen(true)}
                  onCreateFolder={createFolder}
                  onRenameFolder={renameFolder}
                  onDeleteFolder={deleteFolder}
                  onAddSongToFolder={addSongToFolder}
                  onRemoveSongFromFolder={removeSongFromFolder}
                  onMoveSongToFolder={moveSongToFolder}
                  onReorderInFolder={reorderInFolder}
                />
              </div>
            </div>
          )}

          {showPlayer && currentView === 'discover' && (
            <div className="player-shell">
              <div
                className={`play-page player-main ${mobileLyricsOpen ? 'lyrics-on-bg' : ''}`}
                style={mobileLyricsOpen ? ({ ['--mobile-lyrics-blur' as any]: mobileBlurValue }) : undefined}
                onClick={handlePlayPageClick}
              >
              <div className="mobile-lyrics-bg" aria-hidden={!mobileLyricsOpen}>
                {betterStyles ? (
                  <AmllLyrics lyrics={lyric} currentTime={currentTime} duration={duration} playing={isPlaying} showTranslation={showTranslation} />
                ) : (
                  <LyricsPanel lyrics={lyric} currentTime={currentTime} variant="mobile" showTranslation={showTranslation} />
                )}
              </div>

              {isLoading && (
                <div className="loading-spinner" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
              )}

              <img
                src={normalizeMediaUrl(currentSong.picUrl) || PLACEHOLDER_COVER}
                alt={currentSong.name}
                className="album-cover album-cover-clickable"
                style={{ opacity: isLoading ? 0.3 : 1 }}
                onClick={(event) => {
                  event.stopPropagation();
                  openMobileLyrics();
                }}
                onError={(event) => {
                  const target = event.currentTarget;
                  if (target.src !== PLACEHOLDER_COVER) {
                    target.src = PLACEHOLDER_COVER;
                  }
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
                onShare={handleShareSong}
                showShare={!isNativeApp && Boolean(currentSong)}
                onDownload={handleDownloadClick}
                showDownload={Boolean(currentSong)}
                onCyclePlayMode={cyclePlayMode}
                onAudioQualityChange={setAudioQuality}
                onVolumeChange={setVolume}
                showTranslationToggle={hasTranslation}
                showTranslation={showTranslation}
                onToggleTranslation={handleToggleTranslation}
              />

              {notice && <div className="player-notice">{notice}</div>}
              </div>

              <aside className="desktop-lyrics-pane">
                {betterStyles ? (
                  <AmllLyrics lyrics={lyric} currentTime={currentTime} duration={duration} playing={isPlaying} showTranslation={showTranslation} />
                ) : (
                  <LyricsPanel lyrics={lyric} currentTime={currentTime} variant="desktop" showTranslation={showTranslation} />
                )}
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
        onClearPlaylist={clearPlaylist}
        onRemoveItems={removePlaylistItems}
        onImport={() => setImportOpen(true)}
        onExport={handleExportPlaylist}
      />

      <DownloadMenu
        isOpen={downloadMenuOpen}
        anchorRect={downloadMenuAnchor}
        defaultQuality={audioQuality}
        busy={downloadBusy}
        onSelect={handleDownloadAtQuality}
        onClose={handleCloseDownloadMenu}
      />

      <button
        className="details-btn details-btn-desktop-fixed"
        onClick={() => setDetailsOpen(true)}
        type="button"
        aria-label="项目详情"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {importOpen && (
        <div className="details-overlay" role="dialog" aria-modal="true" onClick={() => setImportOpen(false)}>
          <section className="details-card glass-strong import-card" onClick={(event) => event.stopPropagation()}>
            <button className="details-close" onClick={() => setImportOpen(false)} type="button">
              关闭
            </button>

            <h2 className="details-title">导入播放列表</h2>
            <p className="details-subtitle">通过歌单链接或 JSON 文件导入，导入时会清空当前列表</p>

            <h3 className="import-section-title">从网易云歌单导入</h3>
            <div className="import-field">
              <input
                className="import-input"
                type="text"
                placeholder="https://music.163.com/m/playlist?id=..."
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleImportPlaylist();
                  }
                }}
              />
              <button
                className="import-btn"
                onClick={() => void handleImportPlaylist()}
                disabled={importBusy}
                type="button"
              >
                {importBusy ? (
                  <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <ImportIcon size={16} />
                    导入
                  </>
                )}
              </button>
            </div>

            <div className="import-divider">
              <span>或</span>
            </div>

            <h3 className="import-section-title">从 JSON 文件导入</h3>
            <p className="import-hint">选择之前导出的 JSON 文件，将覆盖当前列表</p>
            <input
              ref={importFileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportJsonFile(file);
                }
              }}
            />
            <div className="import-field">
              <button
                className="import-btn import-btn-wide"
                onClick={() => importFileInputRef.current?.click()}
                disabled={importJsonBusy}
                type="button"
              >
                {importJsonBusy ? (
                  <span className="loading-spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                ) : (
                  <>
                    <UploadIcon size={16} />
                    选择 JSON 文件
                  </>
                )}
              </button>
            </div>
          </section>
        </div>
      )}

      {detailsOpen && (
        <div className="details-overlay" role="dialog" aria-modal="true" onClick={() => setDetailsOpen(false)}>
          <section
            className="details-card glass-strong details-card-about details-card-about-mini"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="details-close" onClick={() => setDetailsOpen(false)} type="button">
              关闭
            </button>

            <div className="about-mini">
              <h2
                className="about-mini-title about-mini-title-clickable"
                onClick={handleTitleClick}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    handleTitleClick();
                  }
                }}
                aria-label="BawMusic - 连续点击 5 次解锁开发者模式"
              >
                BawMusic
              </h2>
              <p className="about-mini-desc">一个极简的在线音乐播放器</p>
              <p className="about-mini-author">作者：Han5N</p>
              <button
                type="button"
                className="about-mini-version about-mini-version-clickable"
                aria-label="查看更新日志"
                onClick={() => {
                  setDetailsOpen(false);
                  setChangelogOpen(true);
                }}
              >
                {build.sha} · {new Date(build.date).toLocaleString('zh-CN', { hour12: false })}
              </button>
              {devHydrated && devUnlocked && (
                <button
                  type="button"
                  className="dev-menu-button"
                  onClick={() => {
                    setDetailsOpen(false);
                    setDevMenuOpen(true);
                  }}
                >
                  DevMenu
                </button>
              )}
              {liquidFlowHydrated && isMobile && (
                <button
                  type="button"
                  className={`about-mini-toggle ${liquidFlow ? 'active' : ''}`}
                  onClick={() => void handleToggleLiquidFlow()}
                >
                  <span className="about-mini-toggle-label">LiquidFlow Styles</span>
                  <span className={`about-mini-toggle-switch ${liquidFlow ? 'on' : ''}`} aria-hidden="true">
                    <span className="about-mini-toggle-knob" />
                  </span>
                </button>
              )}
              {betterStylesHydrated && (
                <button
                  type="button"
                  className={`about-mini-toggle ${betterStyles ? 'active' : ''}`}
                  onClick={handleToggleBetterStyles}
                >
                  <span className="about-mini-toggle-label">Better Styles (Beta)</span>
                  <span className={`about-mini-toggle-switch ${betterStyles ? 'on' : ''}`} aria-hidden="true">
                    <span className="about-mini-toggle-knob" />
                  </span>
                </button>
              )}
              <a
                className="about-mini-link"
                href="https://afdian.com/a/han5n"
                target="_blank"
                rel="noreferrer"
              >
                爱发电支持 ↗
              </a>
            </div>
          </section>
        </div>
      )}

      {changelogOpen && (
        <div
          className="details-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="更新日志"
          onClick={() => setChangelogOpen(false)}
        >
          <section
            className="details-card glass-strong details-card-changelog"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="details-close" onClick={() => setChangelogOpen(false)} type="button">
              关闭
            </button>

            <div className="changelog">
              <h2 className="changelog-title">What's New</h2>
              <p className="changelog-subtitle">
                当前版本 <code>{build.sha}</code> · {new Date(build.date).toLocaleString('zh-CN', { hour12: false })}
              </p>

              {versionsFile.versions.length === 0 ? (
                <p className="changelog-empty">暂无更新日志</p>
              ) : (
                <ul className="changelog-list">
                  {versionsFile.versions.map((entry) => {
                    const isCurrent = entry.sha === build.sha;
                    return (
                      <li
                        key={entry.sha}
                        className={`changelog-item ${isCurrent ? 'changelog-item-current' : ''}`}
                      >
                        <div className="changelog-item-head">
                          <span className="changelog-item-sha">#{entry.sha}</span>
                          <span className="changelog-item-date">
                            {new Date(entry.date).toLocaleDateString('zh-CN')}
                          </span>
                          {isCurrent && <span className="changelog-item-badge">当前</span>}
                        </div>
                        <h3 className="changelog-item-title">{entry.title}</h3>
                        <ul className="changelog-item-changes">
                          {entry.highlights.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}

      {devMenuOpen && (
        <div
          className="details-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="开发者模式菜单"
          onClick={() => setDevMenuOpen(false)}
        >
          <section
            className="details-card glass-strong details-card-devmenu"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="details-close" onClick={() => setDevMenuOpen(false)} type="button">
              关闭
            </button>

            <div className="devmenu">
              <h2 className="devmenu-title">DevMenu</h2>
              <p className="devmenu-subtitle">
                开发者模式 · 已解锁（仅本机 localStorage 持久化）
              </p>

              <h3 className="devmenu-section-title">运行时</h3>
              <ul className="devmenu-list">
                <li className="devmenu-item">
                  <span className="devmenu-item-label">构建 SHA</span>
                  <code className="devmenu-item-value">{build.sha}</code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">构建时间</span>
                  <code className="devmenu-item-value">
                    {new Date(build.date).toLocaleString('zh-CN', { hour12: false })}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">API 源</span>
                  <code className="devmenu-item-value">{apiSource}</code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">播放列表</span>
                  <code className="devmenu-item-value">
                    {playlist.length} 首
                    {currentIndex >= 0 ? ` · 当前 #${currentIndex + 1}` : ''}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">当前歌曲</span>
                  <code className="devmenu-item-value">
                    {currentSong ? `${currentSong.name} · ${currentSong.artists}` : '—'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">播放状态</span>
                  <code className="devmenu-item-value">
                    {isPlaying ? '▶ 播放中' : '⏸ 已暂停'} · {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">音量</span>
                  <code className="devmenu-item-value">{(volume * 100).toFixed(0)}%</code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">音质</span>
                  <code className="devmenu-item-value">{audioQuality}</code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">播放模式</span>
                  <code className="devmenu-item-value">{playMode}</code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">播放范围</span>
                  <code className="devmenu-item-value">
                    {playbackScope ? `文件夹内 (${playbackScope.length} 首)` : '全列表'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">运行环境</span>
                  <code className="devmenu-item-value">
                    {isNativeApp ? 'Native (Capacitor)' : 'Web'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">歌词行数</span>
                  <code className="devmenu-item-value">
                    {lyric.length} · active = {activeLyricIndex}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">错误</span>
                  <code className="devmenu-item-value">{fatalError ?? '无'}</code>
                </li>
              </ul>

              <h3 className="devmenu-section-title">环境信息</h3>
              <ul className="devmenu-list" data-devtick={devTick}>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">网络</span>
                  <code className="devmenu-item-value">
                    {typeof navigator !== 'undefined' && navigator.onLine ? '在线' : '离线'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">视口</span>
                  <code className="devmenu-item-value">
                    {typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight}` : '—'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">屏幕</span>
                  <code className="devmenu-item-value">
                    {typeof window !== 'undefined' && window.screen
                      ? `${window.screen.width}×${window.screen.height} · DPR=${window.devicePixelRatio}`
                      : '—'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">UA</span>
                  <code className="devmenu-item-value">
                    {typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 80) : '—'}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">历史记录</span>
                  <code className="devmenu-item-value">
                    {(() => {
                      if (typeof window === 'undefined') return '—';
                      try {
                        const raw = window.localStorage.getItem('bawmusic:play-history');
                        const n = raw ? (JSON.parse(raw) as unknown[]).length : 0;
                        return `${n} 条`;
                      } catch { return '—'; }
                    })()}
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">文件夹</span>
                  <code className="devmenu-item-value">
                    {folders.length} 个 · 共 {folders.reduce((s, f) => s + f.songIds.length, 0)} 首
                  </code>
                </li>
                <li className="devmenu-item">
                  <span className="devmenu-item-label">存储占用</span>
                  <code className="devmenu-item-value">
                    {(() => {
                      if (typeof window === 'undefined') return '—';
                      try {
                        let bytes = 0;
                        for (let i = 0; i < window.localStorage.length; i++) {
                          const k = window.localStorage.key(i);
                          if (!k) continue;
                          const v = window.localStorage.getItem(k) ?? '';
                          bytes += k.length + v.length;
                        }
                        return `${(bytes / 1024).toFixed(1)} KB`;
                      } catch { return '—'; }
                    })()}
                  </code>
                </li>
              </ul>

              <h3 className="devmenu-section-title">快速操作</h3>
              <div className="devmenu-tools">
                <label className="devmenu-field">
                  <span className="devmenu-field-label">跳转秒数</span>
                  <div className="devmenu-field-row">
                    <input
                      className="devmenu-input"
                      type="number"
                      min={0}
                      step={1}
                      placeholder="如 60"
                      value={devSeekInput}
                      onChange={(e) => setDevSeekInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDevSeek(); }}
                    />
                    <button type="button" className="devmenu-action devmenu-action-sm" onClick={handleDevSeek}>跳转</button>
                  </div>
                </label>
                <label className="devmenu-field">
                  <span className="devmenu-field-label">列表索引</span>
                  <div className="devmenu-field-row">
                    <input
                      className="devmenu-input"
                      type="number"
                      min={1}
                      step={1}
                      placeholder={`1-${playlist.length || 1}`}
                      value={devJumpIndex}
                      onChange={(e) => setDevJumpIndex(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleDevJump(); }}
                    />
                    <button type="button" className="devmenu-action devmenu-action-sm" onClick={handleDevJump}>播放</button>
                  </div>
                </label>
              </div>

              <div className="devmenu-actions">
                <button
                  type="button"
                  className="devmenu-action"
                  onClick={() => { reFetchCurrentSong(); showNotice('已重新加载当前歌曲'); }}
                >
                  重载当前歌
                </button>
                <button
                  type="button"
                  className="devmenu-action"
                  onClick={handleDevCopySongId}
                >
                  复制歌曲 ID
                </button>
                <button
                  type="button"
                  className="devmenu-action"
                  onClick={handleDevExportPlaylist}
                >
                  导出列表 JSON
                </button>
                <button
                  type="button"
                  className="devmenu-action"
                  onClick={() => {
                    try {
                      navigator.clipboard?.writeText(
                        JSON.stringify(
                          {
                            sha: build.sha,
                            date: build.date,
                            apiSource,
                            playlistLength: playlist.length,
                            currentIndex,
                            currentSong: currentSong
                              ? {
                                  id: currentSong.id,
                                  name: currentSong.name,
                                  artists: currentSong.artists
                                }
                              : null,
                            isPlaying,
                            currentTime,
                            duration,
                            volume,
                            audioQuality,
                            playMode,
                            isNativeApp,
                            lyricCount: lyric.length,
                            activeLyricIndex
                          },
                          null,
                          2
                        )
                      );
                      showNotice('调试信息已复制到剪贴板');
                    } catch {
                      showNotice('剪贴板不可用');
                    }
                  }}
                >
                  复制调试快照
                </button>
                <button
                  type="button"
                  className="devmenu-action devmenu-action-danger"
                  onClick={() => {
                    if (typeof window === 'undefined') return;
                    const ok = window.confirm('确认清除本地存储？将注销登录态、API 源偏好和开发者模式解锁。');
                    if (!ok) return;
                    try {
                      window.localStorage.clear();
                    } catch {
                      /* 忽略 */
                    }
                    setDevUnlocked(false);
                    setDevMenuOpen(false);
                    showNotice('本地存储已清除');
                  }}
                >
                  清除 localStorage
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
