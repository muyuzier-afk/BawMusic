'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Song } from '@/types/music';
import { searchSongs } from '@/lib/api';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';
import { SearchIcon, CloseIcon } from './Icons';

interface SearchBarProps {
  onSongSelect: (song: Song) => void;
  /** 传入则进入本地过滤模式（在音乐库内搜索本地歌曲），不传则走在线搜索 */
  localSource?: Song[];
}

export function SearchBar({ onSongSelect, localSource }: SearchBarProps) {
  const [keyword, setKeyword] = useState('');
  const [suggestions, setSuggestions] = useState<Song[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const localSourceRef = useRef<Song[] | undefined>(localSource);
  localSourceRef.current = localSource;
  const isLocalMode = Boolean(localSource);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchend', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchend', handleClickOutside);
    };
  }, []);

  const search = useCallback(async (query: string) => {
    const currentRequestId = ++requestIdRef.current;
    const q = query.trim();

    if (!q) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // 本地过滤模式：在音乐库内匹配
    const local = localSourceRef.current;
    if (local) {
      const lower = q.toLowerCase();
      const results = local.filter((s) =>
        s.name.toLowerCase().includes(lower)
        || s.artists.toLowerCase().includes(lower)
        || s.album.toLowerCase().includes(lower)
      ).slice(0, 20);
      if (currentRequestId !== requestIdRef.current) return;
      setSuggestions(results);
      setIsOpen(results.length > 0);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);

    try {
      const results = await searchSongs(q, 5);
      if (currentRequestId !== requestIdRef.current) return;

      setSuggestions(results.slice(0, 5));
      setIsOpen(true);
    } catch {
      if (currentRequestId !== requestIdRef.current) return;
      setSuggestions([]);
    } finally {
      if (currentRequestId !== requestIdRef.current) return;

      setIsLoading(false);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setKeyword(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!value.trim()) {
      requestIdRef.current += 1;
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    // 本地模式即时过滤，无需 debounce
    if (isLocalMode) {
      search(value);
      return;
    }

    setIsLoading(true);

    debounceRef.current = setTimeout(() => {
      search(value);
    }, 300);
  };

  const handleSelect = (song: Song) => {
    requestIdRef.current += 1;
    setKeyword('');
    setSuggestions([]);
    setIsOpen(false);
    onSongSelect(song);
  };

  const handleClear = () => {
    requestIdRef.current += 1;
    setKeyword('');
    setSuggestions([]);
    setIsOpen(false);
    setIsLoading(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      handleSelect(suggestions[0]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  // 本地模式：有输入即显示下拉（含空结果提示）；在线模式：有结果或 loading 时显示
  const showDropdown = isLocalMode
    ? Boolean(keyword.trim()) && isOpen
    : isOpen && (suggestions.length > 0 || isLoading);

  // 模式切换（视图切换）时，若已有输入则重新过滤
  useEffect(() => {
    if (keyword.trim()) {
      requestIdRef.current += 1;
      search(keyword);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocalMode, localSource]);

  return (
    <div className="search-container" ref={containerRef} style={{ position: 'relative', zIndex: 1000 }}>
      <span className="search-icon">
        <SearchIcon />
      </span>
      <input
        ref={inputRef}
        type="search"
        className="search-input"
        placeholder={isLocalMode ? '搜索音乐库...' : '搜索音乐...'}
        value={keyword}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => keyword && setIsOpen(true)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      {isLoading && (
        <div style={{
          position: 'absolute',
          right: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          width: '16px',
          height: '16px',
          border: '2px solid var(--color-text-tertiary)',
          borderTopColor: 'var(--color-text)',
          borderRadius: '50%',
          animation: 'spin 0.6s linear infinite'
        }} />
      )}
      {keyword && !isLoading && (
        <button
          className="icon-btn"
          onClick={handleClear}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            padding: '4px'
          }}
        >
          <CloseIcon size={16} />
        </button>
      )}

      {showDropdown && (
        <div
          className="glass search-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            zIndex: 1001,
            maxHeight: '400px',
            overflowY: 'auto',
            touchAction: 'manipulation'
          }}
        >
          {isLoading && suggestions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
              <div style={{
                width: '24px',
                height: '24px',
                border: '2px solid var(--color-surface-hover)',
                borderTopColor: 'var(--color-text)',
                borderRadius: '50%',
                animation: 'spin 0.6s linear infinite',
                margin: '0 auto 8px'
              }} />
              <span style={{ fontSize: '13px' }}>搜索中...</span>
            </div>
          ) : suggestions.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--color-text-tertiary)', fontSize: '13px' }}>
              音乐库中没有匹配的歌曲
            </div>
          ) : (
            suggestions.map((song) => (
              <div
                key={song.id}
                onClick={() => handleSelect(song)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  background: 'transparent',
                  WebkitTapHighlightColor: 'transparent'
                }}
              >
                <img
                  src={normalizeMediaUrl(song.picUrl) || PLACEHOLDER_COVER}
                  alt={song.name}
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    flexShrink: 0,
                    background: 'var(--color-surface)'
                  }}
                  onError={(event) => {
                    const target = event.currentTarget;
                    if (target.src !== PLACEHOLDER_COVER) {
                      target.src = PLACEHOLDER_COVER;
                    }
                  }}
                />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: 'var(--color-text)'
                    }}
                  >
                    {song.name}
                  </div>
                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: '2px'
                    }}
                  >
                    {song.artists}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
