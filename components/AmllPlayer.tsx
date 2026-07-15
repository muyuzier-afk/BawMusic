'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { LyricLine as AmllLyricLine } from '@applemusic-like-lyrics/core';
import type { MusicInfo, LyricLine, AudioQuality } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { ProgressBar } from '@/components/ProgressBar';
import { PlaybackControls } from '@/components/PlaybackControls';

// AMLL core 依赖 PIXI/DOM，仅客户端运行；关闭 SSR 避免水合错乱。
const LyricPlayer = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.LyricPlayer),
  { ssr: false }
);
const BackgroundRender = dynamic(
  () => import('@applemusic-like-lyrics/react').then((m) => m.BackgroundRender),
  { ssr: false }
);

type PlayMode = 'list' | 'shuffle' | 'single';

interface AmllPlayerProps {
  currentSong: MusicInfo;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  lyric: LyricLine[];
  volume: number;
  playMode: PlayMode;
  audioQuality: AudioQuality;
  notice: string | null;
  isLoading: boolean;
  isNativeApp: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onCyclePlayMode: () => void;
  onAudioQualityChange: (q: AudioQuality) => void;
  onShare?: () => void;
  onDownload?: (e: React.MouseEvent<HTMLButtonElement>) => void;
}

/** 将项目行级 LyricLine（秒）映射为 AMLL 结构（毫秒）。 */
function adaptLyrics(lyrics: LyricLine[]): AmllLyricLine[] {
  if (lyrics.length === 0) return [];
  return lyrics.map((line, i) => {
    const startTime = Math.round(line.time * 1000);
    const nextStart = i + 1 < lyrics.length ? Math.round(lyrics[i + 1].time * 1000) : startTime + 4000;
    const endTime = Math.max(nextStart, startTime + 1);
    return {
      words: [{ startTime, endTime, word: line.text }],
      translatedLyric: line.translation ?? '',
      romanLyric: '',
      startTime,
      endTime,
      isBG: false,
      isDuet: false,
    };
  });
}

export function AmllPlayer(props: AmllPlayerProps) {
  const {
    currentSong, isPlaying, currentTime, duration, lyric, volume, playMode,
    audioQuality, notice, isLoading, isNativeApp,
    onTogglePlay, onNext, onPrev, onSeek, onVolumeChange, onCyclePlayMode,
    onAudioQualityChange, onShare, onDownload,
  } = props;

  const albumUrl = normalizeMediaUrl(currentSong.picUrl) || PLACEHOLDER_COVER;
  const adaptedLines = useMemo(() => adaptLyrics(lyric), [lyric]);
  const currentTimeMs = Math.max(0, Math.round(currentTime * 1000));

  return (
    <div className="amll-player">
      {/* AMLL 流体背景 */}
      <div className="amll-player-bg">
        <BackgroundRender
          album={albumUrl}
          playing={isPlaying}
          hasLyric={adaptedLines.length > 0}
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>
      <div className="amll-player-overlay" />

      {/* AMLL 歌词层（整页铺满，左侧靠左 / 桌面右侧；移动端居中） */}
      <div className="amll-player-lyrics">
        <LyricPlayer
          lyricLines={adaptedLines}
          currentTime={currentTimeMs}
          playing={isPlaying}
          enableSpring
          enableBlur
          enableScale
          alignAnchor="center"
          alignPosition={0.4}
          linePosYSpringParams={{ mass: 1, stiffness: 300, damping: 40 }}
          style={{ position: 'absolute', inset: 0 }}
        />
      </div>

      {/* 底部控制栏 + 歌曲信息（浮于 AMLL 背景与歌词之上） */}
      <div className="amll-player-bottom">
        {isLoading && <div className="amll-player-loading">加载中…</div>}
        <div className="amll-player-songinfo">
          <div className="amll-player-title">{currentSong.name}</div>
          <div className="amll-player-artist">{currentSong.artists}{currentSong.album ? ` - ${currentSong.album}` : ''}</div>
        </div>
        <ProgressBar currentTime={currentTime} duration={duration} onSeek={onSeek} />
        <PlaybackControls
          isPlaying={isPlaying}
          playMode={playMode}
          audioQuality={audioQuality}
          volume={volume}
          onTogglePlay={onTogglePlay}
          onNext={onNext}
          onPrev={onPrev}
          onShare={onShare}
          showShare={!isNativeApp}
          onDownload={onDownload}
          showDownload
          onCyclePlayMode={onCyclePlayMode}
          onAudioQualityChange={onAudioQualityChange}
          onVolumeChange={onVolumeChange}
        />
        {notice && <div className="amll-player-notice">{notice}</div>}
      </div>
    </div>
  );
}
