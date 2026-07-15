'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Song } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import type { LibraryFolder } from '@/hooks/useLibraryFolders';

interface LibraryViewProps {
  library: Song[];
  folders: LibraryFolder[];
  onPlay: (song: Song) => void;
  onPlayAll: () => void;
  onRemove: (id: number) => void;
  onClear: () => void;
  onImport: () => void;
  onCreateFolder: (songIds: number[], name?: string) => string;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  onAddSongToFolder: (folderId: string, songId: number) => void;
  onRemoveSongFromFolder: (folderId: string, songId: number) => void;
  onMoveSongToFolder: (fromFolderId: string | null, toFolderId: string | null, songId: number) => void;
}

const LONG_PRESS_MS = 320;
const MOVE_CANCEL_PX = 10;

interface DragGhost {
  song: Song;
  x: number;
  y: number;
}

interface PendingDrag {
  songId: number;
  fromFolderId: string | null;
  song: Song;
  pointerId: number;
  startX: number;
  startY: number;
  card: HTMLElement;
}

interface ActiveDrag {
  songId: number;
  fromFolderId: string | null;
  song: Song;
  pointerId: number;
  card: HTMLElement;
}

type DropTarget =
  | { kind: 'song'; songId: number }
  | { kind: 'folder'; folderId: string }
  | { kind: 'outside' }
  | null;

function findFolderOf(folders: LibraryFolder[], songId: number): string | null {
  const f = folders.find((fol) => fol.songIds.includes(songId));
  return f ? f.id : null;
}

function buildCoverUrl(picUrl: string | undefined): string {
  return normalizeMediaUrl(picUrl) || PLACEHOLDER_COVER;
}

/**
 * 音乐库视图：CD 网格 + 文件夹。
 * 长按一首歌拖到另一首歌上 → 自动创建文件夹；拖到文件夹上 → 加入该文件夹。
 */
export function LibraryView({
  library,
  folders,
  onPlay,
  onPlayAll,
  onRemove,
  onClear,
  onImport,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  onAddSongToFolder,
  onRemoveSongFromFolder,
  onMoveSongToFolder
}: LibraryViewProps) {
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // 拖拽状态
  const [ghost, setGhost] = useState<DragGhost | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget>(null);
  const pendingRef = useRef<PendingDrag | null>(null);
  const activeRef = useRef<ActiveDrag | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasDraggingRef = useRef(false);
  const prevBodyOverflow = useRef<string>('');
  const bodyLockedRef = useRef(false);

  const clearDrag = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pendingRef.current = null;
    const active = activeRef.current;
    if (active?.card) {
      try { active.card.releasePointerCapture(active.pointerId); } catch { /* ignore */ }
    }
    activeRef.current = null;
    setGhost(null);
    setDropTarget(null);
    if (bodyLockedRef.current) {
      try {
        document.body.style.overflow = prevBodyOverflow.current;
      } catch { /* ignore */ }
      bodyLockedRef.current = false;
      prevBodyOverflow.current = '';
    }
  }, []);

  useEffect(() => () => clearDrag(), [clearDrag]);

  // 阻止库内长按弹出的浏览器原生菜单（保存图片等）
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    document.addEventListener('contextmenu', prevent);
    return () => document.removeEventListener('contextmenu', prevent);
  }, []);

  // 文件夹被删除时，若正在浏览它则退出
  useEffect(() => {
    if (openFolderId && !folders.some((f) => f.id === openFolderId)) {
      setOpenFolderId(null);
    }
  }, [openFolderId, folders]);

  // 落点检测
  const detectDropTarget = useCallback((x: number, y: number): DropTarget => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null;
    if (!el) return null;
    const folderCard = el.closest('[data-drop-folder]') as HTMLElement | null;
    if (folderCard) {
      const fid = folderCard.dataset.dropFolder;
      if (fid && activeRef.current && !folders.find((f) => f.id === fid)?.songIds.includes(activeRef.current.songId)) {
        return { kind: 'folder', folderId: fid };
      }
    }
    const songCard = el.closest('[data-drop-song]') as HTMLElement | null;
    if (songCard) {
      const sid = Number(songCard.dataset.dropSong);
      if (activeRef.current && sid && sid !== activeRef.current.songId) {
        return { kind: 'song', songId: sid };
      }
    }
    return { kind: 'outside' };
  }, [folders]);

  const handlePointerDown = useCallback((song: Song, fromFolderId: string | null, e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const card = e.currentTarget;
    pendingRef.current = {
      songId: song.id,
      fromFolderId,
      song,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      card
    };
    try { card.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => {
      const p = pendingRef.current;
      if (!p) return;
      activeRef.current = {
        songId: p.songId,
        fromFolderId: p.fromFolderId,
        song: p.song,
        pointerId: p.pointerId,
        card: p.card
      };
      pendingRef.current = null;
      setGhost({ song: p.song, x: p.startX, y: p.startY });
      p.card.classList.add('library-card-dragging');
      // 锁定页面滚动，避免拖拽时移动端列表跟着滚
      try {
        prevBodyOverflow.current = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        bodyLockedRef.current = true;
      } catch { /* ignore */ }
    }, LONG_PRESS_MS);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const p = pendingRef.current;
    if (p) {
      const dx = e.clientX - p.startX;
      const dy = e.clientY - p.startY;
      if (Math.abs(dx) > MOVE_CANCEL_PX || Math.abs(dy) > MOVE_CANCEL_PX) {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        pendingRef.current = null;
        try { p.card.releasePointerCapture(p.pointerId); } catch { /* ignore */ }
      }
      return;
    }
    const active = activeRef.current;
    if (active && active.pointerId === e.pointerId) {
      setGhost({ song: active.song, x: e.clientX, y: e.clientY });
      setDropTarget(detectDropTarget(e.clientX, e.clientY));
    }
  }, [detectDropTarget]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const active = activeRef.current;
    if (active && active.pointerId === e.pointerId) {
      wasDraggingRef.current = true;
      const target = detectDropTarget(e.clientX, e.clientY);
      active.card.classList.remove('library-card-dragging');
      if (target?.kind === 'song') {
        const targetFolder = findFolderOf(folders, target.songId);
        const dragFolder = active.fromFolderId;
        if (targetFolder === dragFolder && dragFolder !== null) {
          // 已在同文件夹，忽略
        } else if (targetFolder) {
          onAddSongToFolder(targetFolder, active.songId);
        } else {
          // 两首散落歌 → 创建新文件夹
          onCreateFolder([active.songId, target.songId]);
        }
      } else if (target?.kind === 'folder') {
        onAddSongToFolder(target.folderId, active.songId);
      } else if (target?.kind === 'outside' && active.fromFolderId !== null) {
        // 从文件夹拖到空白 → 移出文件夹
        onMoveSongToFolder(active.fromFolderId, null, active.songId);
      }
      clearDrag();
      return;
    }
    // 未进入拖拽态：清理 pending
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    pendingRef.current = null;
  }, [detectDropTarget, folders, onAddSongToFolder, onCreateFolder, onMoveSongToFolder, clearDrag]);

  const handleCardClick = useCallback((song: Song) => {
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false;
      return;
    }
    onPlay(song);
  }, [onPlay]);

  const startRename = useCallback((folder: LibraryFolder) => {
    setEditingFolderId(folder.id);
    setEditingName(folder.name);
  }, []);

  const commitRename = useCallback(() => {
    if (editingFolderId) {
      onRenameFolder(editingFolderId, editingName);
    }
    setEditingFolderId(null);
    setEditingName('');
  }, [editingFolderId, editingName, onRenameFolder]);

  const handleDeleteFolder = useCallback((folder: LibraryFolder) => {
    if (window.confirm(`删除文件夹「${folder.name}」？文件夹内的歌曲会保留在音乐库。`)) {
      onDeleteFolder(folder.id);
      if (openFolderId === folder.id) setOpenFolderId(null);
    }
  }, [onDeleteFolder, openFolderId]);

  const songMap = useRef<Map<number, Song>>(new Map());
  songMap.current = new Map(library.map((s) => [s.id, s]));

  const folderedIds = new Set<number>();
  for (const f of folders) for (const id of f.songIds) folderedIds.add(id);
  const looseSongs = library.filter((s) => !folderedIds.has(s.id));

  // 文件夹卡片封面：取前 4 首
  const renderFolderCover = useCallback((folder: LibraryFolder) => {
    const songs = folder.songIds.map((id) => songMap.current.get(id)).filter(Boolean) as Song[];
    const covers = songs.slice(0, 4);
    while (covers.length < 4 && covers.length > 0) covers.push(covers[0]);
    if (covers.length === 0) {
      return (
        <div className="library-folder-cover library-folder-cover-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </svg>
        </div>
      );
    }
    return (
      <div className="library-folder-cover library-folder-cover-grid">
        {covers.map((s, i) => (
          <img
            key={`${s.id}-${i}`}
            src={buildCoverUrl(s.picUrl)}
            alt=""
            loading="lazy"
            draggable={false}
            onError={(ev) => { if (ev.currentTarget.src !== PLACEHOLDER_COVER) ev.currentTarget.src = PLACEHOLDER_COVER; }}
          />
        ))}
      </div>
    );
  }, []);

  // 单张歌曲 CD 卡片
  const renderSongCard = useCallback((song: Song, fromFolderId: string | null, opts?: { onRemoveLabel?: string; onRemoveAction?: () => void }) => {
    const isDropSong = dropTarget?.kind === 'song' && dropTarget.songId === song.id;
    return (
      <div
        className={`library-card${isDropSong ? ' library-card-drop-hover' : ''}`}
        data-drop-song={song.id}
        onClick={() => handleCardClick(song)}
        onPointerDown={(e) => handlePointerDown(song, fromFolderId, e)}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div className="library-card-cover">
          <img
            src={buildCoverUrl(song.picUrl)}
            alt={song.name}
            loading="lazy"
            draggable={false}
            onError={(event) => {
              const target = event.currentTarget;
              if (target.src !== PLACEHOLDER_COVER) target.src = PLACEHOLDER_COVER;
            }}
          />
          <div className="library-card-play">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <button
            className="library-card-remove"
            type="button"
            aria-label={opts?.onRemoveLabel || '从音乐库移除'}
            onClick={(event) => {
              event.stopPropagation();
              if (opts?.onRemoveAction) opts.onRemoveAction();
              else onRemove(song.id);
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {opts?.onRemoveAction
                ? <path d="M9 18l6-6-6-6" />
                : <path d="M18 6L6 18M6 6l12 12" />}
            </svg>
          </button>
        </div>
        <div className="library-card-name">{song.name}</div>
        <div className="library-card-artist">{song.artists}</div>
      </div>
    );
  }, [dropTarget, handleCardClick, handlePointerDown, handlePointerMove, handlePointerUp, onRemove]);

  // 空状态
  if (library.length === 0 && folders.length === 0) {
    return (
      <div className="library-empty">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l4 .5-2 15-4-.5z" />
        </svg>
        <div className="library-empty-title">音乐库是空的</div>
        <div className="library-empty-hint">在「发现」搜索歌曲即可加入音乐库，或导入网易云歌单；长按拖拽歌曲可创建文件夹</div>
        <button className="library-empty-btn" onClick={onImport}>导入歌单</button>
      </div>
    );
  }

  // 文件夹内部视图
  if (openFolderId) {
    const folder = folders.find((f) => f.id === openFolderId);
    if (folder) {
      const songs = folder.songIds.map((id) => songMap.current.get(id)).filter(Boolean) as Song[];
      const isEditing = editingFolderId === folder.id;
      const isDropFolder = dropTarget?.kind === 'folder' && dropTarget.folderId === folder.id;
      return (
        <div className="library-view">
          <div className="library-folder-bar">
            <button className="library-folder-back" type="button" onClick={() => setOpenFolderId(null)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              返回音乐库
            </button>
            <div className="library-folder-title">
              {isEditing ? (
                <input
                  className="library-folder-name-input"
                  value={editingName}
                  autoFocus
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') { setEditingFolderId(null); setEditingName(''); }
                  }}
                />
              ) : (
                <span
                  className="library-folder-name"
                  title="点击重命名"
                  onClick={() => startRename(folder)}
                >
                  {folder.name}
                </span>
              )}
              <span className="library-header-count">{songs.length} 首歌曲</span>
            </div>
            <div className="library-header-actions">
              {songs.length > 0 && (
                <button className="library-action" onClick={() => onPlay(songs[0])}>播放全部</button>
              )}
              <button className="library-action" onClick={() => startRename(folder)}>重命名</button>
              <button className="library-action library-action-danger" onClick={() => handleDeleteFolder(folder)}>删除文件夹</button>
            </div>
          </div>

          {songs.length === 0 ? (
            <div className="library-empty">
              <div className="library-empty-title">文件夹是空的</div>
              <div className="library-empty-hint">从音乐库长按拖拽歌曲到该文件夹，或在音乐库将歌曲移入</div>
            </div>
          ) : (
            <div className={`library-grid library-grid-zone${isDropFolder ? ' library-grid-zone-active' : ''}`} data-drop-folder={folder.id}>
              {songs.map((song) => renderSongCard(song, folder.id, {
                onRemoveLabel: '移出文件夹',
                onRemoveAction: () => onRemoveSongFromFolder(folder.id, song.id)
              }))}
            </div>
          )}
        </div>
      );
    }
  }

  // 根视图
  return (
    <div className="library-view">
      <div className="library-header">
        <div className="library-header-info">
          <div className="library-header-title">音乐库</div>
          <div className="library-header-count">
            {library.length} 首歌曲{folders.length > 0 ? ` · ${folders.length} 个文件夹` : ''}
          </div>
        </div>
        <div className="library-header-actions">
          <button className="library-action" onClick={onPlayAll} disabled={library.length === 0}>播放全部</button>
          <button className="library-action" onClick={onImport}>导入歌单</button>
          <button className="library-action library-action-danger" onClick={onClear} disabled={library.length === 0}>清空</button>
        </div>
      </div>

      <div className="library-hint">
        提示：长按一首歌拖到另一首歌上可创建文件夹，拖到文件夹上可加入该文件夹
      </div>

      <div className="library-grid">
        {folders.map((folder) => {
          const count = folder.songIds.filter((id) => songMap.current.has(id)).length;
          const isDropFolder = dropTarget?.kind === 'folder' && dropTarget.folderId === folder.id;
          return (
            <div
              key={folder.id}
              className={`library-card library-folder-card${isDropFolder ? ' library-card-drop-hover' : ''}`}
              data-drop-folder={folder.id}
              onClick={() => setOpenFolderId(folder.id)}
            >
              {renderFolderCover(folder)}
              <div className="library-card-name">{folder.name}</div>
              <div className="library-card-artist">{count} 首歌曲</div>
              <button
                className="library-card-remove"
                type="button"
                aria-label="删除文件夹"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteFolder(folder);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
        {looseSongs.map((song) => renderSongCard(song, null))}
      </div>

      {/* 拖拽 ghost */}
      {ghost && (
        <div
          className="library-drag-ghost"
          style={{ left: ghost.x, top: ghost.y }}
          aria-hidden
        >
          <img src={buildCoverUrl(ghost.song.picUrl)} alt="" />
        </div>
      )}
    </div>
  );
}
