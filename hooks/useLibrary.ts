'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Song } from '@/types/music';

const STORAGE_LIBRARY_KEY = 'bawmusic:library';

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

interface UseLibraryReturn {
  library: Song[];
  hydrated: boolean;
  isInLibrary: (id: number) => boolean;
  addToLibrary: (song: Song) => void;
  removeFromLibrary: (id: number) => void;
  clearLibrary: () => void;
}

/**
 * 独立音乐库：与播放队列（usePlayer.playlist）解耦的持久化曲库。
 * 搜索到的歌曲可加入音乐库；音乐库内的歌曲可点击播放（会加入播放队列），
 * 但移除/清空音乐库不影响当前播放。
 */
export function useLibrary(): UseLibraryReturn {
  const [library, setLibrary] = useState<Song[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // 读取 localStorage（仅客户端，SSR 安全）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem(STORAGE_LIBRARY_KEY);
      if (stored) {
        const parsed: unknown = JSON.parse(stored);
        if (isSongList(parsed)) {
          // 去重保序
          const seen = new Set<number>();
          const deduped = parsed.filter((s) => {
            if (seen.has(s.id)) return false;
            seen.add(s.id);
            return true;
          });
          setLibrary(deduped);
        }
      }
    } catch {
      /* 忽略：隐私模式/Storage 不可用或数据损坏 */
    }
    setHydrated(true);
  }, []);

  // 持久化
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(library));
    } catch {
      /* 忽略 */
    }
  }, [library, hydrated]);

  const isInLibrary = useCallback(
    (id: number) => library.some((s) => s.id === id),
    [library]
  );

  const addToLibrary = useCallback((song: Song) => {
    setLibrary((prev) => {
      if (prev.some((s) => s.id === song.id)) return prev;
      return [song, ...prev];
    });
  }, []);

  const removeFromLibrary = useCallback((id: number) => {
    setLibrary((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearLibrary = useCallback(() => {
    setLibrary([]);
  }, []);

  return { library, hydrated, isInLibrary, addToLibrary, removeFromLibrary, clearLibrary };
}
