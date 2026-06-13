'use client';

import type { PingResult } from '@/types/route';

type Props = {
  url: string;
  result: PingResult | null;
  isFastest: boolean;
  showUrl: boolean;
};

function formatHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function statusLabel(result: PingResult | null): string {
  if (!result) return '测速中…';
  if (result.ok && result.latencyMs !== null) {
    return `${Math.round(result.latencyMs)} ms`;
  }
  return result.error || '失败';
}

function latencyBarWidth(result: PingResult | null): string {
  if (!result || result.latencyMs === null) return '0%';
  // 0–500ms 映射到 0–100%，超过 500ms 视为满格
  const ratio = Math.max(0, Math.min(1, result.latencyMs / 500));
  return `${(1 - ratio) * 100}%`;
}

export function TargetCard({ url, result, isFastest, showUrl }: Props) {
  return (
    <div className={`target-card glass ${isFastest ? 'fastest' : ''}`}>
      <div className="target-card-header">
        <div className="target-card-host">
          {isFastest && <span className="target-card-check" aria-hidden="true">✓</span>}
          <span className="target-card-hostname">{formatHost(url)}</span>
        </div>
        <div className="target-card-status">
          {result ? (
            <span className={result.ok ? 'target-card-status-ok' : 'target-card-status-fail'}>
              {statusLabel(result)}
            </span>
          ) : (
            <span className="target-card-status-pending">
              <span className="dot" />
              测速中
            </span>
          )}
        </div>
      </div>

      <div className="target-card-bar" aria-hidden="true">
        <div
          className="target-card-bar-fill"
          style={{ width: latencyBarWidth(result) }}
        />
      </div>

      {showUrl && result?.samples && result.samples.length > 1 && (
        <div className="target-card-samples">
          样本：{result.samples.map((s) => `${Math.round(s)}ms`).join(' / ')}
        </div>
      )}
    </div>
  );
}
