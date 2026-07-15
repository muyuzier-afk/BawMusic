'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_FOLDERS_KEY = 'bawmusic:library-folders';

export interface LibraryFolder {
  id: string;
  name: string;
  songIds: number[];
}

function genId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function isFolder(value: unknown): value is LibraryFolder {
  if (!value || typeof value !== 'object') return false;
  const f = value as Partial<LibraryFolder>;
  return typeof f.id === 'string'
    && typeof f.name === 'string'
    && Array.isArray(f.songIds)
    && f.songIds.every((id) => typeof id === 'number');
}

function isFolderList(value: unknown): value is LibraryFolder[] {
  return Array.isArray(value) && value.every(isFolder);
}

function dedupeSongIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export interface UseLibraryFoldersReturn {
  folders: LibraryFolder[];
  createFolder: (songIds: number[], name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  addSongToFolder: (folderId: string, songId: number) => void;
  removeSongFromFolder: (folderId: string, songId: number) => void;
  /** 删除音乐库歌曲时，同步清理所有文件夹中对它的引用 */
  removeSongFromAllFolders: (songId: number) => void;
  /** 清空所有文件夹（清空音乐库时调用） */
  clearAllFolders: () => void;
  /** 文件夹内重排序：把 songId 移到 targetId 之前/之后 */
  reorderInFolder: (folderId: string, songId: number, targetId: number, position: 'before' | 'after') => void;
  /**
   * 把一首歌从 fromFolderId 移到 toFolderId。
   * fromFolderId=null 表示原为散落歌曲；toFolderId=null 表示移出文件夹变散落。
   */
  moveSongToFolder: (fromFolderId: string | null, toFolderId: string | null, songId: number) => void;
}

export function useLibraryFolders(): UseLibraryFoldersReturn {
  const [folders, setFolders] = useState<LibraryFolder[]>([]);

  // 读取
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(STORAGE_FOLDERS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (isFolderList(parsed)) {
        setFolders(parsed.map((f) => ({ ...f, songIds: dedupeSongIds(f.songIds) })));
      }
    } catch {
      /* ignore */
    }
  }, []);

  // 持久化
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_FOLDERS_KEY, JSON.stringify(folders));
    } catch {
      /* ignore */
    }
  }, [folders]);

  const createFolder = useCallback((songIds: number[], name?: string): string => {
    const id = genId();
    const folder: LibraryFolder = {
      id,
      name: name?.trim() || '新建文件夹',
      songIds: dedupeSongIds(songIds)
    };
    setFolders((prev) => [...prev.filter((f) => !f.songIds.some((sid) => folder.songIds.includes(sid))), folder]);
    return id;
  }, []);

  const renameFolder = useCallback((id: string, name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name: trimmed } : f)));
  }, []);

  const deleteFolder = useCallback((id: string) => {
    setFolders((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addSongToFolder = useCallback((folderId: string, songId: number) => {
    setFolders((prev) => prev.map((f) => {
      if (f.id !== folderId) {
        // 从其它文件夹移除（一首歌只能在一个文件夹或散落）
        if (f.songIds.includes(songId)) {
          return { ...f, songIds: f.songIds.filter((sid) => sid !== songId) };
        }
        return f;
      }
      if (f.songIds.includes(songId)) return f;
      return { ...f, songIds: [...f.songIds, songId] };
    }));
  }, []);

  const removeSongFromFolder = useCallback((folderId: string, songId: number) => {
    setFolders((prev) => prev.map((f) => (
      f.id === folderId ? { ...f, songIds: f.songIds.filter((sid) => sid !== songId) } : f
    )));
  }, []);

  const removeSongFromAllFolders = useCallback((songId: number) => {
    setFolders((prev) => prev.map((f) => (
      f.songIds.includes(songId) ? { ...f, songIds: f.songIds.filter((sid) => sid !== songId) } : f
    )));
  }, []);

  const clearAllFolders = useCallback(() => {
    setFolders([]);
  }, []);

  const reorderInFolder = useCallback((folderId: string, songId: number, targetId: number, position: 'before' | 'after') => {
    if (songId === targetId) return;
    setFolders((prev) => prev.map((f) => {
      if (f.id !== folderId) return f;
      const ids = f.songIds.filter((sid) => sid !== songId);
      const targetIdx = ids.indexOf(targetId);
      if (targetIdx < 0) return f;
      const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
      const next = [...ids];
      next.splice(insertAt, 0, songId);
      return { ...f, songIds: next };
    }));
  }, []);

  const moveSongToFolder = useCallback((fromFolderId: string | null, toFolderId: string | null, songId: number) => {
    setFolders((prev) => {
      let next = prev;
      // 从源移除
      if (fromFolderId) {
        next = next.map((f) => (
          f.id === fromFolderId ? { ...f, songIds: f.songIds.filter((sid) => sid !== songId) } : f
        ));
      } else {
        // 散落 → 文件夹：从其它可能含它的文件夹移除
        next = next.map((f) => (
          f.songIds.includes(songId) ? { ...f, songIds: f.songIds.filter((sid) => sid !== songId) } : f
        ));
      }
      // 加入目标
      if (toFolderId) {
        next = next.map((f) => (
          f.id === toFolderId && !f.songIds.includes(songId)
            ? { ...f, songIds: [...f.songIds, songId] }
            : f
        ));
      }
      return next;
    });
  }, []);

  return {
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
  };
}
