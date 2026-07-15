'use client';

import type { Song } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';
import { PLACEHOLDER_COVER } from '@/lib/cover';

interface LibraryViewProps {
  library: Song[];
  onPlay: (song: Song) => void;
  onPlayAll: () => void;
  onRemove: (id: number) => void;
  onClear: () => void;
  onImport: () => void;
}

/**
 * 音乐库视图：以 CD 网格展示收藏的歌曲（封面 + 歌名 + 歌手），
 * 列数随屏幕宽度自适应。点击 CD 播放该曲；hover/右上角按钮可移除。
 */
export function LibraryView({ library, onPlay, onPlayAll, onRemove, onClear, onImport }: LibraryViewProps) {
  if (library.length === 0) {
    return (
      <div className="library-empty">
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M4 4h4v16H4zM10 4h4v16h-4zM16 5l4 .5-2 15-4-.5z" />
        </svg>
        <div className="library-empty-title">音乐库是空的</div>
        <div className="library-empty-hint">搜索歌曲后点击「+」加入音乐库，或导入网易云歌单</div>
        <button className="library-empty-btn" onClick={onImport}>导入歌单</button>
      </div>
    );
  }

  return (
    <div className="library-view">
      <div className="library-header">
        <div className="library-header-info">
          <div className="library-header-title">音乐库</div>
          <div className="library-header-count">{library.length} 首歌曲</div>
        </div>
        <div className="library-header-actions">
          <button className="library-action" onClick={onPlayAll}>播放全部</button>
          <button className="library-action" onClick={onImport}>导入歌单</button>
          <button className="library-action library-action-danger" onClick={onClear}>清空</button>
        </div>
      </div>

      <div className="library-grid">
        {library.map((song) => (
          <div className="library-card" key={song.id} onClick={() => onPlay(song)}>
            <div className="library-card-cover">
              <img
                src={normalizeMediaUrl(song.picUrl) || PLACEHOLDER_COVER}
                alt={song.name}
                loading="lazy"
                onError={(event) => {
                  const target = event.currentTarget;
                  if (target.src !== PLACEHOLDER_COVER) {
                    target.src = PLACEHOLDER_COVER;
                  }
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
                aria-label="从音乐库移除"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(song.id);
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="library-card-name">{song.name}</div>
            <div className="library-card-artist">{song.artists}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
