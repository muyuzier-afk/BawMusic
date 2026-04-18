import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { CapacitorMusicControls } from 'capacitor-music-controls-plugin';
import { normalizeMediaUrl } from '@/lib/media';

export interface MediaControlTrack {
  title: string;
  artist: string;
  album: string;
  cover: string;
  duration: number;
  elapsed: number;
  isPlaying: boolean;
}

export interface MediaControlHandlers {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSeekTo?: (time: number) => void;
}

type MediaSessionAction =
  | 'play'
  | 'pause'
  | 'previoustrack'
  | 'nexttrack'
  | 'seekto';

type MediaSessionActionDetails = {
  seekTime?: number;
};

type MediaMetadataInit = {
  title?: string;
  artist?: string;
  album?: string;
  artwork?: Array<{
    src: string;
    sizes?: string;
    type?: string;
  }>;
};

type BrowserMediaSession = {
  metadata: unknown;
  playbackState: 'none' | 'paused' | 'playing';
  setActionHandler: (
    action: MediaSessionAction,
    handler: ((details: MediaSessionActionDetails) => void) | null
  ) => void;
  setPositionState?: (state: {
    duration?: number;
    playbackRate?: number;
    position?: number;
  }) => void;
};

function getBrowserMediaSession(): BrowserMediaSession | null {
  if (typeof navigator === 'undefined') return null;
  return ('mediaSession' in navigator ? (navigator as Navigator & { mediaSession?: BrowserMediaSession }).mediaSession : null) ?? null;
}

let nativeListenerBound = false;
let lastTrackFingerprint = '';

function isNativeApp() {
  return Capacitor.isNativePlatform();
}

function getTrackFingerprint(track: MediaControlTrack) {
  return [track.title, track.artist, track.album, track.cover].join('::');
}

function normalizeCover(cover: string) {
  const trimmed = normalizeMediaUrl(cover);
  if (trimmed) return trimmed;
  return 'favicon.ico';
}

function bindBrowserMediaSession(track: MediaControlTrack, handlers: MediaControlHandlers) {
  const mediaSession = getBrowserMediaSession();
  if (!mediaSession) return;

  const MediaMetadataCtor = typeof globalThis !== 'undefined' && 'MediaMetadata' in globalThis
    ? (globalThis.MediaMetadata as (new (init?: MediaMetadataInit) => MediaMetadata) | undefined)
    : undefined;
  if (MediaMetadataCtor) {
    mediaSession.metadata = new MediaMetadataCtor({
      title: track.title,
      artist: track.artist,
      album: track.album,
      artwork: track.cover
        ? [
            { src: track.cover, sizes: '96x96', type: 'image/png' },
            { src: track.cover, sizes: '192x192', type: 'image/png' },
            { src: track.cover, sizes: '512x512', type: 'image/png' }
          ]
        : undefined
    });
  }

  mediaSession.playbackState = track.isPlaying ? 'playing' : 'paused';
  mediaSession.setActionHandler('play', () => handlers.onPlay());
  mediaSession.setActionHandler('pause', () => handlers.onPause());
  mediaSession.setActionHandler('previoustrack', () => handlers.onPrev());
  mediaSession.setActionHandler('nexttrack', () => handlers.onNext());
  mediaSession.setActionHandler('seekto', (details) => {
    if (typeof details.seekTime === 'number') {
      handlers.onSeekTo?.(details.seekTime);
    }
  });

  if (mediaSession.setPositionState && Number.isFinite(track.duration) && track.duration > 0) {
    mediaSession.setPositionState({
      duration: track.duration,
      playbackRate: 1,
      position: Math.min(track.elapsed, track.duration)
    });
  }
}

export async function enableImmersiveMode() {
  if (!isNativeApp()) return;

  try {
    await StatusBar.setOverlaysWebView({ overlay: true });
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.hide();
  } catch {
    // Ignore native status bar errors on unsupported platforms.
  }
}

export async function bindNativeControlListeners(handlers: MediaControlHandlers) {
  if (!isNativeApp() || nativeListenerBound || typeof document === 'undefined') return;

  nativeListenerBound = true;

  const handleAction = (message?: string, position?: number) => {
    switch (message) {
      case 'music-controls-play':
      case 'music-controls-toggle-play-pause':
        handlers.onPlay();
        break;
      case 'music-controls-pause':
        handlers.onPause();
        break;
      case 'music-controls-next':
        handlers.onNext();
        break;
      case 'music-controls-previous':
        handlers.onPrev();
        break;
      case 'music-controls-skip-to':
        if (typeof position === 'number') {
          handlers.onSeekTo?.(position);
        }
        break;
      default:
        break;
    }
  };

  document.addEventListener('controlsNotification', (event: Event) => {
    const detail = event as Event & { message?: string; position?: number };
    handleAction(detail.message, detail.position);
  });

  try {
    await CapacitorMusicControls.addListener('controlsNotification', (info: { message?: string; position?: number }) => {
      handleAction(info?.message, info?.position);
    });
  } catch {
    // Android currently relies on DOM events in this plugin; ignore listener failures.
  }
}

export async function syncMediaControls(track: MediaControlTrack, handlers: MediaControlHandlers) {
  const normalizedTrack = {
    ...track,
    cover: normalizeCover(track.cover)
  };

  bindBrowserMediaSession(normalizedTrack, handlers);

  if (!isNativeApp()) return;

  const fingerprint = getTrackFingerprint(normalizedTrack);
  if (fingerprint === lastTrackFingerprint) {
    updateMediaPlaybackState(normalizedTrack.isPlaying, normalizedTrack.elapsed, normalizedTrack.duration);
    return;
  }

  lastTrackFingerprint = fingerprint;

  await CapacitorMusicControls.create({
    track: normalizedTrack.title,
    artist: normalizedTrack.artist,
    album: normalizedTrack.album,
    cover: normalizedTrack.cover,
    duration: normalizedTrack.duration,
    elapsed: normalizedTrack.elapsed,
    isPlaying: normalizedTrack.isPlaying,
    hasPrev: true,
    hasNext: true,
    hasClose: false,
    dismissable: true,
    ticker: `正在播放 ${normalizedTrack.title}`,
    notificationIcon: 'ic_notification'
  });
}

export function updateMediaPlaybackState(isPlaying: boolean, elapsed: number, duration?: number) {
  const mediaSession = getBrowserMediaSession();
  if (mediaSession) {
    mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

    if (mediaSession.setPositionState) {
      try {
        mediaSession.setPositionState({
          duration,
          position: elapsed,
          playbackRate: 1
        });
      } catch {
        // Ignore invalid position states.
      }
    }
  }

  if (!isNativeApp()) return;

  try {
    CapacitorMusicControls.updateElapsed({ elapsed, isPlaying });
    CapacitorMusicControls.updateIsPlaying({ isPlaying });
  } catch {
    // Ignore transient native bridge failures.
  }
}

export async function clearMediaControls() {
  lastTrackFingerprint = '';

  const mediaSession = getBrowserMediaSession();
  if (mediaSession) {
    mediaSession.playbackState = 'none';
    mediaSession.metadata = null;
    mediaSession.setActionHandler('play', null);
    mediaSession.setActionHandler('pause', null);
    mediaSession.setActionHandler('previoustrack', null);
    mediaSession.setActionHandler('nexttrack', null);
    mediaSession.setActionHandler('seekto', null);
  }

  if (!isNativeApp()) return;

  try {
    await CapacitorMusicControls.destroy();
  } catch {
    // Ignore if controls were not yet created.
  }
}
