'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Song } from '@/types/music';
import { searchSongs } from '@/lib/api';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { SearchIcon, CloseIcon } from './Icons';

interface FullScreenSearchProps {
  onSongSelect: (song: Song) => void;
  onClose: () => void;
  /** 搜索结果条数 */
  limit?: number;
  /** 内联模式：PC 端作为左栏内容嵌入，不使用 fixed overlay */
  inline?: boolean;
}

/**
 * Better Styles 搜索：结果以网格展示，支持更多结果。
 * - 默认（overlay）：覆盖整个视口
 * - inline：PC 端作为左栏内容嵌入，不用 fixed 定位
 */
export function FullScreenSearch({ onSongSelect, onClose, limit = 30, inline = false }: FullScreenSearchProps) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const search = useCallback(async (query: string) => {
    const currentRequestId = ++requestIdRef.current;
    const q = query.trim();
    if (!q) {
      setResults([]);
      setSearched(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const list = await searchSongs(q, limit);
      if (currentRequestId !== requestIdRef.current) return;
      setResults(list);
      setSearched(true);
    } catch {
      if (currentRequestId !== requestIdRef.current) return;
      setResults([]);
      setSearched(true);
    } finally {
      if (currentRequestId !== requestIdRef.current) return;
      setIsLoading(false);
    }
  }, [limit]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      requestIdRef.current += 1;
      setResults([]);
      setSearched(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    debounceRef.current = setTimeout(() => search(value), 320);
  };

  const handleSelect = (song: Song) => {
    // 先关闭搜索界面，避免播放器渲染时被搜索 overlay 覆盖
    onClose();
    onSongSelect(song);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && results.length > 0) {
      handleSelect(results[0]);
    }
  };

  return (
    <div className={`fullscreen-search${inline ? ' fullscreen-search--inline' : ''}`} role={inline ? undefined : 'dialog'} aria-modal={inline ? undefined : true}>
      <div className="fullscreen-search-header">
        {!inline && (
          <button
            className="fullscreen-search-close"
            onClick={onClose}
            type="button"
            aria-label="关闭搜索"
          >
            <CloseIcon size={22} />
          </button>
        )}
        <div className="fullscreen-search-input-wrap">
          <span className="fullscreen-search-icon">
            <SearchIcon size={20} />
          </span>
          <input
            ref={inputRef}
            type="search"
            className="fullscreen-search-input"
            placeholder="搜索歌曲、歌手、专辑..."
            value={keyword}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          {isLoading && (
            <div className="fullscreen-search-spinner" aria-hidden="true" />
          )}
        </div>
        {inline && (
          <button
            className="fullscreen-search-close"
            onClick={onClose}
            type="button"
            aria-label="关闭搜索"
          >
            <CloseIcon size={22} />
          </button>
        )}
      </div>

      <div className="fullscreen-search-body">
        {!searched && !isLoading && (
          <div className="fullscreen-search-empty">
            <SearchIcon size={48} />
            <span>输入关键词开始搜索</span>
          </div>
        )}
        {searched && !isLoading && results.length === 0 && (
          <div className="fullscreen-search-empty">
            <span>没有找到「{keyword}」的相关结果</span>
          </div>
        )}
        {isLoading && results.length === 0 && (
          <div className="fullscreen-search-empty">
            <div className="fullscreen-search-spinner-lg" aria-hidden="true" />
            <span>搜索中...</span>
          </div>
        )}
        {results.length > 0 && (
          <div className="fullscreen-search-grid">
            {results.map((song) => (
              <button
                key={song.id}
                className="fullscreen-search-item"
                onClick={() => handleSelect(song)}
                type="button"
              >
                <img
                  src={normalizeMediaUrl(song.picUrl) || PLACEHOLDER_COVER}
                  alt={song.name}
                  className="fullscreen-search-item-cover"
                  loading="lazy"
                  onError={(e) => {
                    if (e.currentTarget.src !== PLACEHOLDER_COVER) {
                      e.currentTarget.src = PLACEHOLDER_COVER;
                    }
                  }}
                />
                <div className="fullscreen-search-item-info">
                  <div className="fullscreen-search-item-title">{song.name}</div>
                  <div className="fullscreen-search-item-artist">{song.artists}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
