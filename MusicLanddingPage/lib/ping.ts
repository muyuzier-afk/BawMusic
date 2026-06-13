// 目标节点测速：fetch + performance.now + AbortController 超时
// 模式：no-cors，保证从任何静态托管域发起都不会 CORS 失败
// 注意：no-cors 拿到的是 opaque response，response.status 始终为 0，
// 但请求是否真的到达 / 完成会通过 fetch 自身的 resolve / reject 体现。
import type { PingResult } from '@/types/route';

export type { PingResult };

type PingOptions = {
  timeoutMs?: number; // 单次请求超时
  rounds?: number;    // 每个目标测几次，取最小值
  intervalMs?: number; // 多次之间的间隔
};

const DEFAULT_TIMEOUT = 2000;
const DEFAULT_ROUNDS = 2;
const DEFAULT_INTERVAL = 200;

async function pingOnce(url: string, timeoutMs: number): Promise<number> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();
  try {
    // 拼上随机 query 防止命中任何缓存
    const u = new URL(url);
    u.searchParams.set('_r', String(Date.now()) + Math.random().toString(36).slice(2, 6));
    await fetch(u.toString(), {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
      // keepalive 让页面在跳转前的最后一刻仍能完成
      keepalive: true,
    });
    const elapsed = performance.now() - started;
    return elapsed;
  } finally {
    window.clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function pingUrl(url: string, options: PingOptions = {}): Promise<PingResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT;
  const rounds = options.rounds ?? DEFAULT_ROUNDS;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL;
  const samples: number[] = [];
  let lastError: string | undefined;

  for (let i = 0; i < rounds; i++) {
    if (i > 0) await sleep(intervalMs);
    try {
      const ms = await pingOnce(url, timeoutMs);
      samples.push(ms);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '请求失败';
      // abort 走 Error 名 'AbortError'，归一为超时
      lastError = err instanceof DOMException && err.name === 'AbortError' ? `超时 (>${timeoutMs}ms)` : msg;
    }
  }

  if (samples.length === 0) {
    return { url, ok: false, latencyMs: null, error: lastError ?? '全部探测失败', samples: [] };
  }

  // 取最小延迟（最稳的网络耗时下界）
  const min = Math.min(...samples);
  return { url, ok: true, latencyMs: min, samples };
}

export async function pingAll(urls: string[], options: PingOptions = {}): Promise<PingResult[]> {
  return Promise.all(urls.map((u) => pingUrl(u, options)));
}

// 选最优：取 ok=true 且 latencyMs 最小的；若无 ok 则全部失败
export function pickFastest(results: PingResult[]): PingResult | null {
  const candidates = results.filter((r) => r.ok && r.latencyMs !== null);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, cur) => (cur.latencyMs! < best.latencyMs! ? cur : best));
}

// 透传当前页面的 path / query / hash 到目标域
export function buildTargetUrl(baseUrl: string): string {
  if (typeof window === 'undefined') return baseUrl;
  const suffix = window.location.pathname + window.location.search + window.location.hash;
  return baseUrl.replace(/\/+$/, '') + suffix;
}
