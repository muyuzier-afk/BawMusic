// 客户端 API 封装：调用 Next.js Route Handler 拉取 CCTV 频道
import type { CctvChannelResponse, CctvErrorResponse, SourceKey } from '@/types/cctv';

const API_PATH = '/api/cctv-channels';

export type FetchChannelsResult =
  | { ok: true; data: CctvChannelResponse }
  | { ok: false; error: string };

export async function fetchChannels(source: SourceKey): Promise<FetchChannelsResult> {
  try {
    const res = await fetch(`${API_PATH}?source=${source}`, {
      cache: 'no-store',
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as CctvErrorResponse | null;
      return { ok: false, error: body?.message || `HTTP ${res.status}` };
    }
    const data = (await res.json()) as CctvChannelResponse;
    return { ok: true, data };
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
