'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SourceSwitcher } from '@/components/SourceSwitcher';
import { VideoPlayer } from '@/components/VideoPlayer';
import { ChannelGrid } from '@/components/ChannelGrid';
import { fetchChannels, getStoredSource, setStoredSource } from '@/lib/api';
import type { Channel, SourceKey } from '@/types/cctv';

export default function BawTVPage() {
  const [source, setSource] = useState<SourceKey>(() => getStoredSource());
  const [channels, setChannels] = useState<Channel[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string>('');
  const [playerReloadKey, setPlayerReloadKey] = useState(0);
  const [notice, setNotice] = useState<string>('');
  const noticeTimerRef = useRef<number | null>(null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimerRef.current) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setNotice('');
      noticeTimerRef.current = null;
    }, 2200);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const loadChannels = useCallback(
    async (s: SourceKey) => {
      setLoading(true);
      setListError('');
      const result = await fetchChannels(s);
      if (!result.ok) {
        setChannels([]);
        setCurrentId(null);
        setListError(result.error);
        setLoading(false);
        return;
      }
      setChannels(result.data.channels);
      // 默认选中第一个
      setCurrentId(result.data.channels[0]?.id ?? null);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    void loadChannels(source);
  }, [source, loadChannels]);

  const handleChangeSource = useCallback(
    (next: SourceKey) => {
      if (next === source) return;
      setSource(next);
      setStoredSource(next);
      showNotice(next === 'main' ? '已切换到 MAIN' : '已切换到 BACKUP');
    },
    [source, showNotice]
  );

  const handleSelectChannel = useCallback((ch: Channel) => {
    setCurrentId(ch.id);
    setPlayerReloadKey((k) => k + 1);
  }, []);

  const handleRetryList = useCallback(() => {
    void loadChannels(source);
  }, [loadChannels, source]);

  const handleRetryPlayer = useCallback(() => {
    setPlayerReloadKey((k) => k + 1);
  }, []);

  const currentChannel = useMemo(
    () => channels.find((c) => c.id === currentId) ?? null,
    [channels, currentId]
  );

  return (
    <div className="app-container">
      <header className="top-bar">
        <div className="brand">
          <span className="brand-title">BawTV</span>
          <span className="brand-subtitle">CCTV 直播</span>
        </div>
        <SourceSwitcher value={source} onChange={handleChangeSource} disabled={loading} />
      </header>

      <main className="main-layout">
        <VideoPlayer
          channel={currentChannel}
          reloadKey={playerReloadKey}
          onRetry={handleRetryPlayer}
        />

        <section className="channels-pane">
          <div className="channels-header">
            <span className="channels-title">频道列表</span>
            <span className="channels-count">
              {loading ? '加载中' : `${channels.length} 个频道`}
            </span>
          </div>

          {loading ? (
            <div className="empty-list">
              <div className="loading-spinner" />
              <div>正在拉取 {source === 'main' ? 'MAIN' : 'BACKUP'} 频道列表…</div>
            </div>
          ) : listError ? (
            <div className="empty-list">
              <svg
                className="empty-list-icon"
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <line x1="12" y1="8" x2="12" y2="13" />
                <circle cx="12" cy="16.5" r="1" fill="currentColor" />
              </svg>
              <div>频道列表加载失败</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                {listError}
              </div>
              <button className="empty-retry" type="button" onClick={handleRetryList}>
                重试
              </button>
            </div>
          ) : channels.length === 0 ? (
            <div className="empty-list">
              <div>该源下暂无 CCTV 频道</div>
              <button className="empty-retry" type="button" onClick={handleRetryList}>
                重新加载
              </button>
            </div>
          ) : (
            <div className="channels-grid">
              <ChannelGrid
                channels={channels}
                currentId={currentId}
                onSelect={handleSelectChannel}
              />
            </div>
          )}
        </section>
      </main>

      {notice && <div className="notice">{notice}</div>}
    </div>
  );
}
