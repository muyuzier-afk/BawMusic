import { getMusicInfo } from './api';
import type { AudioQuality } from '@/types/music';

const LOSS_LIKE_LEVELS = new Set(['lossless', 'hires', 'jymaster', 'sky', 'jyeffect']);
const COMPRESSED_LEVELS = new Set(['standard', 'exhigh']);

export function sanitizeFilename(name: string): string {
  const illegalChars = /[\\/:*?"<>|]/g;
  return name.replace(illegalChars, '_');
}

export function inferExtension(level: string | undefined, fallbackUrl?: string): string {
  if (level) {
    const normalized = level.toLowerCase();
    if (LOSS_LIKE_LEVELS.has(normalized)) return 'flac';
    if (COMPRESSED_LEVELS.has(normalized)) return 'mp3';
  }
  if (fallbackUrl) {
    const lower = fallbackUrl.toLowerCase();
    const match = lower.match(/\.([a-z0-9]{2,5})(?:\?|$)/);
    if (match) {
      const ext = match[1];
      if (['mp3', 'flac', 'm4a', 'ogg', 'wav', 'aac', 'opus'].includes(ext)) {
        return ext;
      }
    }
  }
  return 'mp3';
}

export function buildDownloadFilename(artists: string, name: string, ext: string): string {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'mp3';
  return `${sanitizeFilename(artists || 'Unknown Artist')} - ${sanitizeFilename(name || 'Unknown')}.${safeExt}`;
}

export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  if (!url) {
    throw new Error('Download failed: empty URL');
  }

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }

  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new Error('Download failed: empty file');
  }

  const blobUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = sanitizeFilename(filename);
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export interface DownloadSongArgs {
  songId: number;
  quality: AudioQuality;
  artists: string;
  name: string;
  onProgress?: (message: string) => void;
}

export async function downloadSongAtQuality({
  songId,
  quality,
  artists,
  name,
  onProgress
}: DownloadSongArgs): Promise<void> {
  onProgress?.('正在准备下载…');
  const info = await getMusicInfo(songId, quality);
  if (!info.url) {
    throw new Error('该音质暂不可用');
  }
  const ext = inferExtension(info.level, info.url);
  const filename = buildDownloadFilename(artists, name, ext);
  await downloadFromUrl(info.url, filename);
}
