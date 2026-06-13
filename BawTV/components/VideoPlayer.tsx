'use client';

import { useEffect, useRef, useState } from 'react';
import Hls, { type ErrorData } from 'hls.js';
import type { Channel } from '@/types/cctv';

type Props = {
  channel: Channel | null;
  reloadKey: number; // 切源/手动重试时递增
  onRetry: () => void;
};

type PlayerState = 'idle' | 'loading' | 'playing' | 'error';

export function VideoPlayer({ channel, reloadKey, onRetry }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [state, setState] = useState<PlayerState>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!channel) {
      // 卸载播放器
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute('src');
      video.load();
      setState('idle');
      setErrorMsg('');
      return;
    }

    setState('loading');
    setErrorMsg('');

    // 清理旧的 hls 实例
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const url = channel.url;

    // Safari / iOS 原生支持 HLS
    const canNative = video.canPlayType('application/vnd.apple.mpegurl') !== '';
    if (canNative) {
      video.src = url;
      const onPlaying = () => setState('playing');
      const onWaiting = () => setState('loading');
      const onError = () => {
        setState('error');
        setErrorMsg('原生播放器加载失败，请尝试切换数据源');
      };
      video.addEventListener('playing', onPlaying);
      video.addEventListener('waiting', onWaiting);
      video.addEventListener('error', onError);
      video.play().catch(() => {
        // autoplay 失败不致命，状态由事件决定
      });
      return () => {
        video.removeEventListener('playing', onPlaying);
        video.removeEventListener('waiting', onWaiting);
        video.removeEventListener('error', onError);
      };
    }

    if (!Hls.isSupported()) {
      setState('error');
      setErrorMsg('当前浏览器不支持 HLS 播放');
      return;
    }

    const hls = new Hls({
      // 直播配置
      liveDurationInfinity: true,
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 30,
    });
    hlsRef.current = hls;

    hls.loadSource(url);
    hls.attachMedia(video);

    const onManifestParsed = () => {
      video.play().catch(() => undefined);
    };
    const onPlaying = () => setState('playing');
    const onFragLoaded = () => {
      // 切到 playing 仅在第一次切片加载完成后
    };
    const onError = (_event: unknown, data: ErrorData) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError();
            break;
          default:
            setState('error');
            setErrorMsg(`直播流错误: ${data.details || data.type}`);
        }
      }
    };

    hls.on(Hls.Events.MANIFEST_PARSED, onManifestParsed);
    hls.on(Hls.Events.FRAG_LOADED, onFragLoaded);
    video.addEventListener('playing', onPlaying);
    hls.on(Hls.Events.ERROR, onError);

    return () => {
      hls.off(Hls.Events.MANIFEST_PARSED, onManifestParsed);
      hls.off(Hls.Events.FRAG_LOADED, onFragLoaded);
      hls.off(Hls.Events.ERROR, onError);
      video.removeEventListener('playing', onPlaying);
      hls.destroy();
      hlsRef.current = null;
    };
  }, [channel?.id, channel?.url, reloadKey]);

  const showEmpty = !channel;
  const showLoading = channel && state === 'loading';
  const showError = channel && state === 'error';

  return (
    <div className="player-pane">
      {showEmpty && (
        <div className="player-empty">
          <svg
            className="player-empty-icon"
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="6" width="18" height="13" rx="2.5" />
            <path d="M10 10.5v4l3.5-2z" fill="currentColor" />
          </svg>
          <div>请选择左侧频道开始观看</div>
        </div>
      )}

      <video
        ref={videoRef}
        className="video-element"
        style={{ display: showEmpty ? 'none' : 'block' }}
        controls
        playsInline
        autoPlay
        muted
      />

      {channel && !showEmpty && (
        <>
          <div className="live-badge">
            <span className="live-dot" />
            直播中
          </div>
          <div className="player-channel-name">{channel.name}</div>
        </>
      )}

      {showLoading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.4)',
            zIndex: 2,
          }}
        >
          <div className="loading-spinner" />
        </div>
      )}

      {showError && (
        <div className="player-error">
          <div className="player-error-title">直播加载失败</div>
          <div>{errorMsg || '请检查网络或切换到另一个源'}</div>
          <button
            className="player-error-retry"
            type="button"
            onClick={() => {
              setState('loading');
              setErrorMsg('');
              if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
              }
              onRetry();
            }}
          >
            重试
          </button>
        </div>
      )}
    </div>
  );
}
