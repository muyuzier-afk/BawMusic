// 客户端 API 封装：从同源静态 JSON 读取 CCTV 频道
// 数据是在 build 阶段由 scripts/build-cctv-data.mjs 生成到
// public/data/cctv-channels.json 的，ESA Pages 静态托管下不会有 CORS 问题
import type { CctvChannelResponse, SourceKey } from '@/types/cctv';

const STATIC_PATH = '/data/cctv-channels.json';

// 静态数据文件内容结构（构建脚本产出）
type StaticChannelsFile = {
  fetchedAt: string;
  main: { channels: CctvChannelResponse['channels']; error: string | null };
  backup: { channels: CctvChannelResponse['channels']; error: string | null };
};

export type FetchChannelsResult =
  | { ok: true; data: CctvChannelResponse }
  | { ok: false; error: string };

// 内存缓存：避免每次切换源都重新 fetch
let cache: StaticChannelsFile | null = null;
let cachePromise: Promise<StaticChannelsFile> | null = null;

async function loadStatic(): Promise<StaticChannelsFile> {
  if (cache) return cache;
  if (cachePromise) return cachePromise;

  cachePromise = fetch(`${STATIC_PATH}?t=${Date.now()}`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return (await res.json()) as StaticChannelsFile;
    })
    .then((data) => {
      cache = data;
      return data;
    })
    .catch((err) => {
      cachePromise = null;
      throw err;
    });

  return cachePromise;
}

export async function fetchChannels(source: SourceKey): Promise<FetchChannelsResult> {
  try {
    const data = await loadStatic();
    const entry = data[source];
    if (!entry) {
      return { ok: false, error: `未知源: ${source}` };
    }
    if (entry.error) {
      return { ok: false, error: entry.error };
    }
    return {
      ok: true,
      data: {
        source,
        fetchedAt: data.fetchedAt,
        channels: entry.channels,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '网络异常';
    return { ok: false, error: message };
  }
}

// localStorage 持久化源偏好
const STORAGE_KEY = 'bawtv.apiSource';
const VALID: SourceKey[] = ['main', 'backup'];

export function getStoredSource(): SourceKey {
  if (typeof window === 'undefined') return 'main';
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw && (VALID as string[]).includes(raw)) {
      return raw as SourceKey;
    }
  } catch {
    // ignore
  }
  return 'main';
}

export function setStoredSource(s: SourceKey): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, s);
  } catch {
    // ignore
  }
}
