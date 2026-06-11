import { Song, MusicInfo, LyricData, AudioQuality } from '@/types/music';
import { normalizeMediaUrl } from '@/lib/media';

// ============================
// 混合 API 客户端
// ============================
// 主源（A）：dev.ciallo.pp.ua/music/t8.php —— POST form-data, 一次拿全, 含 tlyric
// 兜底（B）：api.qijieya.cn/meting/ —— GET query, 有 playlist / tencent, 但 url/pic 是 302

const PRIMARY_API = 'https://dev.ciallo.pp.ua/music/t8.php';
const FALLBACK_API = 'https://api.qijieya.cn/meting/';

// AudioQuality -> t8 支持的音质 (标准 / 较高 / 极高 / 无损 / Hi-Res)
function mapQualityForT8(level: AudioQuality): string {
  switch (level) {
    case 'standard':
      return 'standard';
    case 'exhigh':
      return 'exhigh';
    case 'hires':
      return 'hires';
    case 'jymaster':
    case 'sky':
    case 'jyeffect':
      return 'hires';
    case 'lossless':
    default:
      return 'lossless';
  }
}

// AudioQuality -> meting 的 br (kbps)
function mapQualityForMeting(level: AudioQuality): string {
  switch (level) {
    case 'hires':
    case 'jymaster':
    case 'sky':
    case 'jyeffect':
      return '2000';
    case 'lossless':
      return '2000';
    case 'exhigh':
      return '320';
    case 'standard':
    default:
      return '320';
  }
}

// ============================
// 公共工具
// ============================

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

// 解析 A 响应壳: { success, data: { data: ..., status, ... }, message, from_cache }
function unwrapT8<T>(payload: unknown): T {
  if (!isObject(payload)) {
    throw new Error('Invalid API response');
  }
  if (payload.success === false) {
    const msg = typeof payload.message === 'string' ? payload.message : 'API request failed';
    throw new Error(msg);
  }
  if (!isObject(payload.data)) {
    throw new Error('Empty response payload');
  }
  const inner = payload.data as { data?: T };
  if (!('data' in inner)) {
    throw new Error('Missing inner data field');
  }
  return inner.data as T;
}

// 追踪 A 的速率限制
function trackT8RateLimit(response: Response) {
  const remaining = response.headers.get('X-RateLimit-Remaining');
  if (remaining !== null) {
    const n = parseInt(remaining, 10);
    if (!Number.isNaN(n) && n >= 0 && n < 5) {
      // eslint-disable-next-line no-console
      console.warn(`[t8] 速率限制即将耗尽: 剩余 ${n} 次`);
    }
  }
}

// ============================
// 来源 A: t8.php (POST form-data)
// ============================

async function t8Request<T>(action: string, params: Record<string, string>): Promise<T> {
  const formData = new FormData();
  for (const [k, v] of Object.entries(params)) {
    formData.append(k, v);
  }
  let response: Response;
  try {
    response = await fetch(`${PRIMARY_API}?action=${action}`, {
      method: 'POST',
      body: formData
    });
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  trackT8RateLimit(response);
  if (!response.ok) {
    throw new Error(`t8 ${action} failed: HTTP ${response.status}`);
  }
  const payload: unknown = await response.json();
  return unwrapT8<T>(payload);
}

interface T8SearchItem {
  id: number;
  name: string;
  artists: string;
  artist_string?: string;
  album: string;
  picUrl: string;
}

async function t8Search(keyword: string, limit: number): Promise<T8SearchItem[]> {
  return t8Request<T8SearchItem[]>('search', { keyword, limit: String(limit) });
}

interface T8ParseResult {
  id: string;
  name: string;
  ar_name: string;
  al_name: string;
  pic: string;
  url: string;
  level: string;
  quality: string;
  size: string;
  lyric: string;
  tlyric: string;
}

async function t8Parse(id: number | string, level: AudioQuality): Promise<T8ParseResult> {
  return t8Request<T8ParseResult>('parse', {
    url: String(id),
    level: mapQualityForT8(level)
  });
}

// ============================
// 来源 B: Meting (GET query)
// ============================

interface MetingSong {
  name: string;
  artist: string;
  // 都是 meting 子端点地址 (GET 后会 302 或返回纯文本)
  url: string;
  pic: string;
  lrc: string;
}

async function metingGetList(
  type: 'song' | 'search' | 'playlist',
  params: Record<string, string>
): Promise<MetingSong[]> {
  const qs = new URLSearchParams({ type, server: 'netease', ...params });
  let response: Response;
  try {
    response = await fetch(`${FALLBACK_API}?${qs.toString()}`);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) {
    throw new Error(`meting ${type} failed: HTTP ${response.status}`);
  }
  const json: unknown = await response.json();
  if (!Array.isArray(json)) {
    throw new Error('Invalid meting response');
  }
  return json as MetingSong[];
}

async function metingGetText(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    throw new Error(err instanceof Error ? `Network error: ${err.message}` : 'Network error');
  }
  if (!response.ok) {
    throw new Error(`meting sub-request failed: HTTP ${response.status}`);
  }
  return response.text();
}

// ============================
// 数据映射
// ============================

function mapT8SearchToSong(item: T8SearchItem): Song {
  return {
    id: item.id,
    name: item.name,
    artists: item.artists || item.artist_string || '',
    album: item.album || '',
    picUrl: normalizeMediaUrl(item.picUrl)
  };
}

// 从 meting 的 url 端点里提取 song id
function extractIdFromMetingUrl(url: string): number {
  try {
    const u = new URL(url);
    const id = u.searchParams.get('id');
    return id ? Number(id) : 0;
  } catch {
    return 0;
  }
}

function mapMetingToSong(item: MetingSong): Song {
  return {
    id: extractIdFromMetingUrl(item.url),
    name: item.name,
    artists: item.artist,
    album: '',
    // pic 是 meting 子端点, 浏览器 <img> 会自动跟随 302, 保留原地址即可
    picUrl: item.pic
  };
}

function parseSizeToBytes(size: string): number {
  const m = size.match(/^([\d.]+)\s*(KB|MB|GB)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (Number.isNaN(n)) return 0;
  const unit = (m[2] || 'MB').toUpperCase();
  if (unit === 'GB') return Math.round(n * 1024 * 1024);
  if (unit === 'KB') return Math.round(n);
  return Math.round(n * 1024);
}

// ============================
// 公共 API
// ============================

export async function searchSongs(keyword: string, limit = 30, offset = 0): Promise<Song[]> {
  // B 优先：GET 简单, 数组干净, 支持 page 分页
  try {
    const list = await metingGetList('search', {
      id: keyword,
      limit: String(limit),
      page: String(Math.floor(offset / limit) + 1)
    });
    if (list.length > 0) {
      return list.map(mapMetingToSong);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[searchSongs] meting failed, falling back to t8:', err);
  }
  // A 兜底
  const list = await t8Search(keyword, limit);
  return list.map(mapT8SearchToSong);
}

export async function getMusicInfo(id: number, level: AudioQuality = 'lossless'): Promise<MusicInfo> {
  // A 优先：一次拿全, 含 tlyric, 带签名直链
  try {
    const r = await t8Parse(id, level);
    return {
      id: Number(r.id) || id,
      name: r.name,
      artists: r.ar_name || '',
      album: r.al_name || '',
      picUrl: normalizeMediaUrl(r.pic),
      url: normalizeMediaUrl(r.url),
      br: 0,
      level: r.level || mapQualityForT8(level),
      size: parseSizeToBytes(r.size),
      md5: ''
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[getMusicInfo] t8 failed, falling back to meting:', err);
  }
  // B 兜底：只需 song 端点拿到 url/lrc 端点, url 子端点浏览器会自动 302
  const list = await metingGetList('song', { id: String(id) });
  if (list.length === 0) {
    throw new Error('未找到该歌曲');
  }
  const song = list[0];
  return {
    id,
    name: song.name,
    artists: song.artist,
    album: '',
    picUrl: song.pic,
    url: song.url, // meting 端点, <audio> 会跟随 302
    br: Number(mapQualityForMeting(level)) * 1000,
    level: mapQualityForT8(level),
    size: 0,
    md5: ''
  };
}

export async function getLyric(id: number): Promise<LyricData> {
  // A 优先：含 tlyric
  try {
    const r = await t8Parse(id, 'lossless');
    return {
      lrc: r.lyric || '',
      tlyric: r.tlyric || ''
    };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[getLyric] t8 failed, falling back to meting:', err);
  }
  // B 兜底：拿不到 tlyric
  try {
    const list = await metingGetList('song', { id: String(id) });
    if (list.length === 0) {
      return { lrc: '', tlyric: '' };
    }
    const lrc = await metingGetText(list[0].lrc);
    return { lrc, tlyric: '' };
  } catch {
    return { lrc: '', tlyric: '' };
  }
}

// ============================
// 歌词解析
// ============================

function parseTimedLyric(lrc: string): { time: number; text: string }[] {
  const lines = lrc.split(/\r?\n/);
  const result: { time: number; text: string }[] = [];

  // Accept [mm:ss.xx], [mm:ss:xx], [m:ss.xxx] etc. Minutes/seconds may be 1 or 2 digits.
  const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
  const metaTagRegex = /^\[[a-zA-Z]+:[^\]]*\]$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || metaTagRegex.test(trimmed)) continue;

    const timeMatches = [...trimmed.matchAll(timeRegex)];
    if (timeMatches.length === 0) continue;

    const text = trimmed.replace(timeRegex, '').trim();
    if (!text) continue;

    for (const match of timeMatches) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const msRaw = match[3] || '0';
      const ms = parseInt(msRaw.padEnd(3, '0').slice(0, 3), 10);
      const time = minutes * 60 + seconds + ms / 1000;
      result.push({ time, text });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function parseLyric(lrc: string, tlyric = ''): { time: number; text: string; translation?: string }[] {
  if (typeof lrc !== 'string' || lrc.length === 0) return [];

  const lyricLines = parseTimedLyric(lrc);
  if (lyricLines.length === 0) return [];

  const translationMap = new Map(
    parseTimedLyric(tlyric).map((line) => [line.time.toFixed(3), line.text])
  );

  return lyricLines.map((line) => {
    const translation = translationMap.get(line.time.toFixed(3));
    return {
      ...line,
      translation: translation && translation !== line.text ? translation : undefined
    };
  });
}

// ============================
// Playlist import
// ============================

export interface PlaylistInfo {
  id: number;
  name: string;
  coverImgUrl: string;
  trackCount: number;
  songs: Song[];
}

export async function fetchPlaylist(playlistId: string | number): Promise<PlaylistInfo> {
  // B 是唯一有 playlist 端点的源
  const list = await metingGetList('playlist', {
    id: String(playlistId),
    limit: '1000'
  });
  if (list.length === 0) {
    throw new Error('该歌单暂无歌曲或接口未返回数据');
  }
  return {
    id: Number(playlistId) || 0,
    name: `歌单 ${playlistId}`,
    coverImgUrl: '',
    trackCount: list.length,
    songs: list.map(mapMetingToSong)
  };
}

export function extractPlaylistId(input: string): string | null {
  const trimmed = input.trim();
  if (/^\d+$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get('id');
    if (id && /^\d+$/.test(id)) {
      return id;
    }
  } catch {
    // ignore invalid URL
  }
  return null;
}
