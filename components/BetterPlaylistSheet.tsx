'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent, TouchEvent } from 'react';
import { Song } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { CloseIcon, TrashIcon, CheckIcon, ImportIcon } from './Icons';

interface BetterPlaylistSheetProps {
  isOpen: boolean;
  onClose: () => void;
  playlist: Song[];
  currentIndex: number;
  onPlayAt: (index: number) => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onRemoveItem: (index: number) => void;
  onClearPlaylist?: () => void;
  onRemoveItems?: (indices: number[]) => void;
  onImport?: () => void;
  /** 当前播放歌曲名/歌手，用于顶部当前播放卡片区 */
  currentSong?: Song | null;
  isPlaying?: boolean;
}

/**
 * Better Styles 移动端歌曲列表（仿 Apple Music「待播列表」）
 * - 从底部滑出的近全屏 sheet
 * - 顶部独立展示「正在播放」卡片
 * - 列表项左滑删除、长按拖拽排序
 * - 多选删除 / 清空确认
 * - 透明毛玻璃背景，露出液态背景
 */
export function BetterPlaylistSheet({
  isOpen,
  onClose,
  playlist,
  currentIndex,
  onPlayAt,
  onMoveItem,
  onRemoveItem,
  onClearPlaylist,
  onRemoveItems,
  onImport,
  currentSong,
  isPlaying = false,
}: BetterPlaylistSheetProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [swipingIndex, setSwipingIndex] = useState<number | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const longPressTimerRef = useRef<number | null>(null);
  const gestureModeRef = useRef<'idle' | 'swipe' | 'drag'>('idle');
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const suppressClickRef = useRef(false);

  const clearPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const resetGesture = useCallback(() => {
    clearPressTimer();
    gestureModeRef.current = 'idle';
    setDraggingIndex(null);
    setSwipingIndex(null);
    setSwipeOffset(0);
  }, [clearPressTimer]);

  // 关闭时重置内部状态
  useEffect(() => {
    if (!isOpen) {
      setSelectedIndices(new Set());
      setSelectionMode(false);
      setShowClearConfirm(false);
      resetGesture();
    }
  }, [isOpen, resetGesture]);

  useEffect(() => () => clearPressTimer(), [clearPressTimer]);

  const startLongPress = useCallback((index: number) => {
    clearPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      gestureModeRef.current = 'drag';
      setDraggingIndex(index);
      setSwipingIndex(null);
      setSwipeOffset(0);
      suppressClickRef.current = true;
    }, 280);
  }, [clearPressTimer]);

  const handleTouchStart = useCallback((index: number, event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1 || selectionMode) return;
    const touch = event.touches[0];
    startXRef.current = touch.clientX;
    startYRef.current = touch.clientY;
    gestureModeRef.current = 'idle';
    startLongPress(index);
  }, [startLongPress, selectionMode]);

  const handleTouchMove = useCallback((index: number, event: TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    const deltaX = touch.clientX - startXRef.current;
    const deltaY = touch.clientY - startYRef.current;

    if (gestureModeRef.current === 'drag') {
      event.preventDefault();
      const element = document.elementFromPoint(touch.clientX, touch.clientY);
      const row = element?.closest<HTMLElement>('.bps-item');
      const targetIndex = row?.dataset.index ? Number(row.dataset.index) : Number.NaN;
      if (!Number.isNaN(targetIndex) && targetIndex !== draggingIndex && targetIndex >= 0 && targetIndex < playlist.length && draggingIndex !== null) {
        onMoveItem(draggingIndex, targetIndex);
        setDraggingIndex(targetIndex);
      }
      return;
    }

    // 纵向滚动优先
    if (Math.abs(deltaY) > 10 && Math.abs(deltaY) > Math.abs(deltaX)) {
      clearPressTimer();
      return;
    }

    // 横向滑动 -> 露出删除
    if (Math.abs(deltaX) > 12 && Math.abs(deltaX) > Math.abs(deltaY)) {
      clearPressTimer();
      gestureModeRef.current = 'swipe';
      suppressClickRef.current = true;
      const nextOffset = Math.max(-96, Math.min(0, deltaX));
      setSwipingIndex(index);
      setSwipeOffset(nextOffset);
    }
  }, [clearPressTimer, draggingIndex, onMoveItem, playlist.length]);

  const handleTouchEnd = useCallback((index: number) => {
    clearPressTimer();
    if (gestureModeRef.current === 'swipe' && swipingIndex === index) {
      if (swipeOffset <= -64) {
        onRemoveItem(index);
      }
    }
    if (gestureModeRef.current === 'drag') {
      suppressClickRef.current = true;
    }
    resetGesture();
  }, [clearPressTimer, onRemoveItem, resetGesture, swipeOffset, swipingIndex]);

  const handleTouchCancel = useCallback(() => resetGesture(), [resetGesture]);

  const handleItemClick = useCallback((index: number, event: MouseEvent<HTMLDivElement>) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (selectionMode) {
      toggleSelection(index);
      return;
    }
    onPlayAt(index);
  }, [onPlayAt, selectionMode]);

  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const handleBatchDelete = useCallback(() => {
    if (selectedIndices.size === 0 || !onRemoveItems) return;
    onRemoveItems(Array.from(selectedIndices));
    setSelectedIndices(new Set());
    setSelectionMode(false);
  }, [selectedIndices, onRemoveItems]);

  const handleClearPlaylist = useCallback(() => {
    if (!onClearPlaylist) return;
    onClearPlaylist();
    setShowClearConfirm(false);
  }, [onClearPlaylist]);

  const hasSelection = selectedIndices.size > 0;

  return (
    <>
      {/* 遮罩 */}
      <div
        className={`bps-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <div className={`better-playlist-sheet ${isOpen ? 'open' : ''}`} role="dialog" aria-modal="true" aria-label="播放列表">
        {/* 顶部把手 */}
        <div className="bps-handle" onClick={onClose} aria-label="关闭" />

        {/* 标题栏 */}
        <div className="bps-header">
          <div className="bps-header-titles">
            <h2 className="bps-title">待播列表</h2>
            <span className="bps-count">{playlist.length} 首歌曲</span>
          </div>
          <button className="bps-close-btn" onClick={onClose} type="button" aria-label="关闭">
            <CloseIcon size={22} />
          </button>
        </div>

        {/* 正在播放卡片 */}
        {currentSong && (
          <div className="bps-now-playing">
            <img
              src={normalizeMediaUrl(currentSong.picUrl) || PLACEHOLDER_COVER}
              alt={currentSong.name}
              className="bps-now-playing-cover"
              onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER_COVER) e.currentTarget.src = PLACEHOLDER_COVER; }}
            />
            <div className="bps-now-playing-info">
              <div className="bps-now-playing-label">
                <span className="bps-equalizer" aria-hidden="true">
                  <span /><span /><span /><span />
                </span>
                {isPlaying ? '正在播放' : '已暂停'}
              </div>
              <div className="bps-now-playing-title">{currentSong.name}</div>
              <div className="bps-now-playing-artist">{currentSong.artists}</div>
            </div>
          </div>
        )}

        {/* 工具栏：多选 / 清空 / 导入 */}
        <div className="bps-toolbar">
          {showClearConfirm ? (
            <div className="bps-confirm">
              <span className="bps-confirm-text">确定清空列表？</span>
              <button className="bps-btn bps-btn-danger" onClick={handleClearPlaylist} type="button">确定</button>
              <button className="bps-btn" onClick={() => setShowClearConfirm(false)} type="button">取消</button>
            </div>
          ) : (
            <div className="bps-toolbar-actions">
              {onImport && (
                <button className="bps-btn" onClick={onImport} type="button">
                  <ImportIcon size={14} />
                  导入
                </button>
              )}
              <button
                className={`bps-btn ${selectionMode ? 'active' : ''}`}
                onClick={() => {
                  setSelectionMode(prev => {
                    if (prev) setSelectedIndices(new Set());
                    return !prev;
                  });
                }}
                type="button"
              >
                <CheckIcon size={14} />
                {selectionMode ? '取消' : '多选'}
              </button>
              {selectionMode && hasSelection && onRemoveItems && (
                <button className="bps-btn bps-btn-danger" onClick={handleBatchDelete} type="button">
                  <TrashIcon size={14} />
                  删除 ({selectedIndices.size})
                </button>
              )}
              {onClearPlaylist && (
                <button className="bps-btn bps-btn-danger" onClick={() => setShowClearConfirm(true)} type="button">
                  <TrashIcon size={14} />
                  清空
                </button>
              )}
            </div>
          )}
        </div>

        {/* 列表 */}
        <div className="bps-list">
          {playlist.length === 0 ? (
            <div className="bps-empty">
              <span>列表为空，去搜索添加歌曲吧</span>
            </div>
          ) : (
            playlist.map((song, index) => {
              const isActive = index === currentIndex;
              const isSelected = selectedIndices.has(index);
              return (
                <div
                  key={`${song.id}-${index}`}
                  className={`bps-item-row ${swipingIndex === index ? 'swiping' : ''} ${swipingIndex === index && swipeOffset <= -64 ? 'armed' : ''}`}
                >
                  <div className="bps-item-delete" aria-hidden="true">
                    <TrashIcon size={16} />
                    <span className="bps-item-delete-text">删除</span>
                  </div>
                  <div
                    data-index={index}
                    className={`bps-item ${isActive ? 'active' : ''} ${draggingIndex === index ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
                    style={swipingIndex === index ? { transform: `translateX(${swipeOffset}px)`, transition: 'none' } : undefined}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchMove={(e) => handleTouchMove(index, e)}
                    onTouchEnd={() => handleTouchEnd(index)}
                    onTouchCancel={handleTouchCancel}
                    onClick={(e) => handleItemClick(index, e)}
                  >
                    {selectionMode && (
                      <button
                        className={`bps-checkbox ${isSelected ? 'checked' : ''}`}
                        onClick={(e) => { e.stopPropagation(); toggleSelection(index); }}
                        type="button"
                        aria-label={isSelected ? '取消选中' : '选中'}
                      >
                        {isSelected && <CheckIcon size={12} />}
                      </button>
                    )}
                    <div className="bps-item-cover-wrap">
                      <img
                        src={normalizeMediaUrl(song.picUrl) || PLACEHOLDER_COVER}
                        alt={song.name}
                        className="bps-item-cover"
                        loading="lazy"
                        onError={(e) => { if (e.currentTarget.src !== PLACEHOLDER_COVER) e.currentTarget.src = PLACEHOLDER_COVER; }}
                      />
                      {isActive && (
                        <span className="bps-item-cover-badge" aria-hidden="true">
                          <span className="bps-equalizer bps-equalizer-sm">
                            <span /><span /><span /><span />
                          </span>
                        </span>
                      )}
                    </div>
                    <div className="bps-item-info">
                      <div className={`bps-item-title ${isActive ? 'playing' : ''}`}>{song.name}</div>
                      <div className="bps-item-artist">{song.artists}</div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
