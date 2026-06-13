'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { TargetCard } from '@/components/TargetCard';
import { CountdownBar } from '@/components/CountdownBar';
import { ManualLinks } from '@/components/ManualLinks';
import { buildTargetUrl, pickFastest, pingAll, type PingResult } from '@/lib/ping';

// 两个 BawMusic 入口节点
const CANDIDATES = ['https://bawmusic.top', 'https://eo.bawmusic.top'] as const;

// 自动跳转倒计时（毫秒）
const REDIRECT_DELAY_MS = 2500;

export default function BawRouterPage() {
  const [results, setResults] = useState<(PingResult | null)[]>(
    CANDIDATES.map(() => null)
  );
  const [fastest, setFastest] = useState<PingResult | null>(null);
  const [remaining, setRemaining] = useState<number>(REDIRECT_DELAY_MS);
  const [allFailed, setAllFailed] = useState(false);
  const cancelledRef = useRef(false);
  const redirectedRef = useRef(false);

  // 跑测速
  const measure = useCallback(async () => {
    cancelledRef.current = false;
    redirectedRef.current = false;
    setFastest(null);
    setAllFailed(false);
    setResults(CANDIDATES.map(() => null));
    setRemaining(REDIRECT_DELAY_MS);

    const res = await pingAll([...CANDIDATES], {
      timeoutMs: 2000,
      rounds: 2,
      intervalMs: 200,
    });
    if (cancelledRef.current) return;
    setResults(res);

    const best = pickFastest(res);
    if (!best) {
      setAllFailed(true);
      return;
    }
    setFastest(best);

    // 预解析最优域名（提前建连）
    try {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = best.url;
      document.head.appendChild(link);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void measure();
  }, [measure]);

  // 倒计时
  useEffect(() => {
    if (!fastest) return;
    if (remaining <= 0) return;
    if (cancelledRef.current) return;
    const timer = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 100));
    }, 100);
    return () => window.clearInterval(timer);
  }, [fastest, remaining]);

  // 倒计时归零 → 跳转
  useEffect(() => {
    if (!fastest) return;
    if (remaining > 0) return;
    if (cancelledRef.current) return;
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    const target = buildTargetUrl(fastest.url);
    window.location.href = target;
  }, [fastest, remaining]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setRemaining(REDIRECT_DELAY_MS);
  }, []);

  const handleRemeasure = useCallback(() => {
    void measure();
  }, [measure]);

  return (
    <main className="app">
      <header className="brand">
        <div className="brand-title">BawMusic Router</div>
        <div className="brand-subtitle">自动选择延迟最低的入口</div>
      </header>

      <section className="targets" aria-label="测速结果">
        {CANDIDATES.map((url, i) => (
          <TargetCard
            key={url}
            url={url}
            result={results[i]}
            isFastest={fastest?.url === url}
            showUrl={false}
          />
        ))}
      </section>

      {allFailed ? (
        <div className="error-state" role="alert">
          <div className="error-state-title">两个节点都不可达</div>
          <div className="error-state-desc">
            网络可能受限，或两个 BawMusic 入口都暂时无响应。请检查网络后重试，或手动选择入口。
          </div>
        </div>
      ) : (
        <CountdownBar
          remainingMs={remaining}
          totalMs={REDIRECT_DELAY_MS}
          fastestHost={fastest ? new URL(fastest.url).host : null}
          onCancel={handleCancel}
          onRemeasure={handleRemeasure}
        />
      )}

      <ManualLinks
        urls={[...CANDIDATES]}
        disabled={false}
        highlightUrl={fastest?.url}
      />
    </main>
  );
}
